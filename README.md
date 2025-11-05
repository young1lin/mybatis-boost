# MyBatis Boost

High-performance bidirectional navigation between MyBatis mapper interfaces (Java) and their corresponding XML mapping files. Achieve sub-100ms navigation latency through LRU caching, file watchers, and optimized parsing.

## Features

### 🚀 9 Types of Go-to-Definition Navigation

**Java ↔ XML:**
- **F12 or Ctrl+Click** on Java **interface name** → XML `<mapper>` tag
- **F12 or Ctrl+Click** on Java **method name** → XML SQL statement
- **F12 or Ctrl+Click** on XML **namespace** attribute → Java interface
- **F12 or Ctrl+Click** on XML **statement ID** → Java method

**XML SQL Fragment References:**
- **F12 or Ctrl+Click** on `<include refid="xxx">` → `<sql id="xxx">` definition
- **F12 or Ctrl+Click** on `<sql id="xxx">` → Shows all `<include>` references

**Java Class References:**
- **F12 or Ctrl+Click** on Java class names in XML attributes → class definitions
- Supports `resultType`, `parameterType`, `type`, `ofType`, `javaType`

**ResultMap Navigation (NEW):**
- **F12 or Ctrl+Click** on `<result property="fieldName">` → Java class field definition
- **F12 or Ctrl+Click** on `resultMap="xxx"` → `<resultMap id="xxx">` definition
- **F12 or Ctrl+Click** on `<resultMap id="xxx">` → Shows all references to this resultMap

**Smart Features:**
- Content-based MyBatis mapper detection (via `@Mapper` annotation or MyBatis imports)
- Intelligent XML file matching with 5-tier priority strategy

### 💾 Intelligent Caching
- **LRU cache** with configurable size (default: 5000 entries)
- **Automatic cache invalidation** on file changes
- **Incremental updates** via file system watchers
- **Batch update processing** for optimal performance

### 🎨 Visual Binding Indicators (NEW)
- **Gutter icons** displayed next to Java methods and XML statements that are bound together
- Quick visual feedback showing which methods have corresponding XML statements
- Automatically updates when files change
- Can be toggled via settings: `mybatis-boost.showBindingIcons`

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   pnpm run compile
   ```
4. Press F5 to launch Extension Development Host

## Usage

### Go-to-Definition Navigation

**1. Java Interface → XML Mapper:**
```java
public interface UserMapper {  // ← Ctrl+Click on "UserMapper" to jump to XML <mapper> tag
    User findById(Long id);
}
```

**2. Java Method → XML Statement:**
```java
public interface UserMapper {
    User findById(Long id);  // ← Ctrl+Click on "findById" to jump to XML <select id="findById">
}
```

**3. XML Namespace → Java Interface:**
```xml
<mapper namespace="com.example.mapper.UserMapper">
  <!--              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Ctrl+Click to jump to Java interface -->
</mapper>
```

**4. XML Statement ID → Java Method:**
```xml
<select id="findById" resultType="com.example.User">
  <!--      ^^^^^^^^ Ctrl+Click to jump to Java method -->
  SELECT * FROM users WHERE id = #{id}
</select>
```

**5. Java Class References:**
```xml
<select id="findUser" resultType="com.example.User">
  <!--                            ^^^^^^^^^^^^^^^^ Ctrl+Click to jump to User class definition -->
  SELECT * FROM users WHERE id = #{id}
</select>
```

**6. SQL Fragment References (within same XML):**
```xml
<!-- Define reusable SQL fragment -->
<sql id="Base_Column_List">
  <!--  ^^^^^^^^^^^^^^^^^ Ctrl+Click shows all references to this fragment -->
  id, name, email, created_at, updated_at
</sql>

<!-- Use SQL fragment -->
<select id="findById" resultType="com.example.User">
  SELECT <include refid="Base_Column_List" /> FROM users WHERE id = #{id}
    <!--             ^^^^^^^^^^^^^^^^^ Ctrl+Click jumps to sql fragment definition -->
</select>
```

**7. ResultMap Property Navigation (NEW):**
```xml
<resultMap id="UserResultMap" type="com.example.User">
  <result property="userId" column="user_id"/>
    <!--            ^^^^^^ Ctrl+Click jumps to userId field in User class -->
  <result property="userName" column="user_name"/>
</resultMap>
```

**8. ResultMap Reference Navigation (NEW):**
```xml
<!-- Define resultMap -->
<resultMap id="UserResultMap" type="com.example.User">
  <!--         ^^^^^^^^^^^^^ Ctrl+Click shows all references to this resultMap -->
  <id property="id" column="id"/>
  <result property="userName" column="user_name"/>
</resultMap>

<!-- Use resultMap -->
<select id="findAll" resultMap="UserResultMap">
  <!--                          ^^^^^^^^^^^^^ Ctrl+Click jumps to resultMap definition -->
  SELECT * FROM users
