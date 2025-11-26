# MyBatis Boost MCP Server

This document explains how to use the MyBatis Boost MCP (Model Context Protocol) server with Cursor IDE and other MCP-compatible AI tools.

## Overview

MyBatis Boost provides two ways to access its code generation capabilities:

1. **VS Code Language Model Tools** - Built-in tools for GitHub Copilot in VS Code (1.99+)
2. **stdio MCP Server** - Standalone server for Cursor IDE and other MCP-compatible tools

## stdio MCP Server

The stdio MCP server runs as a separate process and communicates via JSON-RPC 2.0 over standard input/output. This makes it compatible with any AI tool that supports the Model Context Protocol.

### Supported Tools

The MCP server provides 4 tools:

#### 1. `mybatis_parse_sql_and_generate`
Parse DDL SQL statement and generate MyBatis code.

**Input:**
```json
{
  "ddl": "CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(50));"
}
```

**Output:**
```json
{
  "success": true,
  "results": [
    {
      "name": "UserPO.java",
      "outputPath": "/path/to/UserPO.java",
      "content": "...",
      "type": "java"
    },
    ...
  ]
}
```

#### 2. `mybatis_export_generated_files`
Export generated files to disk.

**Input:**
```json
{
  "ddl": "CREATE TABLE ...",
  "results": [ /* array from parse_sql_and_generate */ ]
}
```

#### 3. `mybatis_query_generation_history`
Query past code generations.

**Input:**
```json
{
  "limit": 10
}
```

#### 4. `mybatis_parse_and_export`
Combined operation - parse and export in one step.

**Input:**
```json
{
  "ddl": "CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(50));"
}
```

## Configuration

### For Cursor IDE

1. **Compile the extension:**
   ```bash
   pnpm run compile
   ```

2. **Copy the example config:**
   ```bash
   cp mcp-config.example.json ~/.cursor/mcp-config.json
   ```

3. **Edit the configuration:**
   ```json
   {
     "mcpServers": {
       "mybatis-boost": {
         "command": "node",
         "args": [
           "/absolute/path/to/mybatis-boost/dist/mcp/stdio/server.js"
         ],
         "env": {
           "MYBATIS_BASE_PACKAGE": "com.example.mybatis",
           "MYBATIS_AUTHOR": "Your Name",
           "MYBATIS_OUTPUT_DIR": "/path/to/your/project",
           "MYBATIS_USE_LOMBOK": "true",
           "MYBATIS_DATETIME": "LocalDateTime"
         }
       }
     }
   }
   ```

4. **Restart Cursor IDE**

### For Claude Desktop (Anthropic)

1. **Compile the extension** (same as above)

2. **Edit Claude Desktop config:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

3. **Add the server:**
   ```json
   {
     "mcpServers": {
       "mybatis-boost": {
         "command": "node",
         "args": [
           "/absolute/path/to/mybatis-boost/dist/mcp/stdio/server.js"
         ],
         "env": {
           "MYBATIS_BASE_PACKAGE": "com.example.mybatis",
           "MYBATIS_AUTHOR": "Your Name",
           "MYBATIS_OUTPUT_DIR": "/path/to/your/project"
         }
       }
     }
   }
   ```

## Environment Variables

Configure the server behavior using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MYBATIS_BASE_PACKAGE` | `com.example.mybatis` | Base Java package name |
| `MYBATIS_AUTHOR` | `MyBatis Boost` | Author name in generated files |
| `MYBATIS_OUTPUT_DIR` | Current directory | Output directory for generated files |
| `MYBATIS_USE_LOMBOK` | `true` | Use Lombok annotations |
| `MYBATIS_USE_SWAGGER` | `false` | Use Swagger annotations |
| `MYBATIS_USE_SWAGGER_V3` | `false` | Use Swagger v3 annotations |
| `MYBATIS_USE_MYBATIS_PLUS` | `false` | Use MyBatis-Plus |
| `MYBATIS_ENTITY_SUFFIX` | `PO` | Entity class suffix |
| `MYBATIS_MAPPER_SUFFIX` | `Mapper` | Mapper interface suffix |
| `MYBATIS_SERVICE_SUFFIX` | `Service` | Service class suffix |
| `MYBATIS_DATETIME` | `LocalDateTime` | Date/time type (`Date`, `LocalDateTime`, or `Instant`) |

## Usage Examples

### With Cursor IDE

Once configured, you can use natural language to generate code:

```
User: "Parse this SQL and generate MyBatis code:
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  created_at DATETIME
);"

AI: [Uses mybatis_parse_sql_and_generate tool]
```

```
User: "Export the generated files to my project"

AI: [Uses mybatis_export_generated_files tool]
```

```
User: "Show me the last 5 generations"

AI: [Uses mybatis_query_generation_history tool]
```

## History Storage

The MCP server stores generation history in:
- **Location:** `~/.mybatis-boost/mcp-history.json`
- **Max records:** 30
- **Format:** JSON with full file content for preview

## Troubleshooting

### Server not starting

1. Check that the compiled server exists:
   ```bash
   ls -la dist/mcp/stdio/server.js
   ```

2. Test the server manually:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/mcp/stdio/server.js
   ```

3. Check stderr for error messages (server logs to stderr)

### Configuration not applied

1. Verify environment variables are set correctly
2. Restart the AI tool completely
3. Check the AI tool's logs for MCP server errors

### Files not being generated

1. Check `MYBATIS_OUTPUT_DIR` path is absolute and exists
2. Verify write permissions to output directory
3. Check the history file for saved generations:
   ```bash
   cat ~/.mybatis-boost/mcp-history.json
   ```

## Architecture

The MCP server is built on a layered architecture:

```
stdio server (JSON-RPC 2.0)
    ↓
Request Handlers
    ↓
Core Services (shared with VS Code tools)
    ├── GeneratorService
    ├── FileExportService
    └── HistoryService
```

This design allows the same generation logic to be used by both VS Code Language Model Tools and the stdio MCP server.

## Development

### Running in development

```bash
# Compile TypeScript
pnpm run compile

# Test the server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/mcp/stdio/server.js
```

### Adding new tools

1. Add handler method in `src/mcp/stdio/handlers.ts`
2. Register tool in `handleToolsList()`
3. Add case in `handleToolCall()`
4. Recompile and test

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/young1lin/mybatis-boost/issues
- Documentation: https://github.com/young1lin/mybatis-boost/blob/main/README.md
