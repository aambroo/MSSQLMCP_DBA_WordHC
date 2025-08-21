# MSSQL Database MCP Server

<div align="center">
  <img src="./src/img/logo.png" alt="MSSQL Database MCP server logo" width="400"/>
</div>

## What is this? 🤔

This is a server that lets your LLMs (like Claude) talk directly to your MSSQL Database data! Think of it as a friendly translator that sits between your AI assistant and your database, making sure they can chat securely and efficiently.

### Quick Example
```text
You: "Show me all customers from New York"
Claude: *queries your MSSQL Database database and gives you the answer in plain English*
```

## How Does It Work? 🛠️

This server leverages the Model Context Protocol (MCP), a versatile framework that acts as a universal translator between AI models and databases. It supports multiple AI assistants including Claude Desktop and VS Code Agent.

### What Can It Do? 📊

- Run MSSQL Database queries by just asking questions in plain English
- Create, read, update, and delete data
- Manage database schema (tables, indexes)
- Secure connection handling
- Real-time data interaction
- **Database Health Checks and Diagnostics**
- **SQL Server Agent Management**
- **Performance Monitoring and Analysis**
- **Maintenance Solution Installation**

## Available Tools 🛠️

### Data Operations
- `insert_data` - Insert data into tables
- `read_data` - Read data with security validation
- `update_data` - Update existing data
- `create_table` - Create new tables
- `drop_table` - Drop tables
- `list_tables` - List all tables
- `describe_table` - Get table structure

### Database Management
- `create_index` - Create indexes
- `create_alerts` - Configure SQL Server Agent alerts
- `ola_maintenance_solution` - Install Ola Hallengren's maintenance solution

### Monitoring & Diagnostics
- `health_check_report_it` - **Complete health check report in Italian**
- `diagnostic_queries_2022` - Run Glenn Berry's diagnostic queries
- `sp_blitz` - Execute sp_Blitz health checks
- `sp_whoisactive` - Get current activity
- `sp_pressure_detector` - Check system pressure
- `agent_job_health` - Monitor SQL Agent jobs
- `backup_status` - Check backup status
- `database_status` - Check database states
- `wait_stats` - Analyze wait statistics
- `io_hotspots` - Identify I/O bottlenecks
- `index_usage_stats` - Analyze index usage
- `query_plan` - Get query execution plans

### Partition Management
- `create_partition_function` - Create partition functions
- `create_partition_scheme` - Create partition schemes
- `drop_partition_function` - Drop partition functions
- `drop_partition_scheme` - Drop partition schemes
- `list_partition_functions` - List partition functions

## Health Check Report Tool 🏥

The `health_check_report_it` tool generates comprehensive health check reports in Italian, including:

### System Overview
- SQL Server version and configuration
- Operating system information
- Hardware specifications
- Memory usage
- Storage analysis

### Database Configuration
- Database states and recovery models
- Backup strategies
- Index maintenance status

### Performance Analysis
- I/O stalls per database file
- CPU usage per database
- Memory usage per database
- Virtual log files (VLF) analysis
- Wait types analysis
- Locking queries
- Long-running queries
- Index fragmentation
- Deadlock analysis

### Usage Examples

**For Agents:**
```json
{
  "name": "health_check_report_it",
  "arguments": {
    "saveToFile": true,
    "outputPath": "./reports/health_check.md",
    "topRows": 20
  }
}
```

**Natural Language Commands:**
- "Esegui un health check completo dell'istanza SQL Server"
- "Genera un report di diagnostica del database e salvalo"
- "Fai un'analisi completa delle performance del sistema"

## Quick Start 🚀

### Prerequisites
- Node.js 14 or higher
- Claude Desktop or VS Code with Agent extension

### Set up project

1. **Install Dependencies**  
   Run the following command in the root folder to install all necessary dependencies:  
   ```bash
   npm install
   ```

2. **Build the Project**  
   Compile the project by running:  
   ```bash
   npm run build
   ```

## Configuration Setup

### Environment Variables

The server uses the following environment variables:

- `SERVER_LIST` - Comma-separated list of SQL Server instances
- `DATABASE_NAME` - Default database name
- `SQL_USER` - SQL Server username
- `SQL_PASSWORD` - SQL Server password
- `READONLY` - Set to "true" for read-only mode

### Option 1: VS Code Agent Setup

1. **Install VS Code Agent Extension**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Agent" and install the official Agent extension

2. **Create MCP Configuration File**
   - Create a `.vscode/mcp.json` file in your workspace
   - Add the following configuration:

   ```json
   {
     "servers": {
       "mssql-nodejs": {
          "type": "stdio",
          "command": "node",
          "args": ["path/to/your/Node/dist/index.js"],
          "env": {
            "SERVER_LIST": "your-server1.database.windows.net,your-server2.database.windows.net",
            "DATABASE_NAME": "your-database-name",
            "SQL_USER": "your-username",
            "SQL_PASSWORD": "your-password",
            "READONLY": "false"
          }
        }
      }
   }
   ```

