# Code Generator

> last_verified_commit: fddc067
> source_scope:
> - `src/generator/`
> - `src/webview/GeneratorViewProvider.ts`
> - `src/webview/generator.html`
> - `src/mcp/core/GeneratorService.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Parsing Flow](#parsing-flow) · [Generation Flow](#generation-flow) ·
[WebView Flow](#webview-flow) · [Configuration](#configuration) ·
[Tests](#tests-and-fixtures) · [Change Impact](#change-impact)

## Responsibilities

Parse CREATE TABLE DDL, normalize schema metadata, render MyBatis Java/XML files
from EJS templates, preview/export results in a WebView, and expose the same
core through MCP/VS Code AI tools.

## Entry Points

- `parseDDL(sql, options)`
- `parseDDLWithConfig(sql, options)`
- `new CodeGenerator(config, parsedSchema)`
- `CodeGenerator.generateAll()`
- `GeneratorViewProvider.resolveWebviewView`
- `GeneratorService.parseSqlAndGenerate`

## Parsing Flow

```text
DDL
  -> verify CREATE TABLE
  -> detect MySQL/PostgreSQL/Oracle unless configured
  -> MySQL library parser
       -> regex fallback
  -> ParsedSchema(table, columns, primary key, comments)
```

Composite primary keys receive a dedicated error. The fallback parser handles
unsupported library syntax and non-MySQL dialects.

## Generation Flow

```text
ParsedSchema + GeneratorConfig
  -> normalize table/column names and Java types
  -> build typed metadata
  -> render EJS
  -> GenerateReuslt(name, outputPath, content, type, metadata)
```

Base generation produces Entity, Mapper, Mapper XML, and Service. When
MyBatis-Plus is enabled, `generateAll` also adds ServiceImpl and Controller.

Templates:

- `entity.ejs`
- `mapper.ejs`
- `mapper-xml.ejs`
- `service.ejs`
- `service-impl.ejs`
- `controller.ejs`

## WebView Flow

`GeneratorViewProvider` receives messages for preview, export, history, and
settings.

Preview parses DDL and renders content in memory. Export writes generated
results. History is stored in extension global state with bounded size.
Settings can target workspace or global configuration.

## Configuration

Key prefix: `mybatis-boost.generator.*`

- `datetime`
- `basePackage`
- `author`
- `entitySuffix`
- `mapperSuffix`
- `serviceSuffix`
- `useLombok`
- `useSwagger`
- `useSwaggerV3`
- `useMyBatisPlus`
- `template-path.entity`
- `template-path.mapper`
- `template-path.mapper-xml`
- `template-path.service`

Verify whether newer templates have configurable paths before adding more keys.

## Shared MCP Core

`GeneratorService` reuses `parseDDL` and `CodeGenerator`, then locates packaged
templates across extension, dist, or source execution contexts. MCP may export
through `FileExportService` and record/query history through `HistoryService`.

## Tests and Fixtures

- `src/test/unit/generator/ddlParser.test.ts`
- `src/test/unit/generator/utils.test.ts`
- `src/test/unit/generator/templateGenerator.test.ts`
- `src/test/unit/generator/templateGenerator.demo.test.ts`
- `src/test/unit/GeneratorViewProvider.test.ts`
- `src/test/unit/generator/generated-samples/`

Run bundle validation when templates or paths change.

## Change Impact

- Metadata/type changes affect templates, WebView preview/export, and MCP.
- Adding a template requires `CodeGenerator`, configuration/UI decisions,
  `esbuild.js` resource copying, and generated-sample tests.
- Parser changes require dialect and fallback tests.
- Output-path changes affect filesystem export and history records.

## Known Pitfalls

- The public type is currently spelled `GenerateReuslt`; renaming is an API-wide
  change.
- Templates work in source tests but can be missing from `dist`.
- MyBatis-Plus changes both imports and the set of generated files.
- Swagger 2 and Swagger 3 flags must not produce conflicting annotations.
- Custom template paths are user-controlled and require clear error handling.

## Related Modules

- [MCP](mcp.md)
- [Extension lifecycle](extension-lifecycle.md)
- [Maintenance](maintenance.md)
- [Testing](testing.md)
