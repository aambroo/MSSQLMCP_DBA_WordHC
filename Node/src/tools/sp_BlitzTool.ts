import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class sp_BlitzTool implements Tool {
  [key: string]: any;
  name = "sp_blitz";
  description = "Executes sp_Blitz to perform SQL Server health checks and identify potential performance issues";

  inputSchema = {
    type: "object",
    properties: {
      Help: {
        type: "boolean",
        description: "Mostra l'help di sp_Blitz (default: false)"
      },
      CheckUserDatabaseObjects: {
        type: "boolean",
        description: "Controlla oggetti dei database utente (default: true)"
      },
      CheckProcedureCache: {
        type: "boolean", 
        description: "Controlla il procedure cache per problemi di performance (default: false)"
      },
      OutputType: {
        type: "string",
        description: "Output format for results",
        enum: ["TABLE", "COUNT", "MARKDOWN", "XML"]
      },
      OutputServerName: {
        type: "string",
        description: "Server name to include in output"
      },
      CheckServerInfo: {
        type: "boolean",
        description: "Include server configuration information (default: false)"
      },
      OutputProcedureCache: {
        type: "boolean",
        description: "Include i risultati del controllo della procedure cache (default: false)"
      },
      CheckProcedureCacheFilter: {
        type: "string",
        description: "Filtro per i controlli del procedure cache (es. 'ALL', 'SP')"
      },
      SkipChecksServer: {
        type: "string",
        description: "Server name pattern to skip during checks"
      },
      SkipChecksDatabase: {
        type: "string",
        description: "Database name pattern to skip during checks"
      },
      SkipChecksSchema: {
        type: "string", 
        description: "Schema name pattern to skip during checks"
      },
      SkipChecksTable: {
        type: "string",
        description: "Table name pattern to skip during checks"
      },
      IgnorePrioritiesBelow: {
        type: "integer",
        description: "Ignore findings with priority below this number (1-255)"
      },
      IgnorePrioritiesAbove: {
        type: "integer", 
        description: "Ignore findings with priority above this number (1-255)"
      },
      BringThePain: {
        type: "boolean",
        description: "Run more intensive checks that may impact performance (default: false)"
      },
      OutputDatabaseName: {
        type: "string",
        description: "Database name for output table (if saving results)"
      },
      OutputSchemaName: {
        type: "string",
        description: "Schema name for output table (if saving results)"
      },
      OutputTableName: {
        type: "string",
        description: "Table name for saving results"
      },
      OutputXMLasNVARCHAR: {
        type: "boolean",
        description: "Restituisce XML come NVARCHAR (default: false)"
      },
      EmailRecipients: {
        type: "string",
        description: "Lista di destinatari email (se configurato)"
      },
      EmailProfile: {
        type: "string",
        description: "Nome del profilo Database Mail da usare"
      },
      SummaryMode: {
        type: "boolean",
        description: "Mostra solo il riepilogo dei risultati (default: false)"
      },
      Debug: {
        type: "boolean",
        description: "Enable debug mode for troubleshooting (default: false)"
      },
      UsualDBOwner: {
        type: "string",
        description: "Proprietario DB considerato 'normale' per i controlli"
      },
      SkipBlockingChecks: {
        type: "boolean",
        description: "Salta i controlli di blocking (default: true)"
      },
      VersionCheckMode: {
        type: "boolean",
        description: "Esegue la modalità controllo versione (default: false)"
      }
    },
    required: []
  } as any;

  async run(params: any) {
    const {
      Help = false,
      CheckUserDatabaseObjects = true,
      CheckProcedureCache = false,
      OutputType = "TABLE",
      OutputServerName,
      CheckServerInfo = false,
      OutputProcedureCache = false,
      CheckProcedureCacheFilter,
      IgnorePrioritiesBelow,
      IgnorePrioritiesAbove,
      BringThePain = false,
      OutputDatabaseName,
      OutputSchemaName,
      OutputTableName,
      OutputXMLasNVARCHAR = false,
      EmailRecipients,
      EmailProfile,
      SummaryMode = false,
      Debug = false,
      SkipChecksServer,
      SkipChecksDatabase,
      SkipChecksSchema,
      SkipChecksTable,
      UsualDBOwner,
      SkipBlockingChecks = true,
      VersionCheckMode = false
    } = params;

    try {
      const request = new sql.Request();
      
      // Build the sp_Blitz command with parameters
      let query = "EXEC sp_Blitz";
      const queryParams: string[] = [];

      const addParam = (paramName: string, value: any, isString = false) => {
        if (value !== undefined && value !== null) {
          if (isString) {
            queryParams.push(`@${paramName} = '${value.toString().replace(/'/g, "''")}'`);
          } else if (typeof value === 'boolean') {
            queryParams.push(`@${paramName} = ${value ? 1 : 0}`);
          } else {
            queryParams.push(`@${paramName} = ${value}`);
          }
        }
      };

      addParam("Help", Help);
      addParam("CheckUserDatabaseObjects", CheckUserDatabaseObjects);
      addParam("CheckProcedureCache", CheckProcedureCache);
      addParam("OutputType", OutputType, true);
      addParam("OutputServerName", OutputServerName, true);
      addParam("CheckServerInfo", CheckServerInfo);
      addParam("OutputProcedureCache", OutputProcedureCache);
      addParam("CheckProcedureCacheFilter", CheckProcedureCacheFilter, true);
      addParam("IgnorePrioritiesBelow", IgnorePrioritiesBelow);
      addParam("IgnorePrioritiesAbove", IgnorePrioritiesAbove);
      addParam("BringThePain", BringThePain);
      addParam("OutputDatabaseName", OutputDatabaseName, true);
      addParam("OutputSchemaName", OutputSchemaName, true);
      addParam("OutputTableName", OutputTableName, true);
      addParam("OutputXMLasNVARCHAR", OutputXMLasNVARCHAR);
      addParam("EmailRecipients", EmailRecipients, true);
      addParam("EmailProfile", EmailProfile, true);
      addParam("Debug", Debug);
      addParam("SummaryMode", SummaryMode);
      addParam("SkipChecksServer", SkipChecksServer, true);
      addParam("SkipChecksDatabase", SkipChecksDatabase, true);
      addParam("SkipChecksSchema", SkipChecksSchema, true);
      addParam("SkipChecksTable", SkipChecksTable, true);
      addParam("UsualDBOwner", UsualDBOwner, true);
      addParam("SkipBlockingChecks", SkipBlockingChecks);
      addParam("VersionCheckMode", VersionCheckMode);

      // Add parameters to query if any exist
      if (queryParams.length > 0) {
        query += " " + queryParams.join(", ");
      }

      const result = await request.query(query);

      const findings = result.recordset || [];
      const totalFindings = findings.length;
      const criticalFindings = findings.filter((f: any) => f.Priority <= 50).length;
      const warningFindings = findings.filter((f: any) => f.Priority > 50 && f.Priority <= 100).length;
      const infoFindings = findings.filter((f: any) => f.Priority > 100).length;

      // Group findings by CheckID for better organization
      const findingsByCheck: { [key: string]: any } = {};
      findings.forEach((finding: any) => {
        const checkId = finding.CheckID;
        if (!findingsByCheck[checkId]) {
          findingsByCheck[checkId] = {
            CheckID: checkId,
            FindingsGroup: finding.FindingsGroup,
            Finding: finding.Finding,
            Priority: finding.Priority,
            count: 0,
            details: []
          };
        }
        findingsByCheck[checkId].count++;
        findingsByCheck[checkId].details.push(finding);
      });

      const errorsFound = criticalFindings > 0 || warningFindings > 0;

      return {
        success: true,
        message: `sp_Blitz executed successfully. Found ${totalFindings} finding(s)` +
          (criticalFindings ? ` (${criticalFindings} critical, ${warningFindings} warnings, ${infoFindings} informational)` : ""),
        errorsFound,
        details: {
          totalFindings,
          criticalFindings,
          warningFindings,
          infoFindings,
          findingsByCheck: Object.values(findingsByCheck),
          allFindings: findings
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          message: `Failed to execute sp_Blitz: ${error.message}`,
        };
      } else {
        return {
          success: false,
          message: `Failed to execute sp_Blitz: ${String(error)}`,
        };
      }
    }
  }
}