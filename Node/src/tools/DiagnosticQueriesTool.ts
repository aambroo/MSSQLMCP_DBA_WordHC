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

export class DiagnosticQueriesTool implements Tool {
  [key: string]: any;
  name = "diagnostic_queries_2022";
  description = "Runs Glenn Berry's SQL Server 2022 Diagnostic Information Queries script and returns summarized results.";

  inputSchema = {
    type: "object",
    properties: {
      scriptPath: {
        type: "string",
        description: "Absolute path to the SQL script file. If omitted, a common default path is used."
      },
      maxRowsPerResult: {
        type: "integer",
        description: "Maximum rows to return per recordset to avoid large payloads (default: 100)",
        default: 100
      },
      stopOnError: {
        type: "boolean",
        description: "Stop execution on first error (default: false)",
        default: false
      }
    },
    required: []
  } as any;

  async run(params: any) {
    const {
      scriptPath = "Node/src/tsql/SQL Server 2022 Diagnostic Information Queries.sql",
      maxRowsPerResult = 100,
      stopOnError = false
    } = params || {};

    try {
      const sqlText = await readFile(scriptPath, { encoding: "utf8" });
      const batches = splitSqlBatches(sqlText);

      const batchSummaries: Array<{
        batchIndex: number;
        statementPreview: string;
        recordsetCount: number;
        rowCounts: number[];
        sampleData?: any[];
        error?: string;
      }> = [];

      for (let i = 0; i < batches.length; i++) {
        const batchText = batches[i];
        const preview = batchText.slice(0, 200).replace(/\s+/g, " ").trim();
        try {
          const request = new sql.Request();
          const result = await request.batch(batchText);
          const recordsetsArray: any[] = Array.isArray((result as any).recordsets)
            ? (result as any).recordsets
            : (result && (result as any).recordsets && typeof (result as any).recordsets === 'object')
              ? Object.values((result as any).recordsets)
              : [];
          const rowCounts: number[] = recordsetsArray.map((rs: any) => (Array.isArray(rs) ? rs.length : 0));
          // Collect a small sample: first recordset up to maxRowsPerResult
          const sample = recordsetsArray.length > 0 && Array.isArray(recordsetsArray[0])
            ? recordsetsArray[0].slice(0, Math.max(0, Math.min(maxRowsPerResult, 1000)))
            : [];

          batchSummaries.push({
            batchIndex: i,
            statementPreview: preview,
            recordsetCount: recordsetsArray.length,
            rowCounts,
            sampleData: sample
          });
        } catch (err: any) {
          batchSummaries.push({
            batchIndex: i,
            statementPreview: preview,
            recordsetCount: 0,
            rowCounts: [],
            error: err?.message || String(err)
          });
          if (stopOnError) break;
        }
      }

      const executedBatches = batchSummaries.length;
      const errors = batchSummaries.filter(b => b.error);
      const totalRecordsets = batchSummaries.reduce((sum, b) => sum + b.recordsetCount, 0);

      return {
        success: errors.length === 0,
        message: `Executed ${executedBatches} batch(es) from diagnostic script. Total recordsets: ${totalRecordsets}. Errors: ${errors.length}.`,
        executedBatches,
        totalRecordsets,
        errors: errors.map(e => ({ batchIndex: e.batchIndex, error: e.error, preview: e.statementPreview })),
        summaries: batchSummaries
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to run diagnostic queries: ${err?.message || String(err)}`,
        error: err?.stack || err?.message || String(err)
      };
    }
  }
}


