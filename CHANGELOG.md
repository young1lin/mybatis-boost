# Change Log

English | [简体中文](CHANGELOG.zh-cn.md)

All notable changes to the "mybatis-boost" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1] - Initial Release

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

### Fixed
- 🐛 **Navigation Precision**: XML statement to Java method navigation now only works when cursor is specifically on the `id="methodName"` attribute. Previously, clicking anywhere inside the statement block would trigger navigation, which was too permissive and could cause unintended navigation.
- 🐛 **API Usage**: Fixed incorrect usage of `getByXmlPath()` - now correctly uses `getJavaPath()` API method
- 🐛 **Command Invocation**: Fixed `jumpToXml` command to work with both CodeLens and manual invocation, with proper cursor position detection