# Java/XML Navigation

> last_verified_commit: fddc067
> source_scope:
> - `src/navigator/core/`
> - `src/navigator/providers/`
> - `src/navigator/parsers/`
> - `src/utils/navigationUtils.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[File Mapping](#file-mapping) · [Provider Map](#provider-map) ·
[Field Navigation](#field-navigation) · [Configuration](#configuration) ·
[Tests](#tests-and-fixtures) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

Resolve mapper Java/XML pairs and provide definitions, CodeLens links, internal
XML references, Java class links, property links, and parameter links.

## Entry Points

- `FileMapper.getXmlPath(javaPath)`
- `FileMapper.getJavaPath(xmlPath)`
- each provider's `provideDefinition`
- `JavaToXmlCodeLensProvider.provideCodeLenses`
- `mybatis-boost.jumpToXml` command in `src/extension.ts`

## File Mapping

`FileMapper.initialize` installs Java/XML watchers without scanning the whole
workspace. Mapping is lazy and bidirectional in an LRU cache.

Java → XML:

1. extract mapper namespace;
2. try common quick paths;
3. find the owning outermost Maven/Gradle project;
4. lazily build a per-project `namespace -> XML paths` index;
5. prefer candidates with the longest common path prefix;
6. verify namespace before returning;
7. cache Java and XML paths with modification times.

XML → Java:

1. extract XML namespace;
2. resolve the namespace as a fully-qualified Java class path;
3. search the same project first, then workspace;
4. cache the pair.

The XML index has watcher invalidation plus a 30-second TTL backstop.

## Provider Map

| Provider | Navigation |
|---|---|
| `JavaToXmlDefinitionProvider` | Java interface/method → mapper XML/statement |
| `JavaToXmlCodeLensProvider` | non-invasive Java → XML links |
| `XmlToJavaDefinitionProvider` | XML namespace/id → Java interface/method |
| `JavaClassDefinitionProvider` | XML class attributes → Java class |
| `XmlSqlFragmentDefinitionProvider` | include `refid` ↔ SQL fragment references |
| `XmlResultMapDefinitionProvider` | `resultMap` reference ↔ definition/references |
| `XmlResultMapPropertyDefinitionProvider` | result property → declaring Java field |
| `XmlParameterDefinitionProvider` | SQL parameter → `@Param`, method parameter object, or Java field |

Several providers use `mapCursorProportionally` and attribute helpers from
`navigationUtils.ts` to preserve cursor position within matching identifiers.

## Field Navigation

`XmlResultMapPropertyDefinitionProvider` finds the enclosing resultMap's type,
then calls `findFieldInHierarchy`.

`XmlParameterDefinitionProvider` resolves the statement, Java mapper method,
method parameters, `parameterType`, and single-object auto-mapping before
calling `findFieldInHierarchy`.

Inherited fields and same-name shadowing are owned by
`src/utils/javaFieldHierarchy.ts`, not by individual providers.

## Dependencies

- Java and XML parsers locate namespaces, methods, statements, and parameters.
- `javaFieldHierarchy` and `javaTypeResolver` handle inherited fields.
- `FileMapper` depends on project detection, workspace search, file times, and
  `LRUCache`.
- Binding decorations and Java SQL hover consume `FileMapper`.

## Configuration

- `mybatis-boost.cacheSize`
- `mybatis-boost.customXmlDirectories` (verify current use before changing)
- `mybatis-boost.javaParseLines`
- `mybatis-boost.useDefinitionProvider`
- `mybatis-boost.showBindingIcons`

## Tests and Fixtures

- `src/test/unit/FileMapper.test.ts`
- `src/test/integration/fileMapper.test.ts`
- `src/test/integration/definitionProviders.test.ts`
- `src/test/integration/preciseNavigation.test.ts`
- `src/test/unit/navigationUtils.test.ts`
- provider-specific unit tests
- parameter-navigation integration suites
- `java-project/integration-test/.../InheritanceNavigationMapper.xml`

## Change Impact

- Mapping changes affect all Java/XML features and decoration refresh.
- Cursor-range changes require precise-navigation tests.
- Field-property changes require parser, hierarchy, provider, and integration
  tests.
- Project scoping changes require multi-module manual fixtures.

## Known Pitfalls

- Do not reintroduce full-workspace startup scans.
- Cache hits must still be checked for staleness.
- Same-named mapper XML files require namespace verification.
- Multi-module projects need an aggregate project index; unrelated projects in
  one workspace must remain isolated.
- A subclass field must win over a same-named superclass field.
- Unsaved Java buffers may differ from parsers that read source from disk;
  verify current implementation before promising dirty-buffer behavior.

## Related Modules

- [Parsing and type resolution](parsing-and-type-resolution.md)
- [Parameter validation](parameter-validation.md)
- [Extension lifecycle](extension-lifecycle.md)
- [Testing](testing.md)
