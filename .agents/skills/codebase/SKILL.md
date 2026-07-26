---
name: codebase
description: Use for understanding, locating, tracing, or assessing MyBatis Boost code. Trigger when asked about project architecture, extension activation, Java/XML navigation, inherited fields or 继承字段, AST/tree-sitter parsing, Java type resolution, parameter validation, code generation, SQL console, formatter/hover/decorations, MCP tools, tests, fixtures, build/package behavior, change impact, or stale codebase documentation. Also use for explicit overview, locate, trace, impact, test, status, check, and sync requests concerning this repository.
---

# MyBatis Boost Codebase

Use this project-local knowledge map to reach the correct source quickly. Treat
the references as routing aids, then verify important claims against the live
repository before answering.

## Start

1. Locate the repository root containing `package.json` and `src/extension.ts`.
2. Read [references/index.md](references/index.md) first.
3. Select only the references needed for the request.
4. Verify files and symbols with `rg` and targeted source reads.
5. Prefer current source whenever a reference disagrees with it.

Do not load every reference by default.

## Interpret Requests

Map explicit commands and natural-language equivalents as follows:

| Intent | Action |
|---|---|
| `overview` | Explain architecture and major flows. |
| `locate <concept>` | Find implementation entry points, configuration, and tests. |
| `trace <target>` | Follow registrations, callers, callees, and data flow. |
| `impact <target>` | Identify direct edits, consumers, packaging, and required tests. |
| `test <scope>` | Select the narrowest sufficient validation. Run it only when authorized by the surrounding request. |
| `status` | Report reference anchors and code changes since verification. |
| `check` | Verify references against source without writing. |
| `sync [range]` | Propose knowledge updates from a Git diff; write only after explicit confirmation. |

Examples:

```text
/codebase locate inherited field navigation
/codebase trace XmlParameterDefinitionProvider
/codebase impact Java AST field parsing
/codebase test generator
/codebase check
```

## Route by Topic

- Architecture or module ownership: read
  [architecture.md](references/architecture.md).
- Activation, commands, configuration, or disposal: read
  [extension-lifecycle.md](references/extension-lifecycle.md).
- Mapper discovery, Java/XML mapping, definitions, or CodeLens: read
  [navigation.md](references/navigation.md).
- Tree-sitter, regex fallback, fields, superclass walking, Java LS, or type
  names: read
  [parsing-and-type-resolution.md](references/parsing-and-type-resolution.md).
- `#{...}`, `${...}`, OGNL, local variables, diagnostics, or inherited-field
  validation: read
  [parameter-validation.md](references/parameter-validation.md).
- DDL parsing, EJS templates, generated Java/XML, generator WebView, or
  generator settings: read [generator.md](references/generator.md).
- Debug Adapter Protocol logs, SQL reconstruction, sessions, dialects, or log
  WebView: read [sql-console.md](references/sql-console.md).
- XML formatting, composed SQL hover, binding icons, or dynamic SQL colors:
  read
  [formatter-hover-decoration.md](references/formatter-hover-decoration.md).
- Cursor MCP, VS Code language-model tools, stdio server, export, or generation
  history: read [mcp.md](references/mcp.md).
- Test selection, fixtures, full integration runs, or Java sample projects:
  read [testing.md](references/testing.md).
- Builds, resource copying, packaging, debug launch, releases, or knowledge
  maintenance: read [maintenance.md](references/maintenance.md).

For a cross-cutting request, follow the actual flow and load each participating
module. Inherited-field navigation usually needs navigation, parsing/type
resolution, parameter validation, and testing.

## Locate

1. Search the index for the concept and synonyms.
2. Read the routed module reference.
3. Confirm each proposed entry point exists:

   ```powershell
   rg -n "SymbolOrConcept" src package.json
   ```

4. Inspect registrations in `src/extension.ts` or exports in the module
   `index.ts`.
5. Return:
   - primary entry;
   - core implementation;
   - upstream registration/caller;
   - downstream dependencies;
   - configuration;
   - tests and fixtures.

Use live file links with current line numbers in the answer, but do not store
line numbers in references.

## Trace

Resolve the target to a concrete symbol before building the flow. Follow:

```text
activation/registration
  -> provider or service entry
  -> parser/resolver/core service
  -> VS Code API, filesystem, WebView, or generated output
```

Search both imports and direct symbol calls. Identify async boundaries, caches,
watchers, fallbacks, and external dependencies. Use a short sequence or flow
only when it materially improves clarity.

## Assess Impact

Separate findings into:

1. direct implementation;
2. public exports and registration;
3. caches, watchers, and lifecycle;
4. configuration and localization;
5. bundle/runtime resources;
6. unit tests;
7. extension-host integration tests;
8. Java manual fixtures.

Do not infer authorization to modify code from an impact-analysis request.

## Select Tests

Read [testing.md](references/testing.md). Prefer:

1. the smallest related unit test;
2. related integration suites when VS Code APIs, providers, workspace lookup,
   or packaged runtime resources are involved;
3. `java-project/integration-test` for manual Java/MyBatis behavior;
4. the full suite for cross-cutting parser, build, cache, or lifecycle changes.

## Status and Check

Run the inventory when a machine-readable snapshot helps:

```powershell
node .agents/skills/codebase/scripts/codebase-inventory.mjs --format markdown
node .agents/skills/codebase/scripts/codebase-inventory.mjs --format json
```

For `status`, compare each reference's `last_verified_commit` with `HEAD` and
map changed source files using
[maintenance.md](references/maintenance.md).

For `check`:

1. validate documented paths and key symbols;
2. identify relevant changes since each anchor;
3. classify references as current, possibly stale, or broken;
4. report evidence;
5. make no edits.

## Sync Knowledge

Use [maintenance.md](references/maintenance.md) for `sync`.

1. Determine the requested Git range.
2. Map changed files to references.
3. Read diffs plus surrounding implementation.
4. Trace affected callers, callees, configuration, resources, and tests.
5. Present proposed reference edits and reasons.
6. Wait for explicit confirmation.
7. Update only confirmed references, routing entries, and anchors.

Never write during `overview`, `locate`, `trace`, `impact`, `test`, `status`, or
`check`.

## Guardrails

- Code wins over documentation.
- State clearly when stored knowledge appears stale.
- Do not copy tokens, credentials, user settings, transcripts, or local debug
  logs into references.
- Do not treat generated `dist/` or `out/` files as source of truth.
- Do not rely on a Java Language Server result when a same-package or explicit
  source resolution rule takes precedence.
- Stop hierarchy tracing at unresolved external/library types and name that
  boundary.
- Use repository-relative paths in knowledge updates.
