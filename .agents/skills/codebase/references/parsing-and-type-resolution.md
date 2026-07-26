# Parsing and Java Type Resolution

> last_verified_commit: fddc067
> source_scope:
> - `src/navigator/parsers/`
> - `src/utils/javaTypeResolver.ts`
> - `src/utils/javaLSHelper.ts`
> - `src/utils/javaFieldHierarchy.ts`
> - `src/utils/navigationUtils.ts`

## Contents

[Responsibilities](#responsibilities) · [Parser Layers](#parser-layers) ·
[Tree-sitter Runtime](#tree-sitter-runtime) ·
[Type Resolution](#type-resolution) · [Inheritance](#inheritance) ·
[Tests](#tests-and-fixtures) · [Change Impact](#change-impact) ·
[Known Pitfalls](#known-pitfalls)

## Responsibilities

Extract Java mapper structure, fields, method parameters, packages, and
superclasses; parse mapper XML structure; resolve Java type names; and walk
workspace-source inheritance chains.

## Parser Layers

`javaParser.ts` handles mapper namespaces, mapper detection, methods, and method
parameters:

```text
tree-sitter AST
  -> regex fallback
```

`javaFieldParser.ts` handles class fields:

```text
tree-sitter AST
  -> Java Language Server document symbols
  -> regex fallback
```

Superclass extraction uses:

```text
tree-sitter AST
  -> class-name-anchored regex fallback
```

`xmlParser.ts` extracts namespaces, statements, IDs, and precise positions.
`parameterParser.ts` owns SQL parameter and dynamic-tag expression extraction.

## Tree-sitter Runtime

`javaTreeSitterParser.ts` lazily initializes `web-tree-sitter` with:

- `web-tree-sitter.wasm`
- `tree-sitter-java.wasm`

It scopes field/superclass extraction to the requested top-level type so nested
or sibling classes cannot leak fields or `extends` clauses.

`esbuild.js` forces the CommonJS `web-tree-sitter` entry and copies both WASM
files to `dist/wasm`. Parser changes therefore have bundle/runtime impact.

## Type Resolution

`resolveFullyQualifiedType(javaPath, simpleTypeName)` follows Java precedence:

1. explicit imports;
2. same-package workspace source;
3. wildcard-import workspace source;
4. Java LS workspace symbols as the last resort.

Already-qualified names pass through. Java LS must not outrank same-package
source because symbol search can return the first simple-name match from an
unrelated package.

`findJavaClassFile` converts a fully-qualified name to a package path and can
scope search to a project root.

## Inheritance

`javaFieldHierarchy.ts` is shared by navigation and diagnostics.

```text
requested class
  -> findJavaClassFile
  -> extract own fields
  -> extract superclass
  -> resolveFullyQualifiedType
  -> repeat, subclass first
```

Rules:

- maximum depth is 10;
- stop on cycles;
- stop when source is outside the workspace;
- stop after resolving a built-in type;
- subclass fields shadow same-named superclass fields;
- return the declaring file and class for navigation;
- anchor superclass extraction to the visited class.

## Key Files and Symbols

- `initTreeSitter`
- `extractMethodsFromAST`
- `extractParametersFromAST`
- `extractFieldsFromAST`
- `extractSuperclassNameFromAST`
- `extractJavaFields`
- `extractSuperclassName`
- `resolveFullyQualifiedType`
- `resolveTypeViaLS`
- `getClassFieldsViaLS`
- `getClassFieldsWithInheritance`
- `findFieldInHierarchy`

## Tests and Fixtures

- `src/test/unit/javaTreeSitterParser.test.ts`
- `src/test/unit/javaParser.test.ts`
- `src/test/unit/javaParser.methodParameters.test.ts`
- `src/test/unit/javaFieldParser.test.ts`
- `src/test/unit/javaTypeResolver.test.ts`
- `src/test/unit/javaLSHelper.test.ts`
- `src/test/unit/javaFieldHierarchy.test.ts`
- `src/test/unit/navigationUtils.test.ts`
- inherited-field integration fixtures under `src/test/fixtures/parameter-validation/`

## Change Impact

Parser changes can affect mapper mapping, every navigation provider, diagnostics,
CodeLens, hover, and binding icons. Run both parser unit tests and related
extension-host provider tests.

WASM-path or import changes require a production-like bundle check, not only
TypeScript execution.

## Known Pitfalls

- Regex fallbacks must ignore comments and nested-type fields.
- Generic bounds such as `T extends Number` are not class superclasses.
- A user class may shadow a `java.lang` short name; check built-in status only
  after resolving the full name.
- Java LS readiness does not guarantee a workspace-symbol request will be fast.
- Disk-based reads do not automatically include unsaved editor content.

## Related Modules

- [Navigation](navigation.md)
- [Parameter validation](parameter-validation.md)
- [Maintenance](maintenance.md)
- [Testing](testing.md)
