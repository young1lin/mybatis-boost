# MCP Integration

> last_verified_commit: fddc067
> source_scope:
> - `src/mcp/`
> - `src/generator/`
> - `esbuild.js`
> - `src/extension.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Core Flow](#core-flow) · [Configuration](#configuration) ·
[Tests](#tests-and-fixtures) · [Packaging](#packaging) ·
[Change Impact](#change-impact) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

Expose MyBatis code generation as language-model tools. Cursor receives a
standalone stdio MCP server; VS Code receives Language Model Tool
registrations. Both paths reuse generator, file export, and history services.

## Entry Points

- `MCPManager.initialize()` detects the host and registers when
  `mybatis-boost.mcp.enable` is true.
- `MCPManager.registerCursorMCP()` points Cursor at
  `dist/mcp/stdio/server.js`.
- `MCPManager.registerVSCodeTools()` registers VS Code Language Model Tools.
- `src/mcp/stdio/server.ts` is the standalone JSON-RPC process entry.
- `MCPRequestHandler` lists and dispatches stdio tools.

## Core Flow

### Cursor

1. Host detection checks the Cursor extension/API and application name.
2. Generator settings are converted to environment variables.
3. Cursor registers the bundled Node stdio server.
4. `MCPRequestHandler` handles initialize, list, and call requests.
5. Handlers call `GeneratorService`, `FileExportService`, and
   `HistoryService`.

### VS Code

`MCPManager` registers four Language Model Tools whose classes delegate to the
same services:

- `mybatis_parse_sql_and_generate`
- `mybatis_export_generated_files`
- `mybatis_query_generation_history`
- `mybatis_parse_and_export`

## Key Files and Symbols

- `src/mcp/MCPManager.ts` — host detection, configuration, lifecycle.
- `src/mcp/tools/*.ts` — VS Code tool implementations.
- `src/mcp/core/GeneratorService.ts` — DDL parsing and generation bridge.
- `src/mcp/core/FileExportService.ts` — generated-file writes.
- `src/mcp/core/HistoryService.ts` — generation history and storage.
- `src/mcp/stdio/server.ts` — newline-delimited JSON-RPC loop.
- `src/mcp/stdio/handlers.ts` — schemas and dispatch.
- `esbuild.js` — builds the standalone server with a Node shebang.

## Dependencies

- Generator parsers, templates, and output types.
- Cursor's MCP extension API or VS Code's Language Model Tool API.
- Local filesystem access for export and history operations.

## Configuration

- `mybatis-boost.mcp.enable`
- All `mybatis-boost.generator.*` settings are inputs to generation.
- The stdio path receives corresponding `MYBATIS_*` environment variables.

## Tests and Fixtures

Generator unit tests cover much of the shared generation core. The repository
currently has no dedicated suites for `MCPManager`, JSON-RPC framing, tool
schemas, stdio configuration, file export, or history storage. Validate those
boundaries manually when MCP code changes.

## Packaging

`esbuild.js` produces both `dist/extension.js` and
`dist/mcp/stdio/server.js`. A successful TypeScript check alone does not prove
the standalone server is bundled or its templates/resources are available;
run the compile/package build for MCP changes.

## Change Impact

Tool input or output changes must remain consistent between Cursor stdio
schemas and VS Code tool implementations. Generator configuration changes
affect WebView generation and both MCP hosts. Export changes write outside the
extension bundle and need explicit path/error validation.

## Known Pitfalls

- Host detection and Cursor registration depend on APIs outside normal unit
  mocks.
- Booleans cross the stdio boundary as strings in environment variables.
- Export tools perform material filesystem writes; do not invoke them during a
  read-only codebase investigation.
- Unregister/dispose paths must tolerate repeated extension deactivation.
- Never document or commit environment values that may contain local data.

## Related Modules

- `generator.md`
- `extension-lifecycle.md`
- `maintenance.md`
- `testing.md`
