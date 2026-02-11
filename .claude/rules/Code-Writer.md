# MyBatis Boost - Code Writing Rules

## Core Principles

### 1. AST-First Parsing Approach

**Rule: Always prefer AST-based parsing over regex for code and XML analysis.**

- **Java Parsing**: Use `web-tree-sitter` with `tree-sitter-java` WASM grammar
  - File: `src/navigator/parsers/javaTreeSitterParser.ts`
  - Provides accurate syntax tree traversal
  - Handles edge cases (nested generics, annotations, comments)
  - Falls back gracefully to regex only when WASM initialization fails

- **XML Parsing**: Use proper XML parser (e.g., `xmldom`, `fast-xml-parser`) instead of regex
  - Current `xmlParser.ts` uses regex - migrate to AST-based parsing
  - Preserve comments, handle CDATA blocks correctly
  - Extract namespace, statements, and positions from XML tree

- **SQL Parsing**: Use `sql-formatter` library with proper SQL AST
  - Supports multiple dialects (MySQL, PostgreSQL, Oracle, etc.)
  - Do not write custom SQL regex patterns

### 2. WebAssembly (WASM) Performance

**Rule: Leverage WASM for computationally intensive parsing tasks.**

- **tree-sitter WASM**: Already implemented for Java parsing
  - Lazy initialization (only load when needed)
  - Cache parser instance for reuse
  - Handle both production (`dist/wasm/`) and dev (`node_modules/`) paths

- **Future WASM Opportunities**:
  - XML parsing: `xml-wasm` or similar
  - SQL formatting: Evaluate WASM-based SQL formatters

### 3. Mature Libraries Over Regex

**Rule: Use well-maintained libraries with proper parsers instead of regex patterns.**

| Task | Use | Avoid |
|------|-----|-------|
| Java parsing | `web-tree-sitter`, `tree-sitter-java` | Custom regex |
| XML parsing | `fast-xml-parser`, `xmldom`, `libxmljs` | Regex string matching |
| SQL formatting | `sql-formatter`, `sql-formatter-plus` | Custom regex |
| DDL parsing | `sql-ddl-to-json-schema` | Regex pattern matching |

**When Regex Is Acceptable**:
- Simple string matching (e.g., checking if a line contains `<mapper`)
- Token-level extraction after AST parsing
- Non-critical path operations with known-safe input

## Performance Requirements

### Target Metrics

- **P50 navigation latency**: < 100ms
- **P95 navigation latency**: < 200ms
- **Activation time**: < 2s (cold start with 1000 mappers)
- **Memory per 100 mappers**: < 10 MB

### Performance Best Practices

1. **Lazy Loading**: Initialize heavy parsers (tree-sitter) only when needed
2. **LRU Caching**: Cache parsed results with size limits (default 5000 entries)
3. **Incremental Updates**: Use file watchers to update cache incrementally
4. **Partial Parsing**: Read only necessary lines (e.g., first 30-100 lines for namespace)
5. **Avoid Full File Scans**: Use quick path matching before falling back to full scan

### Example: Lazy Parser Initialization

```typescript
// GOOD: Lazy initialization with retry
let parser: Parser | null = null;
let initPromise: Promise<boolean> | null = null;

export async function initTreeSitter(): Promise<boolean> {
    if (parser) return true;
    if (initPromise) return initPromise;
    initPromise = doInit();
    const result = await initPromise;
    if (!result) initPromise = null; // Allow retry
    return result;
}

// BAD: Eager initialization at module load
const parser = new Parser(); // Blocks module loading
```

## Code Style Guidelines

### TypeScript

- Use strict type checking (`strict: true` in tsconfig.json)
- Prefer interfaces over types for object shapes
- Use explicit return types for exported functions
- Avoid `any` - use `unknown` with type guards

### Error Handling

- Never throw for expected error conditions
- Log errors with context (file path, operation)
- Provide graceful fallbacks (e.g., regex fallback when AST fails)

### Example: Error Handling with Fallback

```typescript
// GOOD: AST with regex fallback
export async function extractMethods(content: string): Promise<JavaMethod[]> {
    try {
        if (await initTreeSitter()) {
            return await extractMethodsFromAST(content);
        }
    } catch (e) {
        console.warn('[javaParser] AST failed, falling back to regex:', e);
    }
    return extractMethodsViaRegex(content); // Fallback
}
```

## Testing Requirements

### Unit Tests

- Test all parsers with edge cases
- Include malformed input tests
- Test performance with large files (1000+ lines)

### Integration Tests

- Test end-to-end navigation flows
- Test with real MyBatis projects
- Verify cache invalidation

### Test File Location

- Unit tests: `src/test/unit/**/*.test.ts`
- Integration tests: `src/test/integration/**/*.test.ts`
- Fixtures: `src/test/fixtures/sample-mybatis-project/`

## Specific Module Guidelines

### Java Parser (`javaTreeSitterParser.ts`)

- Use `web-tree-sitter` for all AST operations
- Extract: methods, parameters, fields, namespace, annotations
- Handle: generic types, annotations, multi-line declarations

### XML Parser (`xmlParser.ts`)

- **TODO**: Migrate from regex to proper XML parser
- Extract: namespace, statements, resultMap, sql fragments
- Preserve: comments, CDATA blocks, whitespace

### Parameter Parser (`parameterParser.ts`)

- Extract `#{param}` and `${param}` references
- Support nested properties (e.g., `#{user.name}`)
- Handle dynamic SQL tags (`foreach`, `bind`)

### SQL Formatter (`MybatisSqlFormatter.ts`)

- Use `sql-formatter` library
- Support: keyword case, indentation, dialect detection
- Preserve: dynamic SQL tags, comments, CDATA

## Migration Path

### XML Parser Migration

1. Add `fast-xml-parser` or similar to dependencies
2. Create `xmlTreeParser.ts` alongside existing `xmlParser.ts`
3. Implement AST-based extraction methods
4. Add comprehensive tests
5. Replace regex-based parser calls
6. Remove old regex implementation

### Performance Validation

After any parser changes:
1. Run benchmarks with 1000+ mapper files
2. Verify P50/P95 latency targets
3. Profile memory usage
4. Test with VS Code profiler

## Dependencies

### Approved Libraries

| Library | Purpose | License |
|---------|---------|---------|
| `web-tree-sitter` | WASM-based parsing | MIT |
| `tree-sitter-java` | Java grammar | MIT |
| `fast-xml-parser` | XML parsing | MIT |
| `sql-formatter` | SQL formatting | Apache-2.0 |
| `sql-ddl-to-json-schema` | DDL parsing | MIT |

### Adding New Dependencies

1. Check license compatibility (MIT, Apache-2.0, BSD preferred)
2. Verify active maintenance (commits within last 6 months)
3. Check bundle size impact
4. Prefer TypeScript-compatible packages
