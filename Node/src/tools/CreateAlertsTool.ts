import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

type NotificationMethod = "email" | "pager" | "netsend";

function mapNotificationMethod(method: NotificationMethod | undefined): number {
  switch (method) {
    case "pager":
      return 2; // pager
    case "netsend":
      return 4; // net send
    case "email":
    default:
      return 1; // email
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export class CreateAlertsTool implements Tool {
  [key: string]: any;
  name = "configure_agent_alerts";
  description = "Creates SQL Server Agent alerts for severities 16-25 and error numbers 823-825. Optionally attaches existing operators as notification receivers.";

  inputSchema = {
    type: "object",
    properties: {
      attachAllOperators: {
        type: "boolean",
        description: "If true, attach all existing operators to the created/existing alerts (uses sp_add_notification)",
        default: false
      },
      operatorNames: {
        type: "array",
        description: "Optional: list of operator names to attach as notification receivers (uses sp_add_notification)",
        items: { type: "string" }
      },
      notificationMethod: {
        type: "string",
        description: "Notification method to use when attaching operators: 'email' | 'pager' | 'netsend' (default: 'email')",
        enum: ["email", "pager", "netsend"],
        default: "email"
      },
      createSeverityAlerts: {
        type: "boolean",
        description: "Whether to (idempotently) create severity alerts 16-25",
        default: true
      },
      createErrorAlerts: {
        type: "boolean",
        description: "Whether to (idempotently) create error number alerts 823-825",
        default: true
      },
      serverName: {
        type: "string",
        description: "Optional: server name to target (if your environment supports switching connections)"
      }
    },
    required: []
  } as any;

  async run(params: any) {
    const {
      attachAllOperators = false,
      operatorNames,
      notificationMethod = "email",
      createSeverityAlerts = true,
      createErrorAlerts = true,
    } = params || {};

    const severities: number[] = createSeverityAlerts ? Array.from({ length: 10 }, (_, i) => i + 16) : [];
    const errorNumbers: number[] = createErrorAlerts ? [823, 824, 825] : [];

    const plannedSeverityAlertNames = severities.map((s) => `Severity ${s} Errors`);
    const plannedErrorAlertNames = errorNumbers.map((e) => `Error ${e}`);
    const allAlertNames = [...plannedSeverityAlertNames, ...plannedErrorAlertNames];

    try {
      // 1) Create alerts idempotently
      if (allAlertNames.length > 0) {
        const createStatements: string[] = [];

        for (const sev of severities) {
          const alertName = `Severity ${sev} Errors`;
          createStatements.push(`
IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysalerts WHERE name = N'${escapeSqlLiteral(alertName)}')
BEGIN
  EXEC msdb.dbo.sp_add_alert 
    @name = N'${escapeSqlLiteral(alertName)}',
    @severity = ${sev},
    @enabled = 1,
    @delay_between_responses = 0,
    @include_event_description_in = 1;
END`);
        }

        for (const errNum of errorNumbers) {
          const alertName = `Error ${errNum}`;
          createStatements.push(`
IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysalerts WHERE name = N'${escapeSqlLiteral(alertName)}')
BEGIN
  EXEC msdb.dbo.sp_add_alert 
    @name = N'${escapeSqlLiteral(alertName)}',
    @message_id = ${errNum},
    @enabled = 1,
    @delay_between_responses = 0,
    @include_event_description_in = 1;
END`);
        }

        if (createStatements.length > 0) {
          const batch = createStatements.join("\nGO\n");
          // mssql driver's batch does not support GO, ensure we don't include it
          const sanitizedBatch = batch.replace(/\nGO\n/g, "\n");
          const request = new sql.Request();
          await request.batch(sanitizedBatch);
        }
      }

      // 2) Fetch operators
      const operatorsRequest = new sql.Request();
      const operatorsResult = await operatorsRequest.query(`SELECT name FROM msdb.dbo.sysoperators ORDER BY name;`);
      const existingOperators: string[] = (operatorsResult.recordset || []).map((r: any) => r.name);

      // If there are operators and user didn't specify attachment, return list and ask for instruction
      const shouldAskForAttachment = existingOperators.length > 0 && !attachAllOperators && (!operatorNames || operatorNames.length === 0);
      if (shouldAskForAttachment) {
        return {
          success: true,
          message: "Alerts ensured. Operators exist. Re-run with 'attachAllOperators: true' or provide 'operatorNames' to attach notifications.",
          createdOrEnsuredAlerts: allAlertNames,
          operatorsFound: existingOperators,
          hint: {
            parameters: {
              attachAllOperators: true,
              // or specify operatorNames: ["Operator1", "Operator2"],
              notificationMethod: "email"
            }
          }
        };
      }

      // 3) Attach notifications if requested and operators exist
      const selectedOperators: string[] = attachAllOperators
        ? existingOperators
        : (operatorNames || []).filter((op: string) => existingOperators.includes(op));

      const invalidOperators = (operatorNames || []).filter((op: string) => !existingOperators.includes(op));

      const notificationMethodValue = mapNotificationMethod(notificationMethod as NotificationMethod);

      const attached: { alert: string; operator: string }[] = [];
      const alreadyAttached: { alert: string; operator: string }[] = [];

      if (selectedOperators.length > 0 && allAlertNames.length > 0) {
        const attachStatements: string[] = [];
        for (const alertName of allAlertNames) {
          const safeAlert = escapeSqlLiteral(alertName);
          for (const operator of selectedOperators) {
            const safeOperator = escapeSqlLiteral(operator);
            attachStatements.push(`
IF NOT EXISTS (
  SELECT 1
  FROM msdb.dbo.sysnotifications sn
  JOIN msdb.dbo.sysalerts sa ON sa.id = sn.alert_id
  JOIN msdb.dbo.sysoperators so ON so.id = sn.operator_id
  WHERE sa.name = N'${safeAlert}' AND so.name = N'${safeOperator}'
)
BEGIN
  EXEC msdb.dbo.sp_add_notification 
    @alert_name = N'${safeAlert}',
    @operator_name = N'${safeOperator}',
    @notification_method = ${notificationMethodValue};
END`);
          }
        }

        if (attachStatements.length > 0) {
          const attachBatch = attachStatements.join("\n");
          await new sql.Request().batch(attachBatch);
        }

        // Determine which are now attached (post-check)
        const checkRequest = new sql.Request();
        const inAlertList = allAlertNames.map((n) => `N'${escapeSqlLiteral(n)}'`).join(", ");
        const inOperatorList = selectedOperators.map((n) => `N'${escapeSqlLiteral(n)}'`).join(", ");
        const checkQuery = `
SELECT sa.name AS alert_name, so.name AS operator_name
FROM msdb.dbo.sysnotifications sn
JOIN msdb.dbo.sysalerts sa ON sa.id = sn.alert_id
JOIN msdb.dbo.sysoperators so ON so.id = sn.operator_id
WHERE sa.name IN (${inAlertList}) AND so.name IN (${inOperatorList});`;
        const checkResult = await checkRequest.query(checkQuery);
        const nowAttachedPairs = new Set(
          (checkResult.recordset || []).map((r: any) => `${r.alert_name}|||${r.operator_name}`)
        );

        for (const alertName of allAlertNames) {
          for (const operator of selectedOperators) {
            const key = `${alertName}|||${operator}`;
            if (nowAttachedPairs.has(key)) {
              attached.push({ alert: alertName, operator });
            } else {
              alreadyAttached.push({ alert: alertName, operator });
            }
          }
        }
      }

      return {
        success: true,
        message: "Alerts ensured. Notifications processed.",
        createdOrEnsuredAlerts: allAlertNames,
        operatorsProcessed: selectedOperators,
        invalidOperators,
        notificationMethod: notificationMethod,
        notificationsAttachedCount: attached.length,
        notificationsVerified: attached,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to configure agent alerts: ${err?.message || String(err)}`,
        error: err?.stack || err?.message || String(err)
      };
    }
  }
}


