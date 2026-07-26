# Parameter Validation

> last_verified_commit: fddc067
> source_scope:
> - `src/navigator/diagnostics/ParameterValidator.ts`
> - `src/navigator/parsers/parameterParser.ts`
> - `src/navigator/parsers/javaParser.ts`
> - `src/utils/javaFieldHierarchy.ts`

## Contents

[Responsibilities](#responsibilities) · [Entry Points](#entry-points) ·
[Validation Flow](#validation-flow) · [Valid Sources](#valid-parameter-sources) ·
[Inheritance Cache](#inheritance-cache) · [Tests](#tests-and-fixtures) ·
[Change Impact](#change-impact) · [Known Pitfalls](#known-pitfalls)

## Responsibilities

Validate MyBatis XML parameter references against mapper method parameters,
`parameterType` fields, single-object auto-mapping, inherited fields, and local
dynamic-SQL variables. Emit VS Code diagnostics for undefined names.

`XmlParameterDefinitionProvider` uses much of the same resolution model for
go-to-definition; keep validation and navigation semantics aligned.

## Entry Points

- `ParameterValidator` constructor registers document/configuration/file events.
- `validateDocument(document)` validates a MyBatis mapper XML file.
- `validateStatement(...)` builds valid parameter names and diagnostics.
- `extractParameterReferences`, `extractLocalVariables`, and
  `extractAttributeReferences` parse statement usage.

## Validation Flow

```text
XML open/change/save or Java change
  -> debounced validateDocument
  -> verify mapped MyBatis XML
  -> extract statements
  -> for each statement:
       SQL #{}/ ${} references
       dynamic-tag attribute references
       foreach/bind local variables
       XML parameterType/parameterMap
       matching Java mapper method parameters
       @Param names
       single-object field auto-mapping
       inherited fields
  -> emit error diagnostics for unknown roots
```

Nested expressions such as `user.name` validate the root `user`. Options after
a comma, such as `jdbcType`, are ignored for name validation. XML comments are
removed before extraction.

## Valid Parameter Sources

- explicit `@Param` names;
- method parameter names where applicable;
- `parameterType` own and inherited fields;
- a single object parameter's own and inherited fields;
- `foreach` `item` and `index`;
- `bind` names;
- relevant dynamic-tag attribute roots;
- framework/special names handled by the validator.

A single primitive parameter follows MyBatis behavior and can skip name
validation.

## Inheritance Cache

`getClassFields` uses `getClassFieldsWithInheritance` and caches field-name
arrays, including empty results.

It maintains:

- an LRU field cache;
- `dependencyChains`: cache key → resolved class chain;
- `classDependents`: superclass → cached subclasses.

Editing a superclass invalidates dependent subclass entries. Eviction,
explicit invalidation, and cache clearing unregister dependency edges to keep
bookkeeping bounded.

Java changes also trigger revalidation of open XML documents. Inspect current
event handling before changing dirty-buffer or save behavior.

## Configuration

- `mybatis-boost.enableParameterValidation`

The validator listens for configuration changes, validates open XML when
enabled, and clears diagnostics when disabled.

## Tests and Fixtures

- `src/test/unit/ParameterValidator.test.ts`
- `src/test/unit/ParameterValidator.inheritanceCache.test.ts`
- `src/test/unit/parameterParser.test.ts`
- `parameterParser.localVariables.test.ts`
- `parameterParser.multiline.test.ts`
- `parameterParser.xmlComments.test.ts`
- `src/test/integration/parameterValidator.singleObjectParam.test.ts`
- `src/test/integration/parameterValidator.inheritedFields.test.ts`
- `src/test/integration/xmlParameterNavigation.singleObjectParam.test.ts`
- `src/test/integration/xmlParameterNavigation.inheritedFields.test.ts`
- `src/test/fixtures/parameter-validation/`

## Change Impact

- Parameter extraction changes affect both diagnostics and parameter
  navigation.
- Field-resolution changes affect resultMap property navigation too.
- Cache changes require eviction, invalidation, concurrency, and superclass
  edit tests.
- Event changes require extension-host integration tests with open documents.

## Known Pitfalls

- Do not report XML-comment parameters.
- Do not treat dynamic local variables as mapper arguments.
- Do not validate the leaf of nested OGNL as a root method parameter.
- Keep single-object auto-mapping separate from multiple-parameter semantics.
- Empty results are deliberately cached.
- Overlapping cache misses must replace old dependency-chain registrations.

## Related Modules

- [Parsing and type resolution](parsing-and-type-resolution.md)
- [Navigation](navigation.md)
- [Testing](testing.md)
