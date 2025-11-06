# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyBatis Boost is a high-performance VS Code extension providing comprehensive bidirectional navigation between MyBatis mapper interfaces (Java) and XML mapping files. It features 10 types of Go-to-Definition navigation, real-time parameter validation, visual binding indicators, and flexible navigation modes (CodeLens or DefinitionProvider). The extension achieves sub-100ms navigation latency through LRU caching, file watchers, and optimized parsing.

## Essential Commands

### Development Build & Testing
```bash
# Install dependencies
pnpm install

# Development build (includes type checking and linting)
pnpm run compile

# Watch mode for development
pnpm run watch

# Production build
pnpm run package

# Run all tests (unit + integration)
pnpm test

# Run only unit tests
pnpm run test:unit

# Run only integration tests
pnpm run test:integration

# Type checking without build
pnpm run check-types

# Linting
pnpm run lint
```

### Testing Individual Files
```bash
# Run single unit test file
pnpm exec mocha --require ts-node/register src/test/unit/FileMapper.test.ts

# Debug extension in VS Code
# Press F5 to launch Extension Development Host
```

## Architecture Highlights

### Core Design Patterns

**Modular Structure**: All navigation logic is encapsulated in `src/navigator/` module:
- `core/FileMapper.ts`: Java-XML mapping with LRU cache (default 5000 entries)
- `parsers/`: 4 specialized parsers (javaParser, javaFieldParser, xmlParser, parameterParser)
- `providers/`: 8 DefinitionProviders + 1 CodeLensProvider for different navigation scenarios
- `diagnostics/`: ParameterValidator for real-time parameter validation
- Decorator: MybatisBindingDecorator for visual binding indicators

**Performance Strategy**:
- **LRU Cache**: Stores MappingMetadata with modification timestamps for staleness detection
- **File Watchers**: Incremental updates for `**/*.java` and `**/*.xml` files
- **Quick Path Matching**: Priority-based XML discovery (common structures → custom dirs → full scan)
- **Lazy Parsing**: Full file parsing only when definition is requested

**MyBatis Mapper Detection**: Uses content-based detection (not just filename patterns):
- Must be Java `interface`
- Must contain MyBatis annotations (`@Mapper`, `@Select`, etc.) OR imports (`org.apache.ibatis.*`, `org.mybatis.*`)

### Navigation Capabilities

The extension provides **10 types of Go-to-Definition navigation**:

**Java ↔ XML Bidirectional:**
1. Java interface name → XML `<mapper>` tag
2. Java method name → XML SQL statement (`<select>`, `<insert>`, etc.)
3. XML `namespace` attribute → Java interface
4. XML statement `id` attribute → Java method

**XML Internal References:**
5. XML `<include refid="xxx">` → `<sql id="xxx">` fragment definition
6. XML `<sql id="xxx">` → All `<include>` references (shows all usages)

**Java Class & Field References:**
7. XML class references (`resultType`, `parameterType`, `type`, `ofType`, `javaType`) → Java class
8. XML `<result property="xxx">` → Java field in resultMap type class
9. XML `resultMap="xxx"` reference ↔ `<resultMap id="xxx">` definition (bidirectional)

**Parameter Navigation (NEW):**
10. XML `#{paramName}` or `${paramName}` → Java field or `@Param` annotation
    - Supports navigation to `parameterType` class fields
    - Supports navigation to method parameters with `@Param` annotations
    - Works with nested properties (e.g., `#{user.name}` validates base object `user`)

### XML File Matching Strategy (Priority Order)

When finding XML for a Java mapper, the extension uses a waterfall approach:

1. **Priority 0 - Quick Paths**: Common structures (same dir, `mapper/` subdir, mirrored `resources/` path)
2. **Priority 1 - Custom Directories**: User-configured via `mybatis-boost.customXmlDirectories`
3. **Priority 2 - Common Patterns**: `/mapper/`, `/mappers/`, `/xml/`, `/dao/`, `/mybatis/`
4. **Priority 3 - Package-Based**: Convert Java package to path (e.g., `com.example.UserMapper` → `**/com/example/UserMapper.xml`)
5. **Priority 4 - Full Scan**: All remaining XML files with namespace verification

### Key Data Structures

**MappingMetadata** (src/types.ts):
```typescript
interface MappingMetadata {
    xmlPath: string;      // Absolute path to XML
    javaPath: string;     // Absolute path to Java
    javaModTime: number;  // For cache invalidation
    xmlModTime: number;   // For cache invalidation
    namespace?: string;   // Cached namespace
}
```

**LRUCache** (src/navigator/core/FileMapper.ts):
- Generic `Map`-based implementation
- Auto-evicts least recently used entries when size limit reached
- Bidirectional mapping: both `javaPath` and `xmlPath` keys point to same metadata

### Important Configuration

Settings in `package.json` that affect behavior:
- `mybatis-boost.cacheSize` (default: 5000): LRU cache size
- `mybatis-boost.customXmlDirectories` (default: []): Custom XML search paths (Priority 1)
- `mybatis-boost.javaParseLines` (default: 100): Lines to read for namespace extraction
- `mybatis-boost.showBindingIcons` (default: true): Show gutter icons for Java-XML bindings
- `mybatis-boost.useDefinitionProvider` (default: false): Use DefinitionProvider for Java→XML (when false, uses CodeLens instead)

### Extension Activation

**Activation Triggers**: Only activates if workspace contains Java project indicators:
- `pom.xml` (Maven)
- `build.gradle` or `build.gradle.kts` (Gradle)
- `src/main/java/` directory

