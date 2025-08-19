#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";

// Internal imports
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { DBA_InsertDataTool } from "./tools/DBA_InsertDataTool.js";  // Enhanced DBA tool
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { DBA_ReadDataTool } from "./tools/DBA_ReadDataTool.js";  // Enhanced DBA read tool
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { ListTableTool } from "./tools/ListTableTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";

import { CheckDBTool } from "./tools/CheckDBTool.js";
import { sp_WhoisActiveTool } from "./tools/sp_WhoisactiveTool.js";
import { sp_BlitzTool } from "./tools/sp_BlitzTool.js";
import { sp_PressureDetectorTool } from "./tools/sp_PressureDetectorTool.js";
import { AgentJobHealthTool } from "./tools/AgentJobHealthTool.js";
import { AvailabilityGroupsTool } from "./tools/AvailabilityGroupsTool.js";
import { BackupStatusTool } from "./tools/BackupStatusTool.js";
import { CheckConnectivityTool } from "./tools/CheckConnectivityTool.js";
import { DatabaseStatusTool } from "./tools/DatabaseStatusTool.js";
import { IOHotspotsTool } from "./tools/IOHotspotsTool.js";
import { IndexUsageStatsTool } from "./tools/IndexUsageStatsTool.js";
import { QueryPlanTool } from "./tools/QueryPlanTool.js";
import { StatisticsUpdateTool } from "./tools/StatisticsUpdateTool.js";
import { WaitStatsTool } from "./tools/WaitStatsTool.js";
import { CreateAlertsTool } from "./tools/CreateAlertsTool.js";
import { DiagnosticQueriesTool } from "./tools/DiagnosticQueriesTool.js";
import { MaintenanceSolutionTool } from "./tools/MaintenanceSolutionTool.js";
import { HealthCheckReportTool } from "./tools/HealthCheckReportTool.js";

// Import partition tools
import { 
  CreatePartitionFunctionTool,
  CreatePartitionSchemeTool,
  DropPartitionFunctionTool,
  DropPartitionSchemeTool,
  ListPartitionFunctionsTool 
} from "./tools/PartitionTools.js";

// MSSQL Database connection configuration
// const credential = new DefaultAzureCredential();
// Globals for connection and token reuse
let globalSqlPool: any = null;
let globalAccessToken: string | null = null;
let globalTokenExpiresOn: Date | null = null;

// Function to create SQL config with fresh access token, returns token and expiry
export async function createSqlConfig(serverName?: string) {
    const servers = process.env.SERVER_LIST?.split(",") ?? [];
    const selectedServer = serverName || servers[0]; // Use arg or default to first

    const config = {
        server: selectedServer,
        database: process.env.DATABASE_NAME || "",
        user: process.env.SQL_USER || "",
        password: process.env.SQL_PASSWORD || "",
        // Add timeout configurations for large table operations
        connectionTimeout: 30000,  // 30 seconds for connection
        requestTimeout: 3600000,   // 60 minutes for query execution (updated from 10 minutes)
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
            acquireTimeoutMillis: 60000
        },
        options: {
            encrypt: false,
            trustServerCertificate: false,
            enableArithAbort: true,
            // Add additional query options for better performance
            abortTransactionOnError: true
        },
    };

    if (!config.server || !config.database || !config.user || !config.password) {
        throw new Error("Missing required environment variables: SERVER_LIST, DATABASE_NAME, SQL_USER, SQL_PASSWORD");
    }

    return config;
}

// Initialize all tool instances
const updateDataTool = new UpdateDataTool();
const insertDataTool = new InsertDataTool();
const dbaInsertDataTool = new DBA_InsertDataTool();  // Enhanced DBA tool
const readDataTool = new ReadDataTool();
const dbaReadDataTool = new DBA_ReadDataTool();  // Enhanced DBA read tool
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const listTableTool = new ListTableTool();
const dropTableTool = new DropTableTool();
const describeTableTool = new DescribeTableTool();