</select>
```

### Commands

| Command | Description |
|---------|-------------|
| MyBatis Boost: Clear Cache and Rebuild | Clear all cached mappings and rebuild |
| MyBatis Boost: Refresh Mappings | Refresh mappings with progress indicator |

## Configuration

Open VS Code settings and search for "MyBatis Boost":

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mybatis-boost.cacheSize` | number | 5000 | Maximum number of mapper pairs to cache |
| `mybatis-boost.customXmlDirectories` | array | [] | Custom directories to search for XML files (Priority 1 in matching strategy) |
| `mybatis-boost.javaParseLines` | number | 100 | Number of lines to read for namespace extraction |
| `mybatis-boost.showBindingIcons` | boolean | true | Show gutter icons for MyBatis bindings between Java methods and XML statements |

## Architecture

### Caching System

- **LRU Memory Cache**: Recently used mappings kept in memory (default: 5000 entries)
- **Automatic cache invalidation** on file changes via file system watchers
- **Modification timestamp tracking** for cache validation

### File Mapping Strategy (5-Tier Priority)

The extension uses an intelligent 5-tier strategy to find XML files for Java mappers:

1. **Priority 0 - Quick Paths**: Common structures (same dir, `mapper/` subdir, mirrored `resources/` path)
2. **Priority 1 - Custom Directories**: User-configured via `mybatis-boost.customXmlDirectories`
3. **Priority 2 - Common Patterns**: `/mapper/`, `/mappers/`, `/xml/`, `/dao/`, `/mybatis/`
4. **Priority 3 - Package-Based**: Convert Java package to path (e.g., `com.example.UserMapper` → `**/com/example/UserMapper.xml`)
5. **Priority 4 - Full Scan**: All remaining XML files with namespace verification

### MyBatis Mapper Detection

Content-based detection (not just filename patterns):
- Must be Java `interface`
- Must contain MyBatis annotations (`@Mapper`, `@Select`, `@Insert`, `@Update`, `@Delete`)
- OR contain MyBatis imports (`org.apache.ibatis.*`, `org.mybatis.*`)

## Development

### Building

```bash
# Development build
pnpm run compile

# Watch mode
pnpm run watch

# Production build
pnpm run package
```

### Testing

```bash
# Run all tests
pnpm test

# Watch tests
pnpm run watch-tests

# Type checking
pnpm run check-types

# Linting
pnpm run lint
```

## Troubleshooting

### Navigation Not Working

1. Ensure the Java file has MyBatis annotations (`@Mapper`) or imports (`org.apache.ibatis.*`)
2. Check that the XML file has a matching `namespace` attribute
3. Try clearing cache: "MyBatis Boost: Clear Cache and Rebuild"

### Custom XML Directories Not Working

1. Ensure paths are relative to workspace root
2. Check that XML files have correct `namespace` attributes
3. Example configuration:
   ```json
   {
     "mybatis-boost.customXmlDirectories": [
       "src/main/resources/mybatis/mappers",
       "config/xml"
     ]
   }
   ```

### Mappings Not Updating

1. File watchers may be disabled in large workspaces
2. Manually refresh: "MyBatis Boost: Refresh Mappings"
3. Check VS Code file watcher limit: `files.watcherExclude`

### Binding Icons Not Showing

1. Ensure `mybatis-boost.showBindingIcons` is set to `true`
2. Check that Java method names match XML statement IDs exactly
3. Try reopening the file or refreshing mappings

### Extension Not Activating

1. Ensure workspace contains a Java project:
   - `pom.xml` (Maven)
   - `build.gradle` or `build.gradle.kts` (Gradle)
   - `src/main/java/` directory
2. Check VS Code Output panel for errors
3. Restart VS Code

## Requirements

- VS Code 1.99.3 or higher
- Java project with MyBatis mappers
- Node.js 22.x or higher (for development)

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `pnpm test`
2. Code is linted: `pnpm run lint`
3. Performance targets are met (< 100ms P50, < 200ms P95)
4. Changes are documented in CLAUDE.md

## License

MIT

## Changelog

### 0.0.1 (Current)
- ✨ **9 types of Go-to-Definition navigation** (F12/Ctrl+Click):
  1. Java interface name → XML `<mapper>` tag
  2. Java method name → XML SQL statement
  3. XML namespace attribute → Java interface
  4. XML statement ID → Java method
  5. Java class references in XML → Java class definition
  6. `<include refid>` → `<sql id>` fragment definition
  7. `<sql id>` → All `<include>` references (shows all usages)
  8. **NEW**: `<result property>` → Java class field definition
  9. **NEW**: `resultMap` reference ↔ `<resultMap>` definition (bidirectional)
- ✨ **NEW**: Visual binding indicators - gutter icons show Java methods ↔ XML statement bindings
- ✨ LRU cache with configurable size (default: 5000 entries)
- ✨ Automatic cache invalidation on file changes
- ✨ File system watchers for incremental updates
- ✨ Smart MyBatis mapper detection (content-based, not just filename)
- ✨ 5-tier intelligent XML file matching strategy
- ✨ Custom XML directories support (Priority 1 in matching)
- ✨ Multi-line tag parsing support
- ✨ Configurable settings