3. **Alternative: User Settings Configuration**
   - Open VS Code Settings (Ctrl+,)
   - Search for "mcp"
   - Click "Edit in settings.json"
   - Add the following configuration:

  ```json
   {
    "mcp": {
        "servers": {
            "mssql": {
                "command": "node",
                "args": ["path/to/your/Node/dist/index.js"],
                "env": {
                "SERVER_LIST": "your-server.database.windows.net",
                "DATABASE_NAME": "your-database-name",
                "SQL_USER": "your-username",
                "SQL_PASSWORD": "your-password",
                "READONLY": "false"
                }
            }
        }
    }
  }
  ```

4. **Restart VS Code**
   - Close and reopen VS Code for the changes to take effect

5. **Verify MCP Server**
   - Open Command Palette (Ctrl+Shift+P)
   - Run "MCP: List Servers" to verify your server is configured
   - You should see "mssql" in the list of available servers

### Option 2: Claude Desktop Setup

1. **Open Claude Desktop Settings**
   - Navigate to File → Settings → Developer → Edit Config
   - Open the `claude_desktop_config` file

2. **Add MCP Server Configuration**
   Replace the content with the configuration below, updating the path and credentials:

   ```json
   {
     "mcpServers": {
       "mssql": {
         "command": "node",
         "args": ["path/to/your/Node/dist/index.js"],
         "env": {
           "SERVER_LIST": "your-server.database.windows.net",
           "DATABASE_NAME": "your-database-name",
           "SQL_USER": "your-username",
           "SQL_PASSWORD": "your-password",
           "READONLY": "false"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**
   - Close and reopen Claude Desktop for the changes to take effect

## Sample Configurations

You can find sample configuration files in the `src/samples/` folder:
- `claude_desktop_config.json` - For Claude Desktop
- `vscode_agent_config.json` - For VS Code Agent

## Usage Examples

### Basic Data Operations
Once configured, you can interact with your database using natural language:

- "Show me all users from New York"
- "Create a new table called products with columns for id, name, and price"
- "Update all pending orders to completed status"
- "List all tables in the database"

### Health Check and Diagnostics
- "Esegui un health check completo dell'istanza SQL Server"
- "Genera un report di diagnostica e salvalo in un file"
- "Analizza le performance del database"
- "Controlla lo stato dei backup"
- "Verifica la frammentazione degli indici"

### Maintenance Operations
- "Installa la maintenance solution di Ola Hallengren"
- "Configura gli alert di SQL Server Agent"
- "Esegui sp_Blitz per controlli di salute"

## Agent Integration Guide 🤖

### How to Use with AI Agents

**Important:** Tools are called via MCP protocol, not SQL queries.

❌ **Wrong (SQL approach):**
```sql
EXEC health_check_report_it @saveToFile = 1
```

✅ **Correct (MCP approach):**
```json
{
  "name": "health_check_report_it",
  "arguments": {
    "saveToFile": true,
    "topRows": 20
  }
}
```

### Common Agent Commands

**Health Check:**
```
"Esegui un health check completo dell'istanza SQL Server usando il tool health_check_report_it. Salva il report in un file e restituiscimi il contenuto."
```

**Database Diagnostics:**
```
"Usa il tool diagnostic_queries_2022 per eseguire le query di diagnostica di Glenn Berry."
```

**Performance Analysis:**
```
"Analizza le performance del database usando sp_blitz e sp_whoisactive."
```

## Security Notes 🔒

- The server requires a WHERE clause for read operations to prevent accidental full table scans
- Update operations require explicit WHERE clauses for security
- Set `READONLY: "true"` in production environments if you only need read access
- Health check tools are read-only and safe for production use
- Maintenance tools require write permissions and should be used carefully

## Troubleshooting 🔧

### Common Issues

1. **"Security validation failed"**
   - Ensure you're using MCP tools, not SQL queries
   - Check that your query includes proper WHERE clauses

2. **Connection errors**
   - Verify SERVER_LIST, DATABASE_NAME, SQL_USER, and SQL_PASSWORD
   - Check network connectivity to SQL Server

3. **Tool not found**
   - Ensure the tool name matches exactly (case-sensitive)
   - Check that the tool is available in your mode (read-only vs full access)

### Build Issues

If you encounter build errors:
```bash
npm install
npm run build
```

## Contributing 🤝

This project supports a comprehensive set of SQL Server management and monitoring tools. Feel free to contribute additional tools or improvements!

You should now have successfully configured the MCP server for MSSQL Database with your preferred AI assistant. This setup allows you to seamlessly interact with MSSQL Database through natural language queries and perform comprehensive health checks and diagnostics!