**Initialization Flow**:
1. Detect Java project → activate extension
2. Initialize FileMapper with configured cache size
3. Setup file watchers for `**/*.java` and `**/*.xml`
4. Scan workspace for MyBatis mappers (content-based detection)
5. Register 8 XML DefinitionProviders (always enabled)
6. Register Java→XML navigation provider based on configuration:
   - CodeLensProvider (default, non-invasive)
   - OR JavaToXmlDefinitionProvider (optional, F12 navigation)
7. Initialize ParameterValidator for real-time parameter validation
8. Initialize MybatisBindingDecorator if enabled (default: true)

### Excluded Directories

File searches automatically skip: `node_modules`, `target`, `.git`, `.vscode`, `.claude`, `.idea`, `.settings`, `build`, `dist`, `out`, `bin`

## Key Features Implementation

### Parameter Validation (Real-time Diagnostics)

**Location**: `src/navigator/diagnostics/ParameterValidator.ts`

**Functionality**:
- Validates `#{paramName}` and `${paramName}` references in XML SQL statements
- Checks against valid parameter sources:
  1. Method parameters with `@Param` annotations
  2. Fields in `parameterType` class
  3. Local variables from dynamic SQL tags (`foreach`, `bind`)
- Shows error diagnostics (red underlines) for undefined parameters
- Automatically validates on file open, change, and save

**Example**:
```xml
<update id="updateById" parameterType="com.example.Role">
    UPDATE role
    SET role_name = #{roleName},  <!-- ✅ Valid -->
        invalid = #{wrongField}    <!-- ❌ Error: not found -->
    WHERE id = #{id}
</update>
```

### Navigation Modes (Configurable)

**Default Mode: CodeLens** (`useDefinitionProvider: false`)
- Non-invasive: Preserves native Java definition behavior (F12 jumps to Java class)
- Shows clickable "jumpToXml" links above interfaces and methods
- Automatically hides CodeLens for methods with SQL annotations

**Alternative Mode: DefinitionProvider** (`useDefinitionProvider: true`)
- F12 on Java methods jumps directly to XML statements
- Overwrites native Java definition behavior
- More direct navigation but less flexible

**Configuration**: Can be toggled via VS Code settings - changes take effect immediately

### Visual Binding Indicators

**Location**: `src/decorator/MybatisBindingDecorator.ts`

**Functionality**:
- Shows gutter icons next to Java methods that have corresponding XML statements
- Icons appear in both Java and XML files
- Automatically updates when files change
- Can be disabled via `mybatis-boost.showBindingIcons` setting

## Development Guidelines

### Adding New Navigation Features

1. Create new DefinitionProvider in `src/navigator/providers/`
2. Export it from `src/navigator/index.ts`
3. Register in `src/extension.ts` activation function
4. Add tests in `src/test/integration/` or `src/test/unit/`

### Parser Modifications

- **Java Parser** (`src/navigator/parsers/javaParser.ts`):
  - Namespace extraction: lightweight, reads first 100 lines
  - Full method parsing: on-demand only
  - Extracts method names, return types, parameters
  - Handles `@Param` annotations for parameter mapping

- **Java Field Parser** (`src/navigator/parsers/javaFieldParser.ts`):
  - Extracts field declarations from Java classes
  - Used by parameter validation and resultMap navigation
  - Handles visibility modifiers and field types

- **XML Parser** (`src/navigator/parsers/xmlParser.ts`):
  - Namespace extraction: reads first 30 lines
  - Statement extraction: processes entire file
  - Supports multi-line tags
  - Extracts `resultType`, `parameterType` attributes

- **Parameter Parser** (`src/navigator/parsers/parameterParser.ts`):
  - Extracts `#{...}` and `${...}` parameter references
  - Handles nested properties (e.g., `#{user.name}`)
  - Extracts local variables from `foreach`, `bind` tags
  - Supports multi-line SQL statements

### Performance Requirements

Maintain these targets:
- **P50 navigation latency**: < 100ms
- **P95 navigation latency**: < 200ms
- **Activation time**: < 2s (cold start with 1000 mappers)
- **Memory per 100 mappers**: < 10 MB

## Testing Strategy

### Test Structure
- `src/test/unit/`: Fast unit tests for parsers and FileMapper
- `src/test/integration/`: Integration tests for DefinitionProviders
- Test fixtures: `src/test/fixtures/sample-mybatis-project/`

### Running Tests
- **Mocha** for unit tests (fast, no VS Code API)
- **@vscode/test-electron** for integration tests (requires VS Code API)

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `mybatis-boost.clearCache` | - | Clear cache and rebuild all mappings |
| `mybatis-boost.refreshMappings` | - | Refresh mappings with progress notification |
| `mybatis-boost.jumpToXml` | - | Jump from Java method to XML statement (used by CodeLens and manual invocation) |

**Note**: The `jumpToXml` command automatically detects context:
- On interface name → jumps to XML `<mapper>` tag
- On method name → jumps to XML statement with matching `id`

## Known Limitations

1. **Method Overloading**: Jumps to first matching method (no parameter type distinction)
2. **Inner Classes**: Not supported for navigation
3. **Kotlin Mappers**: Java only (Kotlin support not yet implemented)
4. **Multiple XML Files**: First found with matching namespace is used
5. **Parameter Validation**: Does not support `parameterMap` references (future enhancement)
6. **CodeLens Performance**: May be slow on very large mapper interfaces (100+ methods)
