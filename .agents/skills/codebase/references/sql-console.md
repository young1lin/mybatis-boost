# SQL Console

> last_verified_commit: fddc067
> source_scope:
> - `src/console/`
> - `src/webview/MybatisLogViewProvider.ts`
> - `src/extension.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Core Flow](#core-flow) · [Configuration](#configuration) ·
[Tests](#tests-and-fixtures) · [Change Impact](#change-impact) ·
[Known Pitfalls](#known-pitfalls)

## Responsibilities

Capture MyBatis log lines emitted by a Java debug session, correlate the
multi-line records, substitute typed parameters into SQL, and show completed
statements in the SQL Log WebView.

## Entry Points

- `ConsoleInterceptor.activate()` registers the Java debug tracker and console
  commands.
- `DebugTrackerFactory.createDebugAdapterTracker()` receives Debug Adapter
  Protocol messages.
- `MybatisLogViewProvider.addRecord()` stores and renders converted statements.
- `extension.activate()` creates the provider, connects it to the interceptor,
  and activates the interceptor before Java-project navigation initialization.

## Core Flow

1. The Java debug adapter sends an `output` event.
2. `DebugTrackerFactory.handleMessage()` splits output into individual lines.
3. `LogParser.isMyBatisLog()` and `LogParser.parse()` recognize supported log
   layouts and produce `LogEntry` values.
4. `ThreadSessionManager.updateSession()` correlates `Preparing`,
   `Parameters`, and terminal `Total` or `Updates` lines by thread and mapper.
5. `ParameterParser.parse()` turns the logged values and MyBatis type suffixes
   into typed parameters.
6. `SqlConverter.validateParameterCount()` rejects incomplete substitutions.
7. `DatabaseDialect.detectDatabase()` selects a dialect and
   `SqlConverter.convert()` creates executable SQL.
8. `MybatisLogViewProvider.addRecord()` adds the result to WebView history.

## Key Files and Symbols

- `src/console/interceptor/ConsoleInterceptor.ts` — activation, commands, and
  configuration changes.
- `src/console/interceptor/DebugTrackerFactory.ts` — DAP filtering and the main
  conversion pipeline.
- `src/console/parser/LogParser.ts` — standard, Spring Boot, and loose layouts.
- `src/console/parser/ThreadSessionManager.ts` — interleaved thread sessions
  and timeout cleanup.
- `src/console/parser/ParameterParser.ts` — value/type parsing.
- `src/console/converter/DatabaseDialect.ts` — SQL dialect detection.
- `src/console/converter/SqlConverter.ts` — placeholder validation and quoting.
- `src/console/types.ts` — log, session, parameter, and converted SQL types.
- `src/webview/MybatisLogViewProvider.ts` — record history and presentation.

## Dependencies

- VS Code `DebugAdapterTrackerFactory` for Java debug output.
- The SQL Log WebView for display and history.
- `package.json` for debug activation, commands, and user configuration.

## Configuration

All keys use the `mybatis-boost.console` section:

- `enabled`
- `autoDetectDatabase`
- `defaultDatabase`
- `showExecutionTime`
- `sessionTimeout`
- `formatSql`
- `historyLimit`

Commands are `mybatis-boost.clearSqlOutput`,
`mybatis-boost.toggleSqlConsole`, and `mybatis-boost.exportSqlLogs`.

## Tests and Fixtures

- `src/test/unit/console/LogParser.test.ts`
- `src/test/unit/console/ParameterParser.test.ts`
- `src/test/unit/console/ThreadSessionManager.test.ts`
- `src/test/unit/console/DatabaseDialect.test.ts`
- `src/test/unit/console/SqlConverter.test.ts`
- `src/test/unit/webview/MybatisLogViewProvider.test.ts`

There is no end-to-end test that launches a Java debug adapter and asserts DAP
log capture. Treat tracker registration and real debugger log formats as a
manual integration boundary.

## Change Impact

Parser changes can affect session grouping, conversion, history, and all
supported database dialects. Session-key changes require concurrent-thread
tests. WebView record changes can affect history limits and rendering without
changing SQL conversion.

## Known Pitfalls

- `executionTime` is currently the absolute difference between `Preparing` and
  `Parameters` timestamps; it is not database execution duration.
- `autoDetectDatabase`, `defaultDatabase`, `showExecutionTime`, and
  `sessionTimeout` are read by `ConsoleInterceptor` but are not currently
  passed into `DebugTrackerFactory`; dialect detection and the 5-second session
  timeout therefore remain fixed. `formatSql` and `historyLimit` are consumed
  directly by the WebView provider.
- A session completes only after both preparation and parameters exist and a
  `Total` or `Updates` line arrives.
- Parameter-count mismatches are logged and dropped.
- `exportSqlLogs` currently shows a not-yet-implemented warning.
- Logs without a stable thread identifier fall back to timestamp plus mapper.

## Related Modules

- `extension-lifecycle.md`
- `formatter-hover-decoration.md`
- `testing.md`