const checkDBTool = new CheckDBTool();
const sp_whoisactiveTool = new sp_WhoisActiveTool();
const sp_blitzTool = new sp_BlitzTool();
const sp_pressureDetectorTool = new sp_PressureDetectorTool();
const agentJobHealthTool = new AgentJobHealthTool();
const availabilityGroupsTool = new AvailabilityGroupsTool();
const backupStatusTool = new BackupStatusTool();
const checkConnectivityTool = new CheckConnectivityTool();
const databaseStatusTool = new DatabaseStatusTool();
const ioHotspotsTool = new IOHotspotsTool();
const indexUsageStatsTool = new IndexUsageStatsTool();
const queryPlanTool = new QueryPlanTool();
const statisticsUpdateTool = new StatisticsUpdateTool();
const waitStatsTool = new WaitStatsTool();
const createAlertsTool = new CreateAlertsTool();
const diagnosticQueriesTool = new DiagnosticQueriesTool();
const maintenanceSolutionTool = new MaintenanceSolutionTool();
const healthCheckReportTool = new HealthCheckReportTool();

// Initialize partition tools
const createPartitionFunctionTool = new CreatePartitionFunctionTool();
const createPartitionSchemeTool = new CreatePartitionSchemeTool();
const dropPartitionFunctionTool = new DropPartitionFunctionTool();
const dropPartitionSchemeTool = new DropPartitionSchemeTool();
const listPartitionFunctionsTool = new ListPartitionFunctionsTool();

const server = new Server({
    name: "mssql-mcp-server",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});

