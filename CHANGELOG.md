# Change Log

All notable changes to the "mybatis-boost" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- ✨ **Parameter Validation**: Real-time validation of `#{param}` and `${param}` references in XML mapper files
  - Validates against `parameterType` class fields
  - Validates against method parameters with `@Param` annotations
  - Shows error diagnostics for undefined parameters
  - Supports nested properties (e.g., `#{user.name}`)
  - Works across `<select>`, `<insert>`, `<update>`, `<delete>` statements
- ✨ **Parameter Navigation**: Go-to-Definition (F12) from XML parameters to Java
  - Navigate from `#{paramName}` to Java class field
  - Navigate from `#{paramName}` to `@Param` annotation in method
  - Type 10 of navigation support added

### Fixed
- **Navigation Precision**: XML statement to Java method navigation now only works when cursor is specifically on the `id="methodName"` attribute. Previously, clicking anywhere inside the statement block would trigger navigation, which was too permissive and could cause unintended navigation.
- **API Usage**: Fixed incorrect usage of `getByXmlPath()` - now correctly uses `getJavaPath()` API method

## [0.0.1] - Initial Release

### Added
- ✨ **9 types of Go-to-Definition navigation** (F12/Ctrl+Click):
  1. Java interface name → XML `<mapper>` tag
  2. Java method name → XML SQL statement
  3. XML namespace attribute → Java interface
  4. XML statement ID → Java method
  5. Java class references in XML → Java class definition
  6. `<include refid>` → `<sql id>` fragment definition
  7. `<sql id>` → All `<include>` references (shows all usages)
  8. `<result property>` → Java class field definition
  9. `resultMap` reference ↔ `<resultMap>` definition (bidirectional)
- ✨ Visual binding indicators - gutter icons show Java methods ↔ XML statement bindings
- ✨ LRU cache with configurable size (default: 5000 entries)
- ✨ Automatic cache invalidation on file changes
- ✨ File system watchers for incremental updates
- ✨ Smart MyBatis mapper detection (content-based, not just filename)
- ✨ 5-tier intelligent XML file matching strategy
- ✨ Custom XML directories support (Priority 1 in matching)
- ✨ Multi-line tag parsing support
- ✨ Configurable settings