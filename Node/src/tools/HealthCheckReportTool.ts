import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DatabaseStatusTool } from "./DatabaseStatusTool.js";
import { BackupStatusTool } from "./BackupStatusTool.js";
import { WaitStatsTool } from "./WaitStatsTool.js";
import { IndexUsageStatsTool } from "./IndexUsageStatsTool.js";
import { AgentJobHealthTool } from "./AgentJobHealthTool.js";
import { IOHotspotsTool } from "./IOHotspotsTool.js";

type Section = string;

async function safeQuery(query: string): Promise<any[]> {
  try {
    const request = new sql.Request();
    const res = await request.query(query);
    return res.recordset || [];
  } catch {
    return [];
  }
}

function formatList(items: string[], indent = 0): string {
  const pad = "".padStart(indent);
  return items.map(i => `${pad}- ${i}`).join("\n");
}

function mdEscape(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text).replace(/\|/g, "\\|");
}

function table(headers: string[], rows: any[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(r => `| ${r.map(mdEscape).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

export class HealthCheckReportTool implements Tool {
  [key: string]: any;
  name = "health_check_report_it";
  description = "Genera un report di Health Check completo dell'istanza SQL Server in italiano, utilizzando query mirate e strumenti esistenti.";

  inputSchema = {
    type: "object",
    properties: {
      includeWhoIsActive: {
        type: "boolean",
        description: "Se true, tenta di includere informazioni da sp_WhoIsActive se disponibile",
        default: false
      },
      topRows: {
        type: "integer",
        description: "Numero di righe per sezioni tabellari (default 20)",
        default: 20
      }
    },
    required: []
  } as any;

  async run(params: any) {
    const topRows: number = Math.max(1, Math.min(100, params?.topRows ?? 20));

    // Instantiate existing tools we will leverage
    const dbStatusTool = new DatabaseStatusTool();
    const backupTool = new BackupStatusTool();
    const waitStatsTool = new WaitStatsTool();
    const indexUsageTool = new IndexUsageStatsTool();
    const agentJobsTool = new AgentJobHealthTool();
    const ioHotspotsTool = new IOHotspotsTool();

    // Collect system overview info
    const [
      versionInfo,
      hostInfo,
      hwInfo,
      memInfo,
      volumeInfo,
      vfsLatency,
    ] = await Promise.all([
      safeQuery("SELECT @@SERVERNAME AS ServerName, @@VERSION AS VersionInfo;"),
      safeQuery("SELECT host_platform, host_distribution, host_release, host_service_pack_level, host_sku, os_language_version, host_architecture FROM sys.dm_os_host_info;"),
      safeQuery("SELECT cpu_count, scheduler_count, (socket_count * cores_per_socket) AS physical_core_count, socket_count, cores_per_socket, numa_node_count, physical_memory_kb/1024 AS physical_memory_mb, max_workers_count, sqlserver_start_time FROM sys.dm_os_sys_info;"),
      safeQuery("SELECT total_physical_memory_kb/1024 AS physical_mb, available_physical_memory_kb/1024 AS available_mb, system_memory_state_desc FROM sys.dm_os_sys_memory;"),
      safeQuery("SELECT DISTINCT vs.volume_mount_point, vs.file_system_type, vs.logical_volume_name, CAST(vs.total_bytes/1073741824.0 AS DECIMAL(18,2)) AS total_gb, CAST(vs.available_bytes/1073741824.0 AS DECIMAL(18,2)) AS free_gb, CAST(vs.available_bytes * 1.0 / vs.total_bytes * 100.0 AS DECIMAL(5,2)) AS free_pct FROM sys.master_files AS f CROSS APPLY sys.dm_os_volume_stats(f.database_id, f.[file_id]) AS vs ORDER BY vs.volume_mount_point;"),
      safeQuery("SELECT TOP(1000) DB_NAME(fs.database_id) AS database_name, df.name AS logical_name, vfs.file_id, df.type_desc, df.physical_name, CAST(vfs.size_on_disk_bytes/1048576.0 AS DECIMAL(15,2)) AS size_mb, vfs.num_of_reads, vfs.num_of_writes, vfs.io_stall_read_ms, vfs.io_stall_write_ms FROM sys.dm_io_virtual_file_stats(DB_ID(), NULL) AS vfs INNER JOIN sys.database_files AS df ON vfs.file_id = df.file_id INNER JOIN sys.dm_io_virtual_file_stats(NULL,NULL) AS fs ON 1=1 WHERE DB_ID() IS NOT NULL;"),
    ]);

    // Database configuration
    const dbStatus = await dbStatusTool.run({});

    // Maintenance info
    const backupStatus = await backupTool.run({});
    const agentJobs = await agentJobsTool.run({});

    // Performance sections
    const [
      ioStallsByFile,
      cpuByDb,
      ioByDb,
      memByDb,
      vlfCounts,
      waits,
      locking,
      longRunning,
      indexHealth,
      deadlockCount
    ] = await Promise.all([
      safeQuery(`SELECT DB_NAME(DB_ID()) AS [Database Name], df.name AS [Logical Name], vfs.file_id, df.type_desc, df.physical_name, CAST(vfs.size_on_disk_bytes/1048576.0 AS DECIMAL(15, 2)) AS [Size on Disk (MB)], vfs.num_of_reads, vfs.num_of_writes, vfs.io_stall_read_ms, vfs.io_stall_write_ms FROM sys.dm_io_virtual_file_stats(DB_ID(), NULL) AS vfs INNER JOIN sys.database_files AS df ON vfs.[file_id]= df.[file_id] ORDER BY (vfs.io_stall_read_ms + vfs.io_stall_write_ms) DESC;`),
      safeQuery(`WITH DB_CPU_Stats AS (SELECT CONVERT(int, value) AS DatabaseID, SUM(qs.total_worker_time/1000) AS CPU_Time_ms FROM sys.dm_exec_query_stats AS qs CROSS APPLY sys.dm_exec_plan_attributes(qs.plan_handle) AS pa WHERE pa.attribute = N'dbid' GROUP BY CONVERT(int, value)) SELECT TOP(${topRows}) DB_NAME(DatabaseID) AS [Database Name], CPU_Time_ms FROM DB_CPU_Stats WHERE DatabaseID <> 32767 ORDER BY CPU_Time_ms DESC;`),
      safeQuery(`WITH Aggregate_IO_Statistics AS (SELECT DB_NAME(database_id) AS [Database Name], CAST(SUM(num_of_bytes_read + num_of_bytes_written) / 1048576 AS DECIMAL(12, 2)) AS ioTotalMB, CAST(SUM(num_of_bytes_read ) / 1048576 AS DECIMAL(12, 2)) AS ioReadMB, CAST(SUM(num_of_bytes_written) / 1048576 AS DECIMAL(12, 2)) AS ioWriteMB FROM sys.dm_io_virtual_file_stats(NULL, NULL) GROUP BY database_id) SELECT TOP(${topRows}) [Database Name], ioTotalMB, ioReadMB, ioWriteMB FROM Aggregate_IO_Statistics ORDER BY ioTotalMB DESC;`),
      safeQuery(`WITH AggregateBufferPoolUsage AS (SELECT DB_NAME(database_id) AS [Database Name], CAST(COUNT_BIG(*) * 8/1024.0 AS DECIMAL (15,2)) AS CachedSizeMB FROM sys.dm_os_buffer_descriptors GROUP BY DB_NAME(database_id)) SELECT TOP(${topRows}) [Database Name], CachedSizeMB FROM AggregateBufferPoolUsage ORDER BY CachedSizeMB DESC;`),
      safeQuery(`SELECT [name] AS [Database Name], [VLF Count] FROM sys.databases AS db CROSS APPLY (SELECT file_id, COUNT(*) AS [VLF Count] FROM sys.dm_db_log_info(db.database_id) GROUP BY file_id) AS li ORDER BY [VLF Count] DESC;`),
      waitStatsTool.run({}),
      safeQuery(`SELECT t1.resource_type AS [lock_type], DB_NAME(resource_database_id) AS [database], t1.resource_associated_entity_id AS [blk_object], t1.request_mode AS [lock_req], t1.request_session_id AS [waiter_sid], t2.wait_duration_ms AS [wait_time], t2.blocking_session_id AS [blocker_sid] FROM sys.dm_tran_locks AS t1 INNER JOIN sys.dm_os_waiting_tasks AS t2 ON t1.lock_owner_address = t2.resource_address;`),
      safeQuery(`SELECT TOP(${topRows}) DB_NAME(t.[dbid]) AS [Database Name], REPLACE(REPLACE(LEFT(t.[text], 200), CHAR(10),''), CHAR(13),'') AS [Short Query Text], qs.total_elapsed_time/qs.execution_count AS [Avg Elapsed Time ms], qs.total_elapsed_time AS [Total Elapsed Time ms], qs.execution_count FROM sys.dm_exec_query_stats AS qs CROSS APPLY sys.dm_exec_sql_text(plan_handle) AS t ORDER BY [Avg Elapsed Time ms] DESC;`),
      safeQuery(`SELECT TOP(${topRows}) DB_NAME(ps.database_id) AS [Database Name], SCHEMA_NAME(o.[schema_id]) AS [Schema Name], OBJECT_NAME(ps.OBJECT_ID) AS [Object Name], i.[name] AS [Index Name], CAST(ps.avg_fragmentation_in_percent AS DECIMAL (15,2)) AS [Avg Fragmentation %], ps.page_count FROM sys.dm_db_index_physical_stats(DB_ID(),NULL, NULL, NULL , N'LIMITED') AS ps INNER JOIN sys.indexes AS i ON ps.[object_id] = i.[object_id] AND ps.index_id = i.index_id INNER JOIN sys.objects AS o ON i.[object_id] = o.[object_id] WHERE ps.page_count > 2500 ORDER BY ps.avg_fragmentation_in_percent DESC;`),
      safeQuery(`WITH deadlocks AS (SELECT CAST(xevent_data AS XML) AS xmldata FROM (SELECT CAST(event_data AS XML) AS xevent_data FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL) WHERE object_name = 'xml_deadlock_report') AS tab) SELECT COUNT(*) AS deadlock_count FROM deadlocks;`)
    ]);

    // Summaries and formatting
    const overviewSqlServer: Section = (() => {
      const v = versionInfo[0] || {};
      return [
        "### SQL Server",
        formatList([
          `Server: ${v.ServerName || ''}`,
          `Versione: ${v.VersionInfo || ''}`
        ])
      ].join("\n");
    })();

    const overviewOS: Section = (() => {
      const h = hostInfo[0] || {};
      return [
        "### Sistema Operativo",
        formatList([
          `Piattaforma: ${h.host_platform || ''}`,
          `Distribuzione: ${h.host_distribution || ''} ${h.host_release || ''}`,
          `Architettura: ${h.host_architecture || ''}`
        ])
      ].join("\n");
    })();

    const overviewHW: Section = (() => {
      const hw = hwInfo[0] || {};
      return [
        "### Descrizione dell'hardware utilizzato",
        formatList([
          `Socket: ${hw.socket_count ?? ''}`,
          `Core per socket: ${hw.cores_per_socket ?? ''}`,
          `Core fisici: ${hw.physical_core_count ?? ''}`,
          `CPU logiche: ${hw.cpu_count ?? ''}`,
          `NUMA nodes: ${hw.numa_node_count ?? ''}`
        ])
      ].join("\n");
    })();

    const overviewRAM: Section = (() => {
      const m = memInfo[0] || {};
      return [
        "### Memoria RAM",
        formatList([
          `Totale: ${m.physical_mb ?? ''} MB`,
          `Disponibile: ${m.available_mb ?? ''} MB`,
          `Stato: ${m.system_memory_state_desc ?? ''}`
        ])
      ].join("\n");
    })();

    const storageDisks: Section = (() => {
      const headers = ["Mount", "FS", "Volume", "Totale (GB)", "Libero (GB)", "Libero %"];
      const rows = (volumeInfo || []).slice(0, topRows).map((r: any) => [r.volume_mount_point, r.file_system_type, r.logical_volume_name, r.total_gb, r.free_gb, r.free_pct]);
      return [
        "### Disk Sub-Systems",
        table(headers, rows)
      ].join("\n");
    })();

    const storageLatency: Section = (() => {
      const headers = ["DB", "File", "Tipo", "Reads", "Writes", "Stall Read ms", "Stall Write ms"];
      const rows = (ioStallsByFile || []).slice(0, topRows).map((r: any) => [r["Database Name"], r["Logical Name"], r.type_desc, r.num_of_reads, r.num_of_writes, r.io_stall_read_ms, r.io_stall_write_ms]);
      return [
        "### Latenze",
        table(headers, rows)
      ].join("\n");
    })();

    const dbConfig: Section = (() => {
      const list = (dbStatus?.databases || []).map((d: any) => `${d.name} — ${d.state_desc}, ${d.user_access_desc}, RO=${d.is_read_only}, RM=${d.recovery_model_desc}`);
      return [
        "## Configurazione dei database",
        list.length ? formatList(list.slice(0, 100)) : "Nessun dato disponibile"
      ].join("\n");
    })();

    const backupStrategy: Section = (() => {
      const sets = (backupStatus?.backups || []).slice(0, topRows).map((b: any) => `${b.Database} — Full: ${b["Last Full Backup"] ?? 'N/D'}, Diff: ${b["Last Differential Backup"] ?? 'N/D'}, Log: ${b["Last Log Backup"] ?? 'N/D'}`);
      return [
        "## Strategia di backup",
        sets.length ? formatList(sets) : "Nessuna informazione sui backup trovata"
      ].join("\n");
    })();

    const indexStats: Section = (() => {
      const data = (indexHealth || []).slice(0, topRows).map((r: any) => `${r["Database Name"]}.${r["Schema Name"]}.${r["Object Name"]} — ${r["Index Name"]} — Fragm: ${r["Avg Fragmentation %"]}% (pages ${r.page_count})`);
      return [
        "## Manutenzione indici e statistiche",
        data.length ? formatList(data) : "Nessun indice frammentato rilevato sopra soglia"
      ].join("\n");
    })();

    const perfIOStalls: Section = storageLatency.replace("### Latenze", "## IO Stalls per database file");

    const perfCPU: Section = (() => {
      const headers = ["Database", "CPU Time (ms)"];
      const rows = (cpuByDb || []).map((r: any) => [r["Database Name"], r.CPU_Time_ms]);
      return [
        "## Utilizzo della CPU per database",
        table(headers, rows)
      ].join("\n");
    })();

    const perfIO: Section = (() => {
      const headers = ["Database", "I/O Totale (MB)", "Read (MB)", "Write (MB)"];
      const rows = (ioByDb || []).map((r: any) => [r["Database Name"], r.ioTotalMB, r.ioReadMB, r.ioWriteMB]);
      return [
        "## Utilizzo dell'IO per database",
        table(headers, rows)
      ].join("\n");
    })();

    const perfMem: Section = (() => {
      const headers = ["Database", "Cached Size (MB)"];
      const rows = (memByDb || []).map((r: any) => [r["Database Name"], r.CachedSizeMB]);
      return [
        "## Utilizzo della memoria per database",
        table(headers, rows)
      ].join("\n");
    })();

    const perfVLF: Section = (() => {
      const headers = ["Database", "VLF Count"];
      const rows = (vlfCounts || []).slice(0, topRows).map((r: any) => [r["Database Name"], r["VLF Count"]]);
      return [
        "## Virtual log files",
        table(headers, rows)
      ].join("\n");
    })();

    const perfWaits: Section = (() => {
      const w = waitStatsTool && (waits as any);
      const arr = (w?.waits || w?.data || [] as any[]).slice(0, topRows);
      const headers = ["Wait Type", "Percentuale", "AvgWait (s)", "AvgRes (s)", "AvgSig (s)"];
      const rows = arr.map((x: any) => [x.WaitType || x.wait_type || '', x["Wait Percentage"] || '', x.AvgWait_Sec || '', x.AvgRes_Sec || '', x.AvgSig_Sec || '']);
      return [
        "## Wait types",
        rows.length ? table(headers, rows) : "Nessun dato sui wait types disponibile"
      ].join("\n");
    })();

    const perfLocking: Section = (() => {
      const headers = ["DB", "Tipo", "Req", "Waiter SID", "Wait ms", "Blocker SID"];
      const rows = (locking || []).slice(0, topRows).map((r: any) => [r.database, r.lock_type, r.lock_req, r.waiter_sid, r.wait_time, r.blocker_sid]);
      return [
        "## Locking queries",
        rows.length ? table(headers, rows) : "Nessun locking rilevato al momento"
      ].join("\n");
    })();

    const perfLongRunning: Section = (() => {
      const headers = ["DB", "Query", "Avg Elapsed (ms)", "Totale (ms)", "Esecuzioni"];
      const rows = (longRunning || []).map((r: any) => [r["Database Name"], r["Short Query Text"], r["Avg Elapsed Time ms"], r["Total Elapsed Time ms"], r.execution_count]);
      return [
        "## Long running queries",
        table(headers, rows)
      ].join("\n");
    })();

    const perfIndexState: Section = indexStats.replace("## Manutenzione indici e statistiche", "## Stato degli indici");

    const perfDeadlocks: Section = (() => {
      const c = (deadlockCount[0]?.deadlock_count) ?? 0;
      return [
        "## Analisi deadlock",
        `Eventi di deadlock recenti (system_health): ${c}`
      ].join("\n");
    })();

    const storageSection = [
      "## Storage",
      storageDisks,
      storageLatency
    ].join("\n\n");

    const manutenzioneSection = [
      "## Manutenzione dei database",
      backupStrategy,
      indexStats
    ].join("\n\n");

    const performanceSection = [
      "## Performance",
      perfIOStalls,
      perfCPU,
      perfIO,
      perfMem,
      perfVLF,
      perfWaits,
      perfLocking,
      perfLongRunning,
      perfIndexState,
      perfDeadlocks
    ].join("\n\n");

    const report = [
      "# Overview del sistema",
      overviewSqlServer,
      overviewOS,
      overviewHW,
      overviewRAM,
      storageSection,
      dbConfig,
      "# Manutenzione dei database",
      backupStrategy,
      "## Manutenzione indici e statistiche",
      indexStats,
      "# Performance",
      perfIOStalls,
      perfCPU,
      perfIO,
      perfMem,
      perfVLF,
      perfWaits,
      perfLocking,
      perfLongRunning,
      perfIndexState,
      perfDeadlocks
    ].join("\n\n");

    return {
      success: true,
      message: "Report di Health Check generato",
      reportMarkdown: report
    };
  }
}


