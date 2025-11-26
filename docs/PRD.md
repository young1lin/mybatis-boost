# Product Requirements Document: MyBatis Boost VS Code Extension
**Version:** 0.0.1
**Last Updated:** 2025-11-06
**Document Status:** Implemented
**Author:** young1lin

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Core Features](#core-features)
4. [Technical Architecture](#technical-architecture)
5. [Performance Requirements](#performance-requirements)
6. [User Interface & Experience](#user-interface--experience)
7. [Configuration Options](#configuration-options)
8. [Future Enhancements](#future-enhancements)

---

## Executive Summary

MyBatis Boost is a high-performance VS Code extension providing comprehensive bidirectional navigation between MyBatis mapper interfaces (Java) and XML mapping files. The extension features 10 types of Go-to-Definition navigation, real-time parameter validation, visual binding indicators, and flexible navigation modes. It achieves sub-100ms navigation latency through LRU caching, file watchers, and optimized parsing.

### Key Highlights
- ✅ **10 types of Go-to-Definition navigation** (F12/Ctrl+Click)
- ✅ **Real-time parameter validation** with error diagnostics
- ✅ **Visual binding indicators** (gutter icons)
- ✅ **Flexible navigation modes**: CodeLens (default) or DefinitionProvider (optional)
- ✅ **Sub-100ms navigation latency** (P50 < 100ms, P95 < 200ms)
- ✅ **LRU caching** with configurable size (default: 5000 entries)
- ✅ **Automatic cache invalidation** on file changes
- ✅ **Scalable architecture** supporting 1,000+ mapper files

---

## Product Overview

### Problem Statement
Developers working with MyBatis ORM frequently need to navigate between Java mapper interfaces and XML SQL mapping files. Manual navigation is time-consuming and error-prone, especially in large projects with hundreds of mappers.

### Solution
MyBatis Boost provides instant, accurate bidirectional navigation with multiple interaction methods:
1. **Go-to-Definition** (F12 or Ctrl+Click) - Standard IDE navigation for XML → Java
2. **CodeLens** (default) - Clickable links above Java interfaces/methods
3. **DefinitionProvider** (optional) - Direct F12 navigation for Java → XML
4. **Manual Command** - `jumpToXml` command with context detection
5. **Parameter Validation** - Real-time error diagnostics for undefined parameters
6. **Visual Indicators** - Gutter icons showing method-statement bindings

### Target Users
- Java developers using MyBatis framework
- Teams maintaining large MyBatis-based applications
- Developers who value productivity and code navigation efficiency

---

## Core Features (Implementation Status)

### 1. Bidirectional Navigation ✅ IMPLEMENTED

#### 1.1 Java to XML Navigation
**Implementation Status**: ✅ COMPLETED

**Description**: Navigate from Java mapper interface methods to corresponding XML SQL statements.

**Interaction Methods** (All Implemented):
- **CodeLens** (default): Clickable "jumpToXml" links above interfaces and methods
  - Automatically detects interface name vs method name
  - Hides for methods with SQL annotations
  - Only shows when corresponding XML statements exist
- **DefinitionProvider** (optional): F12 or Ctrl+Click on method name jumps to XML statement
  - Enable via `mybatis-boost.useDefinitionProvider: true`
  - Overwrites native Java definition behavior
- **Manual Command**: `mybatis-boost.jumpToXml`
  - Auto-detects cursor position (interface vs method)
  - Can be invoked via command palette

**Behavior** (As Implemented):
- Cursor on interface name → jumps to XML `<mapper>` tag with namespace
- Cursor on method name → jumps to exact line of matching SQL statement in XML
- If method not found in XML, shows warning message
- If no XML mapping exists, shows error message
- Supports multi-line method declarations and generic types

**Technical Details**:
- Uses `JavaToXmlCodeLensProvider` for CodeLens mode (default)
- Uses `JavaToXmlDefinitionProvider` for F12 mode (optional)
- Extracts method names using regex parsing
- Searches XML file for `<select|insert|update|delete id="methodName">`
- Handles multi-line XML tags correctly
- Uses LRU cache to avoid repeated file parsing
- Position tracking for precise navigation

#### 1.2 XML to Java Navigation
**Implementation Status**: ✅ COMPLETED

**Description**: Navigate from XML SQL statements to corresponding Java mapper interface methods.

**Interaction Methods** (As Implemented):
- **Go-to-Definition**: F12 or Ctrl+Click on `id` attribute value jumps to Java method
- **Precise Navigation**: Only works when cursor is on the `id="methodName"` attribute (not anywhere in the statement body)

**Behavior** (As Implemented):
- Cursor on statement `id` attribute → jumps to exact line of matching method in Java interface
- If method not found in Java, shows warning message
- If no Java interface exists, shows error message
- Navigation precision prevents accidental jumps

**Technical Details**:
- Uses `XmlToJavaDefinitionProvider`
- Extracts statement ID from XML tag's `id` attribute
- Precise cursor position detection (only on `id` attribute)
- Searches Java interface for method with matching name
- Handles method overloading by jumping to first match
- Uses FileMapper for reverse mapping (XML → Java)

#### 1.3 Java Class Reference Navigation
**Implementation Status**: ✅ COMPLETED

**Description**: Navigate from Java class names in XML attributes to their definitions.

**Interaction Methods** (As Implemented):
- **Go-to-Definition**: F12 or Ctrl+Click on class name in XML

**Supported Attributes** (All Implemented):
- `resultType="com.example.User"`
- `parameterType="com.example.UserQuery"`
- `type="com.example.TypeHandler"`
- `ofType="com.example.Item"`
- `javaType="java.lang.String"`

**Behavior** (As Implemented):
- Converts fully-qualified class name to file path
- Searches workspace for matching `.java` file
- Opens file at class/interface/enum declaration line
- Skips built-in types (primitives, java.lang classes)

**Technical Details**:
- Uses `JavaClassDefinitionProvider`
- Converts class name to file pattern (e.g., `com.example.User` → `**/com/example/User.java`)
- Uses `vscode.workspace.findFiles` for fast search
- Excluded directories: node_modules, target, build, etc.

#### 1.4 Additional Navigation Types ✅ IMPLEMENTED

**SQL Fragment References** (Type 5 & 6):
- `<include refid="xxx">` → `<sql id="xxx">` definition
- `<sql id="xxx">` → All `<include>` references
- Uses `XmlSqlFragmentDefinitionProvider`

**ResultMap Navigation** (Type 8 & 9):
- `<result property="xxx">` → Java field in resultMap type class
- `resultMap="xxx"` ↔ `<resultMap id="xxx">` (bidirectional)
- Uses `XmlResultMapPropertyDefinitionProvider` and `XmlResultMapDefinitionProvider`

**Parameter Navigation** (Type 10 - NEW):
- `#{paramName}` or `${paramName}` → Java field or `@Param` annotation
- Supports `parameterType` class fields
- Supports method parameters with `@Param` annotations
- Handles nested properties (e.g., `#{user.name}`)
- Uses `XmlParameterDefinitionProvider`

### 2. High-Performance Caching System ✅ IMPLEMENTED

#### 2.1 LRU Cache Architecture
**Implementation Status**: ✅ COMPLETED

- **LRU In-Memory Cache**: Default 5,000 entries (configurable via `mybatis-boost.cacheSize`)
- **Bidirectional Mapping**: Both `javaPath` and `xmlPath` keys point to same metadata
- **Automatic Eviction**: Least recently used entries evicted when size limit reached
- Generic `Map`-based implementation in `FileMapper.ts`

#### 2.2 Cache Invalidation Strategy
**Implementation Status**: ✅ COMPLETED

- **File modification timestamps** (`mtimeMs`) tracked for each mapping
- **Automatic invalidation** when file system watcher detects changes
- **Manual refresh** via commands:
  - `mybatis-boost.clearCache` - Clear and rebuild
  - `mybatis-boost.refreshMappings` - Refresh with progress notification

#### 2.3 Incremental Updates
**Implementation Status**: ✅ COMPLETED

- **File watchers** for `**/*.java` and `**/*.xml` (all files, not just *Mapper)
- **Automatic updates** on create/change/delete events
- **Partial updates**: Only re-parse changed files
- Content-based mapper detection (requires `@Mapper` annotation or MyBatis imports)

### 3. Definition Providers ✅ IMPLEMENTED

All 8 definition providers have been implemented and tested:

#### 3.1 Java Method Definition Provider (Optional)
**Implementation Status**: ✅ COMPLETED (Optional Feature)

- **Provider**: `JavaToXmlDefinitionProvider`
- **Configuration**: `mybatis-boost.useDefinitionProvider` (default: false)
- **When enabled**: F12 on Java methods jumps to XML statements
- **Performance**: < 100ms response time
- **Note**: Disabled by default to preserve native Java navigation

#### 3.2 Java CodeLens Provider (Default)
**Implementation Status**: ✅ COMPLETED

- **Provider**: `JavaToXmlCodeLensProvider`
- **Default Mode**: Shows clickable "jumpToXml" links
- **Features**:
  - Detects interface declarations and method declarations
  - Hides for methods with SQL annotations
  - Only shows when XML statements exist
  - Supports multi-line method signatures and generics

#### 3.3 XML Statement Definition Provider
**Implementation Status**: ✅ COMPLETED

- **Provider**: `XmlToJavaDefinitionProvider`
- **Precise Navigation**: Only works on `id` attribute
- **Performance**: < 100ms response time
- **Uses**: FileMapper reverse mapping (XML → Java)

#### 3.4 Additional Definition Providers (All Completed)

1. **JavaClassDefinitionProvider**: XML class references → Java class
2. **XmlSqlFragmentDefinitionProvider**: SQL fragment references
3. **XmlResultMapPropertyDefinitionProvider**: ResultMap property → Java field
4. **XmlResultMapDefinitionProvider**: ResultMap references
5. **XmlParameterDefinitionProvider**: Parameter references → Java field/@Param

### 4. Parameter Validation ✅ NEW FEATURE

**Implementation Status**: ✅ COMPLETED

**Location**: `src/navigator/diagnostics/ParameterValidator.ts`

**Features**:
- Real-time validation of `#{param}` and `${param}` references
- Error diagnostics (red underlines) for undefined parameters
- Validates against:
  - Method parameters with `@Param` annotations
  - Fields in `parameterType` class
  - Local variables from `foreach`, `bind` tags
- Supports nested properties (e.g., `#{user.name}`)
- Automatic validation on file open, change, and save

**Performance**:
- Lazy validation (only validates visible documents)
- Efficient field/parameter extraction
- No impact on navigation performance

### 5. Visual Binding Indicators ✅ NEW FEATURE

**Implementation Status**: ✅ COMPLETED

**Location**: `src/decorator/MybatisBindingDecorator.ts`

**Features**:
- Gutter icons next to Java methods with corresponding XML statements
- Icons appear in both Java and XML files
- Automatically updates when files change
- Configurable via `mybatis-boost.showBindingIcons` (default: true)

**Performance**:
- Efficient decoration updates
- No impact on navigation performance

### 6. Configuration Options ✅ IMPLEMENTED

All configuration options have been implemented in `package.json`:

| Setting | Type | Default | Status |
|---------|------|---------|--------|
| `mybatis-boost.cacheSize` | number | 5000 | ✅ |
| `mybatis-boost.customXmlDirectories` | array | [] | ✅ |
| `mybatis-boost.javaParseLines` | number | 100 | ✅ |
| `mybatis-boost.showBindingIcons` | boolean | true | ✅ |
| `mybatis-boost.useDefinitionProvider` | boolean | false | ✅ |

---

## Technical Architecture

### Extension Activation
1. **Java Project Detection**
   - Check for `pom.xml`, `build.gradle`, `build.gradle.kts`, or `src/main/java/`
   - If not found, extension remains dormant

2. **FileMapper Initialization**
   - Load persistent cache from global state
   - If cache is valid (version matches), use cached mappings
   - Otherwise, perform initial workspace scan

3. **Provider Registration**
   - Register Definition providers for Java and XML files
   - Enable Go-to-Definition navigation for methods and statements

4. **File Watcher Setup**
   - Watch `**/*Mapper.java` for create/change/delete events
   - Watch `**/*Mapper.xml` for create/change/delete events
   - Batch updates with 500ms debounce

### File Mapping Strategy

#### 1. Mapper Interface Detection
Not all Java interface files are MyBatis mappers. The extension uses intelligent detection to identify valid mapper interfaces:

**Detection Criteria** (All must be true):
1. File must be a Java interface (`interface` keyword present)
2. Must have MyBatis indicators:
   - **MyBatis annotations**: `@Mapper`, `@Select`, `@Insert`, `@Update`, `@Delete`
   - **OR MyBatis imports**: `org.apache.ibatis.*` or `org.mybatis.*`

**Performance Optimization**:
- Uses cached regex for pattern matching (prevents ReDoS)
- Leverages FileUtils for cached file reading
- Records execution time for performance monitoring

**Example Valid Mapper**:
```java
package com.example.mapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
```

**Example Invalid (Skipped)**:
```java
package com.example.service;
// No MyBatis annotations or imports
public interface UserService {
    User getUser(Long id);
}
```

#### 2. Java File Parsing
**Namespace Extraction** (Lightweight):
- Read first 100 lines only
- Extract `package` statement
- Extract `interface` name
- Combine as `{package}.{interfaceName}`

**Full Parsing** (On-Demand):
- Parse all method declarations
- Extract method names, return types, parameters
- Extract `@Param` annotations for parameter mapping
- Remove annotations before parsing signatures

#### 3. XML File Parsing
**Namespace Extraction** (Lightweight):
- Read first 30 lines only
- Extract `namespace` attribute from `<mapper>` tag

**Full Parsing** (On-Demand):
- Extract all SQL statement tags with `id` attributes
- Record line numbers for each statement
- Optionally extract `resultType` attributes

#### 4. Intelligent XML Matching (Multi-Tier Strategy)

When searching for the XML file corresponding to a Java mapper interface, the extension uses a **prioritized waterfall strategy** to maximize performance and accuracy:

##### **Priority 0: Quick Path (Fastest)**
Try common MyBatis project structures first:
- Same directory as Java file: `/path/to/UserMapper.xml`
- Subdirectory `mapper/`: `/path/to/mapper/UserMapper.xml`
- Resources mirror structure: `src/main/resources/mapper/UserMapper.xml`
- Resources same directory: `src/main/resources/UserMapper.xml`

**Example**:
```
src/main/java/com/example/UserMapper.java
→ Check: src/main/resources/mapper/UserMapper.xml ✓
```

##### **Priority 1: User-Configured XML Directories**
If user has configured custom XML directories via `mybatis-boost.customXmlDirectories`:
```json
{
  "mybatis-boost.customXmlDirectories": [
    "src/main/resources/mybatis/mappers",
    "config/xml"
  ]
}
```
- Search these directories first
- Verify namespace matches Java class

##### **Priority 2: Common Mapper Directories**
Search files in standard MyBatis directory patterns:
- `/mapper/`, `/mappers/`, `/xml/`, `/dao/`, `/mybatis/`

**Flexible File Name Matching**:
- Exact match: `UserMapper.xml`
- With suffix: `User.xml` + `UserMapper.xml`
- DAO pattern: `UserDao.xml`

**Namespace Verification**:
- Extract namespace from XML `<mapper namespace="...">`
- Compare with Java full class name (`com.example.UserMapper`)
- If namespace missing, fallback to file name match

##### **Priority 3: Package-Based Smart Search**
Convert Java package to directory path and search:
```
Java: com.example.mapper.UserMapper
→ Search: **/com/example/mapper/UserMapper.xml
```

##### **Priority 4: Remaining Files (Full Scan)**
If still not found, scan all remaining XML files not covered by priorities 2-3.

**Fallback Strategy**:
- If namespace verification fails, use file name match as last resort
- Show warning if multiple candidates found

#### 5. Java Extension Integration (Optional Enhancement)

**Current Status**: Planned feature, not yet implemented.

**Objective**: Optionally leverage Red Hat's "Language Support for Java" extension for advanced parsing capabilities.

**Detection Strategy**:
```typescript
// Check if Java extension is installed
const javaExt = vscode.extensions.getExtension('redhat.java');
const LSJSupported = javaExt !== undefined && javaExt.isActive;
```

**Enhanced Capabilities** (When Available):
- Use Java language server for method metadata extraction
- Better handling of complex generics
- Support for nested classes and inner interfaces
- Accurate parameter type resolution

**Fallback Behavior**:
- If Java extension not installed or inactive, use regex-based parsing
- Configurable line limit: `mybatis-boost.java.parseLines` (default: 100)
- No loss of core functionality

**Benefits**:
- More accurate method signature parsing
- Support for complex Java language features
- Better IDE integration

**Implementation Status**: To be implemented in future version

### Data Structures

#### MappingMetadata
```typescript
interface MappingMetadata {
    xmlPath: string;           // Absolute path to XML file
    javaPath: string;          // Absolute path to Java file
    javaModTime: number;       // Java file mtime (milliseconds)
    xmlModTime: number;        // XML file mtime (milliseconds)
    namespace?: string;        // Cached namespace value
}
```

#### LRUCache
- Generic key-value cache with configurable max size
- Automatic eviction of least-recently-used entries
- Import/export for persistence

#### PathTrie
- Prefix tree for fast file path lookup by filename
- O(k) search complexity (k = path depth)
- Significantly faster than linear search in large projects

---

## Performance Requirements

### Navigation Latency
| Metric | Target | Measured (Current Implementation) |
|--------|--------|-----------------------------------|
| P50 (Median) | < 100ms | ~50-80ms |
| P95 | < 200ms | ~120-180ms |
| P99 | < 500ms | ~200-400ms |

### Activation Time
- **Target**: < 2 seconds
- **With Persistent Cache**: < 500ms
- **Cold Start (1000 mappers)**: < 2 seconds

### Memory Footprint
- **Target**: < 10 MB per 100 mappers
- **LRU Cache (1000 entries)**: ~5-8 MB
- **Path Trie**: ~2-3 MB

### Scalability
- **Support 1,000+ mappers** without performance degradation
- **Support 10,000+ mappers** with acceptable performance (< 5s activation)

---

## User Interface & Experience

### Commands
| Command | Keybinding | Description |
|---------|-----------|-------------|
| `mybatis-boost.jumpToXml` | Alt+Shift+X | Jump from Java method to XML statement |
| `mybatis-boost.jumpToJava` | Alt+Shift+J | Jump from XML statement to Java method |
| `mybatis-boost.clearCache` | - | Clear cache and rebuild all mappings |
| `mybatis-boost.refreshMappings` | - | Refresh mappings with progress notification |
| `mybatis-boost.showPerformanceStats` | - | Display performance statistics |

### Visual Indicators

#### 1. Go-to-Definition Hover
- Hover over Java method name: Shows "Go to XML statement"
- Hover over XML `id` attribute: Shows "Go to Java method"
- Hover over Java class reference: Shows "Go to definition"

#### 2. Warning Messages
- "No XML mapping file found for this Java mapper interface"
- "No Java mapper interface found for this XML file"
- "Method 'methodName' not found in XML mapping file"
- "Method 'methodName' not found in Java mapper interface"

#### 3. Progress Notifications
- Shown during "Refresh Mappings" operation
- Non-cancellable, auto-dismiss on completion

---

## Implemented Configuration Options

### ✅ `mybatis-boost.cacheSize`
- **Type**: Number
- **Default**: 5000
- **Description**: Maximum number of mapper file pairs to cache in memory (LRU cache size)
- **Status**: IMPLEMENTED

### ✅ `mybatis-boost.customXmlDirectories`
- **Type**: Array of strings
- **Default**: `[]` (empty array)
- **Description**: Custom directories to search for XML mapper files, relative to workspace root. These directories are checked with **Priority 1** in the XML matching strategy.
- **Status**: IMPLEMENTED
- **Example**:
  ```json
  {
    "mybatis-boost.customXmlDirectories": [
      "src/main/resources/mybatis/mappers",
      "config/xml"
    ]
  }
  ```

### ✅ `mybatis-boost.javaParseLines`
- **Type**: Number
- **Default**: 100
- **Range**: 20-200
- **Description**: Number of lines to read from Java files for namespace extraction. Lower values improve performance but may fail on files with many imports/comments at the top.
- **Status**: IMPLEMENTED

### ✅ `mybatis-boost.showBindingIcons`
- **Type**: Boolean
- **Default**: true
- **Description**: Show gutter icons for MyBatis bindings between Java methods and XML statements
- **Status**: IMPLEMENTED

### ✅ `mybatis-boost.useDefinitionProvider`
- **Type**: Boolean
- **Default**: false
- **Description**: Enable DefinitionProvider mode for Java-to-XML navigation. When false (default), uses CodeLens mode which preserves native Java F12 behavior.
- **Status**: IMPLEMENTED

---

## Future Enhancements

### ✅ Completed in Current Version

1. **Method-Level Definition Providers** - ✅ IMPLEMENTED
   - Both Java → XML and XML → Java navigation
   - CodeLens and DefinitionProvider modes
   - See Core Features section

2. **Parameter Validation** - ✅ IMPLEMENTED
   - Real-time diagnostics for undefined parameters
   - Validates against multiple sources
   - See Parameter Validation section

3. **Visual Binding Indicators** - ✅ IMPLEMENTED
   - Gutter icons for method-statement bindings
   - See Visual Binding Indicators section

### High Priority (Future Work)

#### 1. Java Extension Integration
**Description**: Leverage Red Hat's "Language Support for Java" extension for advanced parsing capabilities.

**Current Status**: Planned (not yet implemented)

**Requirements**:
- Detect Java extension installation: `vscode.extensions.getExtension('redhat.java')`
- Use Java language server API for method metadata extraction
- Implement graceful fallback to regex parsing when extension unavailable
- Add configuration option: `mybatis-boost.preferJavaExtension` (default: true)

**Benefits**:
- More accurate method signature parsing (handles complex generics)
- Support for nested classes and inner interfaces
- Better parameter type resolution
- Improved handling of annotations

**Implementation Complexity**: Medium (3-4 days)

#### 2. Rename Refactoring Support
**Description**: Automatically update XML statement IDs when Java method is renamed.

**Requirements**:
- Listen to Java file rename events
- Detect method name changes
- Update corresponding XML statement `id` attributes
- Show confirmation dialog before making changes

**Implementation Complexity**: High (1 week)

### Medium Priority (Future Work)

#### 3. Enhanced Validation
**Description**: Additional validation and diagnostics beyond parameter validation.

**Examples**:
- Java method exists but no XML statement (warning)
- XML statement exists but no Java method (warning)
- Return type mismatch between Java and XML
- Method overloading detection

**Implementation Complexity**: Medium (3-5 days)

### Low Priority (Future Work)

#### 4. Multi-Workspace Support
**Description**: Support projects with multiple workspace folders.

**Requirements**:
- Maintain separate caches per workspace folder
- Handle cross-workspace navigation

**Implementation Complexity**: Medium (3-4 days)

**Note**: Current implementation uses content-based detection (not file name patterns), so custom patterns are not needed. The extension automatically detects any Java interface with `@Mapper` annotation or MyBatis imports, regardless of file name.

---

## Appendix

### Excluded Directories
The extension automatically excludes the following directories from file searches:
- `node_modules`
- `target` (Maven build output)
- `.git`
- `.vscode`
- `.claude`
- `.idea` (IntelliJ IDEA)
- `.settings` (Eclipse)
- `build` (Gradle build output)
- `dist`
- `out`
- `bin`

### File Matching Patterns

#### Java Mapper Detection
The extension does **NOT** rely solely on file name patterns. Instead, it uses **content-based detection**:

**Detection Algorithm**:
1. Scan all `**/*.java` files in workspace (excluding build directories)
2. For each file, check:
   - Contains `interface` keyword
   - Contains MyBatis annotations (`@Mapper`, `@Select`, `@Insert`, `@Update`, `@Delete`)
   - **OR** contains MyBatis imports (`org.apache.ibatis.*`, `org.mybatis.*`)

**Common File Name Patterns** (detected automatically):
- `*Mapper.java` (e.g., `UserMapper.java`)
- `*Dao.java` (e.g., `UserDao.java`)
- Any Java interface with MyBatis annotations/imports

#### XML Mapper Matching
For each detected Java mapper, search for corresponding XML file using **prioritized strategy**:

1. **Quick path**: Common project structures
   - Same directory, `mapper/` subdirectory, mirrored `resources/` path
2. **Custom directories**: User-configured paths
3. **Common directories**: `/mapper/`, `/mappers/`, `/xml/`, `/dao/`, `/mybatis/`
4. **Package-based**: Match Java package structure to XML path
5. **Full scan**: All remaining `**/*.xml` files

**File Name Variations** (all supported):
- `UserMapper.xml` (exact match)
- `User.xml` (base name match)
- `UserDao.xml` (DAO pattern)

**Namespace Verification**:
- Always verify `<mapper namespace="...">` matches Java full class name
- Fallback to file name match if namespace missing

### Known Limitations (Current Implementation)
1. **Method Overloading**: Only jumps to first matching method (does not distinguish by parameter types)
2. **Inner Classes**: Not supported for navigation
3. **Kotlin Mappers**: Not supported (Java only)
4. **Annotation-Based Mappers**: Detected but no XML navigation (by design, annotation mappers don't need XML files)
5. **Multiple XML Files**: If multiple XML files have matching namespaces, first found is used
6. **Parameter Validation**: Does not support `parameterMap` references (future enhancement)
7. **CodeLens Performance**: May be slow on very large mapper interfaces (100+ methods)

---

**End of Document**
