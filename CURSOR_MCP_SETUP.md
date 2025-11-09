# Cursor IDE MCP Setup Guide

This guide explains how to use MyBatis Boost MCP tools in Cursor IDE using the Extension API (no manual configuration required).

## Overview

MyBatis Boost automatically detects if it's running in Cursor IDE and registers MCP tools using Cursor's Extension API. This provides a seamless experience without needing to manually edit `mcp.json` files.

## Features

### Automatic Detection
- Automatically detects Cursor IDE environment
- Registers 4 MCP tools for MyBatis code generation
- Uses your VS Code extension settings

### Dynamic Enable/Disable
- Enable or disable MCP via settings: `mybatis-boost.mcp.enable`
- Changes take effect immediately (no restart required)
- Default: `enabled`

### 4 MCP Tools
1. **mybatis_parse_sql_and_generate** - Parse DDL and generate code
2. **mybatis_export_generated_files** - Export files to disk
3. **mybatis_query_generation_history** - Query past generations
4. **mybatis_parse_and_export** - Combined operation

## Setup

### 1. Install the Extension

Install MyBatis Boost from the VS Code Marketplace or VSIX file.

### 2. Configure Extension Settings

Open VS Code/Cursor settings and configure:

```json
{
  "mybatis-boost.mcp.enable": true,  // Enable MCP (default)
  "mybatis-boost.generator.basePackage": "com.your.package",
  "mybatis-boost.generator.author": "Your Name",
  "mybatis-boost.generator.useLombok": true,
  "mybatis-boost.generator.datetime": "LocalDateTime"
}
```

### 3. Start Using MCP Tools

Once installed, the extension automatically:
- Detects it's running in Cursor IDE
- Registers MCP tools via Cursor Extension API
- Loads configuration from extension settings

No manual `mcp.json` configuration needed!

## Usage Examples

### Parse SQL and Generate Code

Ask Cursor AI:
```
Parse this SQL and generate MyBatis code:
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL COMMENT 'Order number',
  user_id BIGINT NOT NULL COMMENT 'User ID',
  total_amount DECIMAL(10,2) NOT NULL COMMENT 'Total amount',
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

The AI will use the `mybatis_parse_sql_and_generate` tool to generate:
- Entity class (OrdersPO.java)
- Mapper interface (OrdersMapper.java)
- Mapper XML (OrdersMapper.xml)
- Service class (OrdersService.java)

### Export Generated Files

Ask Cursor AI:
```
Export the generated files to my project
```

The AI will use the `mybatis_export_generated_files` tool to write files to:
- `src/main/java/com/your/package/entity/`
- `src/main/java/com/your/package/mapper/`
- `src/main/java/com/your/package/service/`
- `src/main/resources/mapper/`

### Query History

Ask Cursor AI:
```
Show me the last 5 code generations
```

The AI will use the `mybatis_query_generation_history` tool.

## Enable/Disable MCP

### Via Settings UI

1. Open Settings (⌘, on Mac, Ctrl+, on Windows/Linux)
2. Search for "mybatis-boost.mcp.enable"
3. Toggle the checkbox
4. MCP tools are immediately registered/unregistered

### Via settings.json

```json
{
  "mybatis-boost.mcp.enable": false  // Disable MCP tools
}
```

### Check Status

Open Developer Console (Help → Toggle Developer Tools) and look for:
```
[MyBatis Boost] MCP Manager initialized (IDE: Cursor, Enabled: true)
```

## Configuration Reference

### MCP Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mybatis-boost.mcp.enable` | boolean | `true` | Enable/disable MCP tools |

### Generator Settings

These settings are automatically used by MCP tools:

| Setting | Default | Description |
|---------|---------|-------------|
| `mybatis-boost.generator.basePackage` | `com.example.mybatis` | Base package for generated code |
| `mybatis-boost.generator.author` | `MyBatis Boost` | Author name in file headers |
| `mybatis-boost.generator.entitySuffix` | `PO` | Entity class suffix |
| `mybatis-boost.generator.mapperSuffix` | `Mapper` | Mapper interface suffix |
| `mybatis-boost.generator.serviceSuffix` | `Service` | Service class suffix |
| `mybatis-boost.generator.useLombok` | `true` | Use Lombok annotations |
| `mybatis-boost.generator.useSwagger` | `false` | Use Swagger annotations |
| `mybatis-boost.generator.useSwaggerV3` | `false` | Use Swagger v3 (OpenAPI) |
| `mybatis-boost.generator.useMyBatisPlus` | `false` | Use MyBatis-Plus |
| `mybatis-boost.generator.datetime` | `LocalDateTime` | Date/time type (`Date`, `LocalDateTime`, `Instant`) |

## How It Works

### Architecture

```
┌──────────────────┐
│   Cursor IDE     │
│   AI Assistant   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│  MyBatis Boost Extension         │
│  ┌────────────────────────────┐  │
│  │   MCPManager               │  │
│  │  - Detects Cursor IDE      │  │
│  │  - Registers via Cursor    │  │
│  │    Extension API           │  │
│  │  - Loads settings          │  │
│  └────────┬───────────────────┘  │
│           │                       │
│           ▼                       │
│  ┌────────────────────────────┐  │
│  │  Core Services             │  │
│  │  - GeneratorService        │  │
│  │  - FileExportService       │  │
│  │  - HistoryService          │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### Cursor Extension API

The extension uses Cursor's `vscode.cursor.mcp` API:

```typescript
vscode.cursor.mcp.registerServer({
  name: 'mybatis-boost',
  server: {
    command: 'node',
    args: [serverPath],
    env: {
      MYBATIS_BASE_PACKAGE: '...',
      MYBATIS_AUTHOR: '...',
      // ... other settings from extension config
    }
  }
});
```

This is **different from** the stdio server approach:
- ✅ **Extension API**: Automatic, uses extension settings, no manual config
- ❌ **stdio server**: Manual `mcp.json` setup, environment variables

## Troubleshooting

### MCP tools not showing up

1. Check if MCP is enabled:
   ```json
   "mybatis-boost.mcp.enable": true
   ```

2. Check Developer Console for errors:
   - Help → Toggle Developer Tools
   - Look for `[MyBatis Boost]` messages

3. Verify extension is active:
   - Extensions panel → MyBatis Boost should be "Enabled"

### Want to use stdio server instead?

If you prefer the stdio server approach (e.g., for other IDEs):

1. Disable the extension MCP:
   ```json
   "mybatis-boost.mcp.enable": false
   ```

2. Follow the [MCP_SERVER.md](./MCP_SERVER.md) guide to configure the stdio server

## Comparison: Extension API vs stdio Server

| Feature | Extension API (Cursor) | stdio Server |
|---------|----------------------|--------------|
| Setup | Automatic | Manual `mcp.json` |
| Configuration | VS Code settings | Environment variables |
| Updates | Automatic with extension | Requires rebuild |
| Works with | Cursor IDE | Any MCP-compatible tool |
| History storage | VS Code GlobalState | File system (~/.mybatis-boost) |

## Support

For issues or questions:
- GitHub Issues: https://github.com/young1lin/mybatis-boost/issues
- Documentation: [README.md](./README.md)
- stdio Server Guide: [MCP_SERVER.md](./MCP_SERVER.md)
