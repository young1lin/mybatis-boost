# MyBatis Boost Codebase Index

> last_verified_commit: fddc067

Start here. Route the request to the smallest relevant reference, then verify
the listed files and symbols against current source.

## Concept Routing

| Concept or synonym | Read first | Primary source | Representative tests |
|---|---|---|---|
| architecture, module map, project overview | [architecture.md](architecture.md) | `src/extension.ts`, module `index.ts` files | `src/test/extension.test.ts` |
| activation, Java project detection, commands, configuration, disposal | [extension-lifecycle.md](extension-lifecycle.md) | `src/extension.ts`, `src/utils/projectDetector.ts`, `package.json` | `activationConfig.test.ts`, `projectDetector.test.ts` |
| Java ↔ XML, Mapper binding, CodeLens, F12, namespace, statement id | [navigation.md](navigation.md) | `src/navigator/core/FileMapper.ts`, `src/navigator/providers/` | `fileMapper.test.ts`, `definitionProviders.test.ts` |
| resultMap, include/refid, class reference, property navigation | [navigation.md](navigation.md) | XML definition providers | `XmlResultMapDefinitionProvider.test.ts`, provider integration tests |
| AST, tree-sitter, WASM, regex fallback, Java parser | [parsing-and-type-resolution.md](parsing-and-type-resolution.md) | `javaTreeSitterParser.ts`, `javaParser.ts`, `javaFieldParser.ts` | parser unit tests |
| inherited fields, extends chain, shadowing, multi-level inheritance | [parsing-and-type-resolution.md](parsing-and-type-resolution.md), then [parameter-validation.md](parameter-validation.md) | `src/utils/javaFieldHierarchy.ts` | `javaFieldHierarchy.test.ts`, inherited-field integration tests |
| Java type resolution, imports, wildcard imports, Java LS | [parsing-and-type-resolution.md](parsing-and-type-resolution.md) | `javaTypeResolver.ts`, `javaLSHelper.ts`, `navigationUtils.ts` | `javaTypeResolver.test.ts`, `javaLSHelper.test.ts` |
| `#{...}`, `${...}`, OGNL, foreach/bind, undefined parameter | [parameter-validation.md](parameter-validation.md) | `parameterParser.ts`, `ParameterValidator.ts` | parameter parser/validator tests |
| DDL, templates, Entity/Mapper/Service/Controller generation | [generator.md](generator.md) | `src/generator/`, `GeneratorViewProvider.ts` | generator tests |
| Preparing/Parameters/Total, SQL reconstruction, debug output | [sql-console.md](sql-console.md) | `src/console/`, `MybatisLogViewProvider.ts` | `src/test/unit/console/` |
| XML formatting, hover SQL, binding icons, dynamic SQL highlighting | [formatter-hover-decoration.md](formatter-hover-decoration.md) | `src/formatter/`, `src/hover/`, `src/decorator/`, `src/core/SqlComposer.ts` | formatter, hover/webview, highlighter tests |
| Cursor MCP, VS Code LM tools, stdio server, generation history | [mcp.md](mcp.md) | `src/mcp/` | compile/package and targeted service checks |
| which tests, fixtures, integration host, Java demo | [testing.md](testing.md) | `src/test/`, `.vscode-test.mjs`, `java-project/` | test commands in `package.json` |
| compile, bundle, WASM copying, debug launch, release, stale docs | [maintenance.md](maintenance.md) | `esbuild.js`, `.vscode/`, package scripts | compile plus relevant suites |

## High-Value Cross-Module Routes

### Inherited-field navigation

```text
XmlParameterDefinitionProvider / XmlResultMapPropertyDefinitionProvider
  -> findFieldInHierarchy
  -> extractJavaFields + extractSuperclassName
  -> resolveFullyQualifiedType
  -> workspace source / Java LS boundary
```

Read navigation, parsing/type resolution, parameter validation, and testing.

### Extension startup

```text
activate
  -> always-on WebViews, MCP, commands, SQL console
  -> Java project gate
  -> FileMapper and editor language features
  -> configuration listeners and disposal
```

Read extension lifecycle and architecture.

### Code generation

```text
GeneratorViewProvider or MCP tool
  -> DDL parser
  -> CodeGenerator
  -> EJS templates
  -> preview/history or filesystem export
```

Read generator, MCP when AI tools are involved, and maintenance for packaging.

### SQL console

```text
Java debug adapter output
  -> LogParser
  -> ThreadSessionManager
  -> ParameterParser
  -> DatabaseDialect + SqlConverter
  -> MybatisLogViewProvider
```

Read SQL console and extension lifecycle.

## Source-of-Truth Rules

- Treat `src/` as source; `dist/` and `out/` are generated.
- Treat `package.json` as the configuration/command contribution source.
- Use current method names and live line numbers in answers.
- If an anchor predates relevant source changes, mark the reference possibly
  stale and verify the whole affected flow.