// Read READONLY env variable
const isReadOnly = process.env.READONLY === "true";

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: isReadOnly
        ? [
            // Read-only tools for monitoring and analysis
            listTableTool, 
            readDataTool,
            dbaReadDataTool,  // Enhanced DBA read tool for diagnostics
            describeTableTool, 
            dbaInsertDataTool,  // Enhanced DBA tool available in read-only mode for monitoring
            listPartitionFunctionsTool,
            sp_whoisactiveTool, 
            sp_blitzTool, 
            sp_pressureDetectorTool,
            agentJobHealthTool,
            availabilityGroupsTool,
            backupStatusTool,
            checkConnectivityTool,
            databaseStatusTool,
            ioHotspotsTool,
            indexUsageStatsTool,
            queryPlanTool,
            waitStatsTool,
            healthCheckReportTool
        ]
        : [
            // All tools including write operations
            insertDataTool, 
            dbaInsertDataTool,  // Enhanced DBA tool with full functionality
            readDataTool,
            dbaReadDataTool,  // Enhanced DBA read tool for diagnostics
            describeTableTool, 
            updateDataTool, 
            createTableTool, 
            createIndexTool, 
            dropTableTool, 
            listTableTool, 
            // Partition tools
            createPartitionFunctionTool,
            createPartitionSchemeTool,
            dropPartitionFunctionTool,
            dropPartitionSchemeTool,
            listPartitionFunctionsTool,
            checkDBTool, 
            sp_whoisactiveTool, 
            sp_blitzTool, 
            sp_pressureDetectorTool,
            agentJobHealthTool,
            availabilityGroupsTool,
            backupStatusTool,
            checkConnectivityTool,
            databaseStatusTool,
            ioHotspotsTool,
            indexUsageStatsTool,
            queryPlanTool,
            statisticsUpdateTool,
            waitStatsTool,
            createAlertsTool
        ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case insertDataTool.name:
                result = await insertDataTool.run(args);
                break;
            case dbaInsertDataTool.name:  // Enhanced DBA tool handler
                result = await dbaInsertDataTool.run(args);
                break;
            case readDataTool.name:
                result = await readDataTool.run(args);
                break;
            case dbaReadDataTool.name:  // Enhanced DBA read tool handler
                result = await dbaReadDataTool.run(args);
                break;
            case updateDataTool.name:
                result = await updateDataTool.run(args);
                break;
            case createTableTool.name:
                result = await createTableTool.run(args);
                break;
            case createIndexTool.name:
                result = await createIndexTool.run(args);
                break;
            case listTableTool.name:
                result = await listTableTool.run(args);
                break;
            case dropTableTool.name:
                result = await dropTableTool.run(args);
                break;
            case describeTableTool.name:
                if (!args || typeof args.tableName !== "string") {
                    return {
                        content: [{ type: "text", text: `Missing or invalid 'tableName' argument for describe_table tool.` }],
                        isError: true,
                    };
                }
                result = await describeTableTool.run(args as { tableName: string });
                break;

            // Partition tool cases
            case createPartitionFunctionTool.name:
                result = await createPartitionFunctionTool.run(args as any);
                break;
            case createPartitionSchemeTool.name:
                result = await createPartitionSchemeTool.run(args as any);
                break;
            case dropPartitionFunctionTool.name:
                result = await dropPartitionFunctionTool.run(args as any);
                break;
            case dropPartitionSchemeTool.name:
                result = await dropPartitionSchemeTool.run(args as any);
                break;
            case listPartitionFunctionsTool.name:
                result = await listPartitionFunctionsTool.run(args as any);
                break;
            case checkDBTool.name:
                result = await checkDBTool.run(args);
                break;
            case sp_whoisactiveTool.name:
                result = await sp_whoisactiveTool.run(args);
                break;
            case sp_blitzTool.name:
                result = await sp_blitzTool.run(args);
                break;
            case sp_pressureDetectorTool.name:
                result = await sp_pressureDetectorTool.run(args);
                break;
            case agentJobHealthTool.name:
                result = await agentJobHealthTool.run(args);
                break;
            case availabilityGroupsTool.name:
                result = await availabilityGroupsTool.run(args);
                break;
            case backupStatusTool.name:
                result = await backupStatusTool.run(args);
                break;
            case checkConnectivityTool.name:
                result = await checkConnectivityTool.run(args);
                break;
            case databaseStatusTool.name:
                result = await databaseStatusTool.run(args);
                break;
            case ioHotspotsTool.name:
                result = await ioHotspotsTool.run(args);
                break;
            case indexUsageStatsTool.name:
                result = await indexUsageStatsTool.run(args);
                break;
            case queryPlanTool.name:
                result = await queryPlanTool.run(args);
                break;
            case statisticsUpdateTool.name:
                result = await statisticsUpdateTool.run(args);
                break;
            case waitStatsTool.name:
                result = await waitStatsTool.run(args);
                break;
            case createAlertsTool.name:
                result = await createAlertsTool.run(args);
                break;
            case diagnosticQueriesTool.name:
                result = await diagnosticQueriesTool.run(args);
                break;
            case maintenanceSolutionTool.name:
                result = await maintenanceSolutionTool.run(args);
                break;
            case healthCheckReportTool.name:
                result = await healthCheckReportTool.run(args);
                break;
            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error occurred: ${error}` }],
            isError: true,
        };
    }
});

// Server startup
async function runServer() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    catch (error) {
        console.error("Fatal error running server:", error);
        process.exit(1);
    }
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});

// Connect to SQL only when handling a request
import sql from "mssql";

async function ensureSqlConnection(serverName?: string) {
    if (globalSqlPool && globalSqlPool.connected) {
        return;
    }

    if (globalSqlPool) {
        try {
            await globalSqlPool.close();
        } catch (e) {
            console.warn("Failed to close old pool:", e);
        }
    }

    const config = await createSqlConfig(serverName);
    globalSqlPool = await sql.connect(config);
}

// Patch all tool handlers to ensure SQL connection before running
function wrapToolRun(tool: any) {
    const originalRun = tool.run.bind(tool);
    tool.run = async function (args: any) {
        const targetServer = args?.serverName;
        await ensureSqlConnection(targetServer);
        return originalRun(args);
    };
}

// Apply connection wrapper to all tools
[
    insertDataTool, 
    dbaInsertDataTool,  // Enhanced DBA tool
    readDataTool,
    dbaReadDataTool,  // Enhanced DBA read tool
    updateDataTool, 
    createTableTool, 
    createIndexTool, 
    dropTableTool, 
    listTableTool, 
    describeTableTool, 
    // Partition tools
    createPartitionFunctionTool,
    createPartitionSchemeTool,
    dropPartitionFunctionTool,
    dropPartitionSchemeTool,
    listPartitionFunctionsTool,
    checkDBTool, 
    sp_whoisactiveTool, 
    sp_blitzTool, 
    sp_pressureDetectorTool,
    agentJobHealthTool,
    availabilityGroupsTool,
    backupStatusTool,
    checkConnectivityTool,
    databaseStatusTool,
    ioHotspotsTool,
    indexUsageStatsTool,
    queryPlanTool,
    statisticsUpdateTool,
    waitStatsTool,
    createAlertsTool,
    diagnosticQueriesTool,
    maintenanceSolutionTool,
    healthCheckReportTool
].forEach(wrapToolRun);