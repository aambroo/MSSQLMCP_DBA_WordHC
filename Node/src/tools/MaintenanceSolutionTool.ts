import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";

function splitSqlBatches(script: string): string[] {
  const lines = script.split(/\r?\n/);
  const batches: string[] = [];
  let current: string[] = [];
  const goRegex = /^\s*GO\s*(?:--.*)?$/i;
  for (const line of lines) {
    if (goRegex.test(line)) {
      if (current.length > 0) {
        batches.push(current.join("\n"));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    batches.push(current.join("\n"));
  }
  return batches.filter(b => b.trim().length > 0);
}

function preprocessMaintenanceScript(raw: string, createJobs: 'Y' | 'N'): string {
  let text = raw.replace(/^\uFEFF/, ""); // strip BOM
  // Remove SQLCMD directives (mssql driver does not understand :setvar, :r, etc.)
  text = text
    .split(/\r?\n/)
    .filter(line => !/^\s*:\w+/i.test(line))
    .join("\n");

  // Replace SQLCMD variable references $(CreateJobs)
  text = text.replace(/\$\(CreateJobs\)/gi, `'${createJobs}'`);

  // Normalize and force T-SQL variable assignments for @CreateJobs
  // DECLARE @CreateJobs ... = 'Y'
  text = text.replace(
    /(DECLARE\s+@CreateJobs\s+[^=;]+?=\s*)'[^']*'/gi,
    `$1'${createJobs}'`
  );
  // SET @CreateJobs = 'Y'
  text = text.replace(
    /(SET\s+@CreateJobs\s*=\s*)'[^']*'/gi,
    `$1'${createJobs}'`
  );

  return text;
}

export class MaintenanceSolutionTool implements Tool {
  [key: string]: any;
  name = "ola_maintenance_solution";
  description = "Runs Ola Hallengren's MaintenanceSolution.sql to install or update maintenance objects. Defaults to CreateJobs = 'N'.";

  inputSchema = {
    type: "object",
    properties: {
      scriptPath: {
        type: "string",
        description: "Path to MaintenanceSolution.sql (default: Node/src/tsql/MaintenanceSolution.sql)"
      },
      createJobs: {
        type: "string",
        enum: ["Y", "N"],
        description: "Whether to create SQL Agent jobs. Defaults to 'N' per request.",
        default: "N"
      },
      stopOnError: {
        type: "boolean",
        description: "Stop execution on first error (default: true)",
        default: true
      }
    },
    required: []
  } as any;

  async run(params: any) {
    const {
      scriptPath = "Node/src/tsql/MaintenanceSolution.sql",
      createJobs = "N",
      stopOnError = true
    } = params || {};

    // Enforce default behavior to avoid accidental job creation
    const effectiveCreateJobs: 'Y' | 'N' = (createJobs === 'Y' || createJobs === 'N') ? createJobs : 'N';

    try {
      const raw = await readFile(scriptPath, { encoding: "utf8" });
      const preprocessed = preprocessMaintenanceScript(raw, effectiveCreateJobs);
      const batches = splitSqlBatches(preprocessed);

      const results: Array<{ batchIndex: number; rowsAffected?: number; error?: string }> = [];

      for (let i = 0; i < batches.length; i++) {
        const batchText = batches[i];
        try {
          const request = new sql.Request();
          const res: any = await request.batch(batchText);
          const rowsAffected = Array.isArray(res.rowsAffected) ? res.rowsAffected.reduce((a: number, b: number) => a + b, 0) : (res.rowsAffected || 0);
          results.push({ batchIndex: i, rowsAffected });
        } catch (err: any) {
          results.push({ batchIndex: i, error: err?.message || String(err) });
          if (stopOnError) break;
        }
      }

      const errors = results.filter(r => r.error);
      return {
        success: errors.length === 0,
        message: `Executed MaintenanceSolution with CreateJobs='${effectiveCreateJobs}'. Batches: ${results.length}. Errors: ${errors.length}.`,
        createJobs: effectiveCreateJobs,
        results
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to run MaintenanceSolution: ${err?.message || String(err)}`,
        error: err?.stack || err?.message || String(err)
      };
    }
  }
}


