# Codebase Skill Maintenance

> last_verified_commit: fddc067
> source_scope:
> - `.agents/skills/codebase/`
> - `package.json`
> - `esbuild.js`
> - `.vscode/`

## Contents

[Responsibilities](#responsibilities) · [Inventory](#read-only-inventory) ·
[Status and Check](#status-and-check) · [Sync](#confirmed-sync-workflow) ·
[Routing](#file-to-reference-routing) · [Build](#build-and-packaging) ·
[Known Pitfalls](#known-pitfalls)

## Responsibilities

Keep the codebase map aligned with live source, define read-only freshness
checks, route changed files to affected references, and document build and
debug boundaries that cut across feature modules.

## Read-only Inventory

Run from the repository root:

```text
node .agents/skills/codebase/scripts/codebase-inventory.mjs
node .agents/skills/codebase/scripts/codebase-inventory.mjs --format json
```

The script discovers the repository root, prints to stdout, uses no network,
and inventories the current commit, TypeScript modules and exports, relative
imports, tests, Java projects, commands, configuration, and package scripts.
Do not redirect its output into the knowledge base during `status` or `check`.

## Status and Check

For `status`, read each `last_verified_commit`, confirm the commit exists, and
compare it with `HEAD`:

```text
git diff --name-only <anchor>..HEAD
```

Map changed files with the routing table below. For `check`, also run the
inventory and verify documented paths and important symbols with `rg` and
source reads. Report:

- current references;
- references affected by source changes;
- missing paths or symbols;
- unverified anchors;
- suggested sync scope.

Neither workflow edits files.

## Confirmed Sync Workflow

`sync [range]` is the only workflow that updates this skill:

1. Resolve the requested range, or use the affected reference anchors through
   `HEAD`.
2. Map changed source, tests, configuration, and build files to references.
3. Read diffs and surrounding live source; trace callers and consumers.
4. Present the proposed reference and routing changes.
5. Wait for explicit user confirmation.
6. Update only affected references and their `last_verified_commit`.
7. Run inventory, path/symbol checks, and skill validation.

Do not install hooks, start background work, call model APIs, or ingest chat
logs. Source wins whenever a reference disagrees with code.

## File-to-Reference Routing

| Changed path | Primary reference |
|---|---|
| `src/extension.ts`, activation/config in `package.json` | `extension-lifecycle.md` |
| `src/navigator/core/`, `src/navigator/providers/` | `navigation.md` |
| `src/navigator/parsers/`, Java parsing/type utilities | `parsing-and-type-resolution.md` |
| navigator diagnostics and parameter parsing | `parameter-validation.md` |
| `src/generator/`, generator WebView | `generator.md` |
| `src/console/`, log WebView | `sql-console.md` |
| `src/formatter/`, `src/hover/`, `src/decorator/`, `SqlComposer` | `formatter-hover-decoration.md` |
| `src/mcp/` | `mcp.md` |
| `src/test/`, `java-project/`, test runner config | `testing.md` |
| `esbuild.js`, package scripts, `.vscode/` | `maintenance.md` |

Cross-cutting files update every reference on the actual flow. Keep
`references/index.md` and `architecture.md` synchronized when responsibilities
or routing change.

## Build and Packaging

- `package.json` declares pnpm `10.19.0`.
- `esbuild.js` bundles `src/extension.ts` to `dist/extension.js`.
- It separately bundles `src/mcp/stdio/server.ts` with a Node shebang.
- The build forces the CommonJS entry of `web-tree-sitter`.
- It copies EJS templates, WebView HTML, and tree-sitter WASM resources.
- `.vscode/tasks.json` uses `corepack pnpm run compile`.
- `Run Extension` disables Java Debug; `Run Extension (Isolated)` disables all
  other extensions. Use the normal launch when testing Java language features.

## Change Impact

Package scripts and `.vscode` tasks affect local debug startup. Resource-copy
changes affect the generator, parser initialization, WebViews, and MCP even
when TypeScript checks pass. Release scripts create and push Git tags and must
never be run as a read-only validation step.

## Known Pitfalls

- Never treat `dist/` or `out/` as authoritative source.
- Do not store local paths, credentials, instrumentation keys, extension-host
  logs, or workspace storage contents in references.
- Avoid durable line numbers; identify files and symbols.
- A reference anchor is a freshness marker, not proof that every claim remains
  valid—verify important claims against current source.
- `.claude/skills` is a directory symlink to `.agents/skills`; do not maintain a
  copied Claude-specific skill tree.

## Related Modules

- `index.md`
- `architecture.md`
- `testing.md`
