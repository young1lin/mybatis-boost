# Testing

> last_verified_commit: fddc067
> source_scope:
> - `src/test/`
> - `java-project/`
> - `.mocharc.json`
> - `.vscode-test.mjs`
> - `package.json`

## Contents

[Responsibilities](#responsibilities) · [Test Layers](#test-layers) ·
[Selection Matrix](#selection-matrix) · [Commands](#commands) ·
[Integration Coverage](#key-integration-coverage) ·
[Change Impact](#change-impact) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

Map a change to the narrowest useful checks, distinguish mocked unit coverage
from real extension-host behavior, and expose Java fixtures for manual and
automated navigation validation.

## Test Layers

| Layer | Location | Runner | Best for |
|---|---|---|---|
| Unit | `src/test/unit/` | Mocha + ts-node | parsers, resolvers, validators, generator, formatter, console |
| Integration | `src/test/integration/` | VS Code test runner | providers, `FileMapper`, commands, real workspace APIs |
| Fixtures | `src/test/fixtures/` | consumed by tests | compact mapper/XML/Java cases |
| Java application | `java-project/integration-test/` | Maven or extension host | realistic mapper navigation and inherited fields |
| Multi-module Java | `java-project/multi-module-test/` | Maven or extension host | module boundaries and duplicate mapper names |

`.mocharc.json` installs `src/test/helpers/vscode-mock.js` for unit tests.
`.vscode-test.mjs` includes only compiled
`out/test/integration/**/*.test.js` and opens the repository root as the
workspace.

## Selection Matrix

- Java/XML navigation or `FileMapper`: targeted navigator unit tests plus
  `definitionProviders`, `fileMapper`, inherited/single-parameter, and precise
  navigation integration suites.
- AST, hierarchy, inherited fields, or type resolution: parser/resolver unit
  tests plus inherited-field integration cases and the Java application.
- Parameter diagnostics: validator, XML parameter parser, Java model, and
  diagnostic collection tests.
- Generator: DDL parser, code generator, template, and WebView provider tests.
- SQL console: all `src/test/unit/console/` tests plus the log WebView test.
- Formatter/composer/highlighter: their three focused unit suites.
- Activation, registration, editor events, Cursor MCP, or real Java language
  server behavior: extension-host or manual debug validation is required.
- Build/resource/MCP bundle changes: compile/package, then inspect the output
  resources rather than relying only on unit tests.

## Commands

From the repository root:

```text
corepack pnpm run compile
corepack pnpm run test:unit
corepack pnpm run test:integration
corepack pnpm test
```

The scripts in `package.json` are canonical. Some scripts invoke `pnpm`
internally, so a machine without `pnpm` on `PATH` may need Corepack activation
or the inner command run explicitly through `corepack pnpm`.

For the Java example:

```text
cd java-project/integration-test
mvn test
```

Use `compile-tests` before invoking the VS Code runner outside the normal
`pretest` path.

## Key Integration Coverage

- XML-to-Java and Java-to-XML definition providers.
- Lazy and per-project `FileMapper` mapping.
- Precise method and field ranges.
- Single parameter, inherited field, and mapper mapping behavior.
- Real VS Code workspace discovery against checked-in fixtures.

Do not quote fixed test counts in knowledge documents; they change as suites
are added. Report counts from the current run.

## Change Impact

Test-only changes under `src/test/fixtures/` can affect multiple suites.
Changes under `java-project/` may be manual demonstration fixtures even when
not included by the TypeScript test runner. A green unit suite does not cover
extension activation, Java Language Server timing, Cursor APIs, or DAP output.

## Known Pitfalls

- Unit tests mock `vscode`; passing mocks do not prove provider registration or
  editor lifecycle behavior.
- Integration tests depend on compiled output and the downloaded VS Code test
  runtime.
- Java symbol requests can time out while the Java Language Server is still
  indexing; distinguish environment readiness from deterministic failures.
- Generated `dist/` and `out/` are validation outputs, not sources to document.

## Related Modules

- Every module reference has its focused test list.
- `maintenance.md`
