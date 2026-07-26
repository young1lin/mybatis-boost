# Architecture

> last_verified_commit: fddc067
> source_scope:
> - `src/extension.ts`
> - `src/navigator/`
> - `src/generator/`
> - `src/console/`
> - `src/mcp/`
> - `src/webview/`

## Contents

[Responsibilities](#responsibilities) · [Module Map](#module-map) ·
[Core Flows](#core-flows) · [Shared Dependencies](#shared-dependencies) ·
[Change Impact](#change-impact) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

MyBatis Boost is a VS Code/Cursor extension with four mostly independent
capability groups:

1. Java/MyBatis XML navigation and parameter diagnostics.
2. DDL-driven code generation through a WebView and AI/MCP tools.
3. MyBatis debug-log interception and executable SQL reconstruction.
4. XML presentation features: formatting, SQL hover, binding icons, and
   dynamic-SQL highlighting.

`src/extension.ts` is the composition root.

## Module Map

| Module | Role | Main entry |
|---|---|---|
| `navigator` | Java/XML mapping, providers, parsers, diagnostics | `FileMapper`, definition providers, `ParameterValidator` |
| `utils` | project detection, Java resolution, hierarchy walking, shared caches | `projectDetector`, `javaTypeResolver`, `javaFieldHierarchy` |
| `generator` | parse DDL and render EJS templates | `parseDDL`, `CodeGenerator` |
| `webview` | generator and SQL-log user interfaces | `GeneratorViewProvider`, `MybatisLogViewProvider` |
| `console` | consume debug output and reconstruct SQL | `ConsoleInterceptor`, `DebugTrackerFactory` |
| `mcp` | expose generation through Cursor MCP or VS Code LM tools | `MCPManager` |
| `formatter` | parse and format MyBatis XML/SQL | `MybatisXmlFormattingProvider` |
| `hover` | display composed mapper SQL | `XmlSqlHoverProvider`, `JavaSqlHoverProvider` |
| `decorator` | gutter bindings and dynamic tag/keyword colors | `MybatisBindingDecorator`, `DynamicSqlHighlighter` |
| `core` | cross-feature SQL composition | `composeSql` |

## Core Flows

```text
Java/XML editor
  -> registered provider
  -> FileMapper or direct XML analysis
  -> Java/XML parsers and type resolution
  -> vscode.Location / CodeLens / Diagnostic
```

```text
DDL
  -> parseDDL
  -> ParsedSchema
  -> CodeGenerator + EJS
  -> WebView preview/export OR MCP result/export
```

```text
Java debug session
  -> Debug Adapter Protocol output
  -> log/session/parameter parsing
  -> SQL conversion and dialect handling
  -> SQL log WebView
```

## Shared Dependencies

- VS Code API supplies documents, providers, workspace searches, diagnostics,
  configuration, debug tracking, WebViews, and language-model tools.
- `FileMapper` is shared by Java/XML navigation, Java hover, binding
  decorations, and parameter-provider Java lookup.
- Java parsers prefer bundled tree-sitter WASM and degrade to regex; field
  resolution can also consult Java LS.
- Generator templates and tree-sitter WASM are runtime resources copied by
  `esbuild.js`.
- Generator logic is shared between the WebView and MCP surfaces.

## Change Impact

- Changes to `extension.ts` affect activation ordering, feature availability,
  and disposal.
- Changes to parser result types affect providers, validator, and many unit
  tests.
- Changes to `FileMapper` affect most navigation and editor-decoration paths.
- Changes to generator metadata affect templates, WebView preview/export, MCP,
  and generated-sample tests.
- Changes to runtime resource locations require corresponding `esbuild.js`
  updates and extension-host verification.

## Known Pitfalls

- Features registered before the Java-project gate remain available in
  non-Java workspaces; navigation features do not.
- Generated bundles can pass TypeScript tests while failing at runtime if WASM,
  HTML, or EJS resources are missing.
- Cursor-specific MCP registration and VS Code LM tool registration are
  different execution paths.
- Extension-host logs include other installed extensions unless debug launch is
  isolated.

## Related Modules

- [Extension lifecycle](extension-lifecycle.md)
- [Navigation](navigation.md)
- [Testing](testing.md)
- [Maintenance](maintenance.md)
