# Extension Lifecycle

> last_verified_commit: fddc067
> source_scope:
> - `src/extension.ts`
> - `src/utils/projectDetector.ts`
> - `package.json`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Activation Flow](#activation-flow) · [Configuration](#configuration) ·
[Commands](#commands) · [Tests](#tests-and-fixtures) ·
[Change Impact](#change-impact) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

Own extension activation ordering, project gating, feature registration,
configuration reactions, commands, and disposal.

## Entry Points

- `activate(context)` in `src/extension.ts`
- `deactivate()` in `src/extension.ts`
- `activationEvents`, commands, views, and configuration in `package.json`

## Activation Flow

```text
activate
  -> register generator WebView
  -> register SQL log WebView
  -> MCPManager.register (failure is non-critical)
  -> register commands
  -> ConsoleInterceptor.activate
  -> isJavaProject
       -> project file in parents
       -> fallback: at least one workspace Java file
  -> FileMapper.initialize
  -> XML definition providers
  -> SQL hover providers
  -> optional formatter
  -> Java-to-XML DefinitionProvider or CodeLens
  -> ParameterValidator
  -> optional binding decorator
  -> optional dynamic SQL highlighter
  -> configuration listener and disposal
```

Generator, SQL-log, MCP, commands, and console are registered before the
Java-project check. Navigation/editor features are gated.

## Key Files and Symbols

- `registerCommands` implements cache refresh, mapping refresh, Java-to-XML
  jump, and SQL-console commands.
- `registerXmlDefinitionProviders` composes XML navigation providers.
- `registerJavaToXmlNavigationProvider` switches between DefinitionProvider and
  CodeLens modes.
- `registerHoverProviders` and `registerXmlFormattingProvider` own editor
  presentation registration.
- `isJavaProject` uses `findProjectFileInParents` and a bounded Java-file
  fallback.
- `projectDetector.ts` also contains outermost-root and containment helpers used
  by `FileMapper`.

## Configuration

High-impact lifecycle keys:

- `mybatis-boost.useDefinitionProvider`
- `mybatis-boost.mcp.enable`
- `mybatis-boost.formatter.enabled`
- `mybatis-boost.showBindingIcons`
- `mybatis-boost.highlightDynamicSql`
- `mybatis-boost.cacheSize`

Some settings are dynamic. Verify `onDidChangeConfiguration` before assuming a
restart is required.

## Commands

Command contributions live in `package.json`; handlers live in
`registerCommands`:

- `mybatis-boost.clearCache`
- `mybatis-boost.refreshMappings`
- `mybatis-boost.jumpToXml`
- `mybatis-boost.clearSqlOutput`
- `mybatis-boost.toggleSqlConsole`
- `mybatis-boost.exportSqlLogs`

## Tests and Fixtures

- `src/test/unit/activationConfig.test.ts`
- `src/test/unit/projectDetector.test.ts`
- `src/test/extension.test.ts`
- `src/test/unit/jumpToXml.test.ts`
- `src/test/unit/jumpToXml.errorHandling.test.ts`

Use extension-host integration tests for registration behavior that mocks
cannot represent.

## Change Impact

When changing activation:

1. check `package.json` activation events;
2. preserve the intentional pre/post Java-gate split;
3. update dynamic configuration disposal;
4. verify repeated initialization does not leak providers/watchers;
5. compile the bundle and run extension tests.

## Known Pitfalls

- An MCP registration error is intentionally non-fatal.
- Disposables can be registered both directly and through aggregate cleanup;
  avoid duplicate behavior during configuration toggles.
- Project detection must support nested and multi-module workspaces.
- Debug Extension Host output is shared with other extensions unless launch
  arguments disable them.

## Related Modules

- [Architecture](architecture.md)
- [Navigation](navigation.md)
- [SQL console](sql-console.md)
- [MCP](mcp.md)
- [Maintenance](maintenance.md)
