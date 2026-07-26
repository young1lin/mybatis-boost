# Formatter, Hover, and Decorations

> last_verified_commit: fddc067
> source_scope:
> - `src/formatter/`
> - `src/hover/`
> - `src/decorator/`
> - `src/core/SqlComposer.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Core Flow](#core-flow) · [Configuration](#configuration) ·
[Tests](#tests-and-fixtures) · [Change Impact](#change-impact) ·
[Known Pitfalls](#known-pitfalls)

## Responsibilities

Present mapper bindings in editors, compose complete SQL for hover text, color
dynamic MyBatis XML, and format SQL while preserving XML and dynamic tags.

## Entry Points

- `MybatisXmlFormattingProvider` is registered for XML formatting.
- `XmlSqlHoverProvider` and `JavaSqlHoverProvider` provide composed SQL hovers.
- `MybatisBindingDecorator.initialize()` decorates mapped Java and XML items.
- `DynamicSqlHighlighter.initialize()` watches editors and configuration.
- All providers are wired by `extension.activate()`.

## Core Flow

### Formatting

1. `MybatisXmlFormattingProvider.provideDocumentFormattingEdits()` reads the
   `mybatis-boost.formatter` settings and mapper XML.
2. Automatic language selection detects a likely SQL dialect.
3. `MybatisSqlFormatter` parses SQL plus dynamic XML into a concrete syntax
   tree, protects comments, CDATA, parameters, and tags, formats SQL nodes with
   `sql-formatter`, then renders the protected structure back to XML.

### Hover

1. The XML provider resolves the surrounding statement and its `id`.
2. The Java provider maps the method through `FileMapper`.
3. `SqlComposer.composeSql()` extracts the statement, resolves nested
   `<include refid="...">` fragments with a cycle guard, and cleans remaining
   XML markup for display.

### Decorations

`MybatisBindingDecorator` uses `FileMapper` results to decorate mapped methods
and statements on active/visible editor and save events. The dynamic SQL
highlighter applies configured colors to dynamic tags and keywords.

## Key Files and Symbols

- `src/formatter/MybatisSqlFormatter.ts` — protected CST formatting.
- `src/formatter/MybatisXmlFormattingProvider.ts` — VS Code formatting adapter.
- `src/core/SqlComposer.ts` — statement extraction and recursive includes.
- `src/hover/XmlSqlHoverProvider.ts` — XML-to-composed-SQL hover.
- `src/hover/JavaSqlHoverProvider.ts` — Java-to-XML hover.
- `src/decorator/MybatisBindingDecorator.ts` — binding gutter decorations.
- `src/decorator/DynamicSqlHighlighter.ts` — dynamic SQL decorations.

## Dependencies

- `sql-formatter` for SQL node formatting.
- `FileMapper` for Java/XML binding lookup.
- Navigation parsers for mapper identity and method positions.

## Configuration

- `mybatis-boost.showBindingIcons`
- `mybatis-boost.highlightDynamicSql`
- `mybatis-boost.dynamicSqlKeywordColor`
- `mybatis-boost.formatter.enabled`
- `mybatis-boost.formatter.language`
- `mybatis-boost.formatter.keywordCase`
- `mybatis-boost.formatter.tabWidth`
- `mybatis-boost.formatter.indentStyle`
- `mybatis-boost.formatter.denseOperators`

## Tests and Fixtures

- `src/test/unit/MybatisSqlFormatter.test.ts`
- `src/test/unit/DynamicSqlHighlighter.test.ts`
- `src/test/unit/core/SqlComposer.test.ts`
- Navigation integration tests indirectly exercise mapper lookup used by Java
  hovers and binding decorations.

There are no dedicated provider-level hover or binding-decoration suites.
Changes to VS Code registration and editor refresh behavior need manual
extension-host verification.

## Change Impact

Formatter token protection affects comments, CDATA, `${...}`, `#{...}`, and
nested dynamic tags. `SqlComposer` changes affect both hover providers.
`FileMapper` changes can alter hover and decoration results even when these
modules are untouched.

## Known Pitfalls

- Formatting must be idempotent and preserve comments, CDATA, parameters, and
  dynamic tag nesting.
- Recursive `<include>` resolution must retain its cycle guard.
- Editor events are asynchronous; refreshes must not apply stale decorations.
- Hover SQL is a readable composition, not necessarily executable dynamic SQL.

## Related Modules

- `navigation.md`
- `parsing-and-type-resolution.md`
- `extension-lifecycle.md`
- `testing.md`
