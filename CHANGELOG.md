# Change Log

English | [简体中文](CHANGELOG.zh-cn.md)

All notable changes to the "mybatis-boost" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.4] - 2025-01-07

### Performance Improvements
- ⚡ **ParameterValidator Debouncing**: Added 500ms debounce to XML text change validation to eliminate lag during rapid typing
  - Validation now triggers only after user stops typing
  - Immediate validation on file save to ensure accuracy
  - Significantly improved editing experience in large XML files

- ⚡ **LRU Field Cache**: Implemented intelligent caching for Java class field lookups with 10x performance boost
  - Added 200-entry LRU cache for `parameterType` class fields
  - Cache hit rate >90% in typical projects
  - Reduced validation time from 2000ms to ~210ms for files with multiple statements using same `parameterType`
  - Smart cache invalidation when Java files are modified
  - Automatic cache of "not found" results to prevent repeated searches

- ⚡ **Optimized FileMapper**: Removed unnecessary debouncing from file watchers
  - Immediate cache updates on file changes for better responsiveness
  - Prevents stale cache issues that could trigger expensive workspace scans
  - Faster CodeLens and decorator updates

### Technical Details
- Added `FieldCache` class with LRU eviction policy
- Implemented `getClassNameFromPath()` for smart cache invalidation
- Support for standard Java source roots (`src/main/java`, `src/test/java`, etc.)
- Fallback support for non-standard project structures

### Impact
- 10x faster parameter validation in files with repeated `parameterType`
- Smooth typing experience with no perceivable lag
- Lower CPU usage during active editing
- Better performance in large projects (5000+ Java files)

## [0.1.0] - Initial Release

### Added
- ✨ **10 types of Go-to-Definition navigation** (F12/Ctrl+Click):
  1. Java interface name → XML `<mapper>` tag
  2. Java method name → XML SQL statement
  3. XML namespace attribute → Java interface
  4. XML statement ID → Java method
  5. Java class references in XML → Java class definition
  6. `<include refid>` → `<sql id>` fragment definition
  7. `<sql id>` → All `<include>` references (shows all usages)
  8. `<result property>` → Java class field definition
  9. `resultMap` reference ↔ `<resultMap>` definition (bidirectional)
  10. XML parameters (`#{paramName}`, `${paramName}`) → Java field or `@Param` annotation

- ✨ **SQL Composition and Hover Preview**: Complete SQL preview with automatic `<include>` resolution
  - **Hover on XML statement IDs**: See complete composed SQL when hovering over statement `id` attributes
  - **Hover on Java mapper methods**: See complete composed SQL when hovering over method names
  - **Automatic `<include>` resolution**: Recursively resolves all `<include refid="xxx">` references
  - **Nested includes support**: Handles SQL fragments containing other includes
  - **Circular reference detection**: Prevents infinite loops with helpful error messages
  - **Missing fragment handling**: Shows clear "Fragment not found" messages
  - **All statement types**: Works with `<select>`, `<insert>`, `<update>`, `<delete>`
  - **Dynamic SQL preserved**: Keeps MyBatis tags (`<if>`, `<where>`, `<trim>`, etc.) for context
  - **Non-invasive UI**: Uses hover tooltips, no CodeLens or decorations
  - **Real-time composition**: Composes SQL on-demand with no performance impact

- ✨ **Parameter Validation**: Real-time validation of `#{param}` and `${param}` references in XML mapper files
  - Validates against `parameterType` class fields
  - Validates against method parameters with `@Param` annotations
  - Validates against local variables from dynamic SQL tags (`foreach`, `bind`)
  - Shows error diagnostics (red underlines) for undefined parameters with helpful error messages
  - Supports nested properties (e.g., `#{user.name}` validates base object `user`)
  - Works across `<select>`, `<insert>`, `<update>`, `<delete>` statements
  - Automatic validation on file open, change, and save

- ✨ **Flexible Navigation Modes**: Choose between CodeLens or DefinitionProvider
  - **CodeLens Mode** (default, recommended): Non-invasive, preserves native Java F12 behavior
  - **DefinitionProvider Mode** (optional): Direct F12 navigation to XML statements
  - Toggle via `mybatis-boost.useDefinitionProvider` setting
  - Changes take effect immediately without restart

- ✨ **CodeLens Provider**: Smart clickable navigation links
  - Shows "jumpToXml" above Java mapper interfaces and methods
  - Automatically hides for methods with SQL annotations (`@Select`, `@Insert`, etc.)
  - Only shows when corresponding XML statements exist
  - Supports multi-line method declarations and generic types

- ✨ **Manual Jump Command**: `mybatis-boost.jumpToXml` command
  - Automatically detects context: interface name vs method name
  - Jump to mapper namespace or specific statement based on cursor position
  - Can be invoked via command palette or CodeLens

- ✨ **Enhanced Parsers**: 4 specialized parsers
  - `javaParser.ts`: Method parameters, `@Param` annotations, return types
  - `javaFieldParser.ts`: Field extraction from Java classes
  - `xmlParser.ts`: Multi-line tags, precise position tracking
  - `parameterParser.ts`: Parameter references, local variables, nested properties

- ✨ **Visual binding indicators** - gutter icons show Java methods ↔ XML statement bindings
- ✨ **LRU cache** with configurable size (default: 5000 entries)
- ✨ **Automatic cache invalidation** on file changes
- ✨ **File system watchers** for incremental updates
- ✨ **Smart MyBatis mapper detection** (content-based, not just filename)
- ✨ **5-tier intelligent XML file matching strategy**
- ✨ **Custom XML directories support** (Priority 1 in matching)
- ✨ **Multi-line tag parsing support**
- ✨ **Configurable settings**