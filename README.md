# MyBatis Boost

English | [简体中文](README.zh-cn.md)

A one-stop MyBatis plugin that supports Mapper navigation, Mapper generation (with Cursor MCP enabled by default and VSCode Copilot MCP support), SQL interception and logging, SQL formatting, XML Dynamic SQL syntax highlighting, and viewing complete SQL in XML.

Navigation
![demo](images/demo.gif)

Support Cusror IDE MCP, VSCode Copilot! Generate MyBatis content with MCP.
![mcp](images/mcp.gif)

## Features

### 🖥️ SQL Console Interceptor (NEW in v0.3.0)

Automatically intercepts and displays MyBatis SQL logs from your application's debug console with real-time SQL composition and export capabilities.

**How it works:**
- Monitors debug console output for MyBatis log entries
- Parses SQL statements (`Preparing:`) and parameters (`Parameters:`)
- Matches statements with their parameters using thread-based session tracking
- Converts parametrized SQL (`?` placeholders) to executable SQL with actual values
- Displays composed SQL in dedicated "MyBatis SQL Output" channel

**Key Features:**
- ✅ **Real-time SQL logging**: See actual SQL as your application runs
- ✅ **SQL Export**: Copy composed SQL to clipboard or export to file for database execution
- ✅ **Multi-database support**: Auto-detects MySQL, PostgreSQL, Oracle, SQL Server
- ✅ **Database-specific syntax**: Converts SQL to proper dialect (identifiers, pagination, etc.)
- ✅ **Execution metrics**: Shows query execution time and affected rows (INSERT/UPDATE/DELETE)
- ✅ **All statement types**: Supports SELECT, INSERT, UPDATE, DELETE operations
- ✅ **Thread-safe**: Handles concurrent requests in multi-threaded applications
- ✅ **Multiple log formats**: Works with Logback, Log4j, Log4j2, java.util.logging

**Example output:**
```sql
-- Mapper: com.example.mapper.UserMapper.updateById
-- Thread: [http-nio-8080-exec-1]
-- Execution Time: 12ms
-- Rows Affected: 1

UPDATE `user_info`
SET `username` = 'john_doe',
    `email` = 'john@example.com',
    `updated_at` = '2025-11-11 10:30:45'
WHERE `id` = 123;
```

**Configuration** (`mybatis-boost.console.*`):
- `enabled` (default: `true`) - Enable/disable SQL console interceptor
- `autoDetectDatabase` (default: `true`) - Auto-detect database type from SQL syntax
- `defaultDatabase` (default: `mysql`) - Default database when auto-detection fails
- `showExecutionTime` (default: `true`) - Show SQL execution time in output
- `sessionTimeout` (default: `5000`ms) - Timeout for cleaning up incomplete log sessions
- `formatSql` (default: `true`) - Format SQL output for better readability

**Usage:**
1. Enable MyBatis debug logging in your application (e.g., `logging.level.com.example.mapper=DEBUG`)
2. Run your Spring Boot application in VS Code debug mode
3. Execute database operations in your application
4. View intercepted SQL in "MyBatis SQL Output" panel
5. Export SQL: Right-click on output → "Copy" or use export commands

### 🎯 MyBatis Code Generator

Generate complete MyBatis boilerplate code from DDL SQL statements with an interactive WebView panel.

**What it generates:**
- **Entity classes** (POJOs) with configurable Lombok and Swagger annotations
- **Mapper interfaces** with CRUD methods
- **XML mapping files** with complete SQL statements (insert, update, delete, select)
- **Service classes** with common business logic

**Supported databases:**
- MySQL (AUTO_INCREMENT, ENGINE, COMMENT syntax)
- PostgreSQL (SERIAL, BIGSERIAL, COMMENT ON syntax)
- Oracle (VARCHAR2, NUMBER, CLOB, COMMENT ON syntax)

**Configuration options** (`mybatis-boost.generator.*`):
- `basePackage`: Base package for generated code (e.g., `com.example.mybatis`)
- `author`: Author name for code comments (default: `MyBatis Boost`)
- `entitySuffix`: Entity class suffix (default: `PO`)
- `mapperSuffix`: Mapper interface suffix (default: `Mapper`)
- `serviceSuffix`: Service class suffix (default: `Service`)
- `datetime`: DateTime type mapping - `Date` | `LocalDateTime` | `Instant` (default: `Date`)
- `useLombok`: Enable Lombok annotations `@Data`, `@Getter`, `@Setter` (default: `true`)
- `useSwagger`: Enable Swagger 2 annotations `@ApiModel`, `@ApiModelProperty` (default: `false`)
- `useSwaggerV3`: Enable Swagger 3 (OpenAPI) annotations (default: `false`)

**Configuration Scope:**
- Settings can be saved at **Project level** (`.vscode/settings.json`) or **Global level** (user settings)
- Use the **configuration scope selector** in the settings modal to choose where to save
- Project-level settings take priority over global settings
- Each project can have independent configurations to prevent conflicts

**Features:**
- **Preview before export**: Review all generated code in the WebView panel
- **One-click export**: Automatically creates proper directory structure
- **Generation history**: Track all generated code with SQL and file previews
- **Smart type mapping**: Converts SQL types to appropriate Java types (e.g., `BIGINT` → `Long`, `VARCHAR` → `String`)
- **Comment preservation**: Extracts table and column comments from DDL to Javadoc
- **Flexible output**: Choose to generate with or without Lombok/Swagger based on your project needs

**Example usage:**
```sql
CREATE TABLE user_info (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'User ID',
    username VARCHAR(50) NOT NULL COMMENT 'Username',
    email VARCHAR(100) COMMENT 'Email address',
    created_at DATETIME COMMENT 'Creation time'
) ENGINE=InnoDB COMMENT='User information table';
```

This generates:
- `UserInfoPO.java` - Entity class with Lombok `@Data` annotation
- `UserInfoMapper.java` - Mapper interface with CRUD methods
- `UserInfoMapper.xml` - XML with insert/update/delete/select statements
- `UserInfoService.java` - Service class with common operations

**AI Integration (Cursor IDE / VS Code Copilot):**

MyBatis Boost provides **Model Context Protocol (MCP)** support for AI-powered code generation:

- **Automatic IDE detection**: Works seamlessly with VS Code Copilot and Cursor IDE
- **Four MCP tools** available to AI assistants:
  1. `mybatis_parse_sql_and_generate` - Parse DDL and generate code (preview only)
  2. `mybatis_export_generated_files` - Export generated files to filesystem
  3. `mybatis_query_generation_history` - Query past generations
  4. `mybatis_parse_and_export` - Combined parse and export operation
- **Configuration**: Enable/disable with `mybatis-boost.mcp.enable` (default: `true`)
- **Dynamic updates**: Changes take effect immediately without restart

For Cursor IDE users, the extension automatically registers a stdio MCP server for AI tool integration.

### 🚀 10 Types of Go-to-Definition Navigation

**Java ↔ XML:**
- **F12 or Ctrl+Click** on Java **interface name** → XML `<mapper>` tag
- **F12 or Ctrl+Click** on Java **method name** → XML SQL statement
- **F12 or Ctrl+Click** on XML **namespace** attribute → Java interface
- **F12 or Ctrl+Click** on XML **statement ID** (e.g., `id="findById"`) → Java method

**XML SQL Fragment References:**
- **F12 or Ctrl+Click** on `<include refid="xxx">` → `<sql id="xxx">` definition
- **F12 or Ctrl+Click** on `<sql id="xxx">` → Shows all `<include>` references

**Java Class References:**
- **F12 or Ctrl+Click** on Java class names in XML attributes → class definitions
- Supports `resultType`, `parameterType`, `type`, `ofType`, `javaType`

**ResultMap Navigation:**
- **F12 or Ctrl+Click** on `<result property="fieldName">` → Java class field definition
- **F12 or Ctrl+Click** on `resultMap="xxx"` → `<resultMap id="xxx">` definition
- **F12 or Ctrl+Click** on `<resultMap id="xxx">` → Shows all references to this resultMap

**Parameter Navigation:**
- **F12 or Ctrl+Click** on `#{paramName}` or `${paramName}` → Java field or @Param annotation
- Supports navigation to `parameterType` class fields
- Supports navigation to method parameters with `@Param` annotations
- Works with `<select>`, `<insert>`, `<update>`, `<delete>` statements

**Smart Features:**
- **Two navigation modes**: CodeLens (default, non-invasive) or DefinitionProvider (optional, F12)
- Content-based MyBatis mapper detection (via `@Mapper` annotation or MyBatis imports)
- Intelligent XML file matching with 5-tier priority strategy

### 💾 Intelligent Caching
- **LRU cache** with configurable size (default: 5000 entries)
- **Automatic cache invalidation** on file changes
- **Incremental updates** via file system watchers
- **Batch update processing** for optimal performance

### 🎨 Visual Binding Indicators
- **Gutter icons** displayed next to Java methods and XML statements that are bound together
- Quick visual feedback showing which methods have corresponding XML statements
- Automatically updates when files change
- Can be toggled via settings: `mybatis-boost.showBindingIcons`

### ✅ Real-time Parameter Validation
- **Automatic validation** of `#{paramName}` and `${paramName}` references in XML
- **Red underlines** for undefined parameters with helpful error messages
- Validates against:
  - Fields in `parameterType` classes
  - Method parameters with `@Param` annotations
  - Local variables from dynamic SQL tags (`foreach`, `bind`)
  - Handles nested properties (e.g., `#{user.name}` validates base object `user`)
- Works across `<select>`, `<insert>`, `<update>`, `<delete>` statements
- Helps catch typos and missing parameters before runtime

**Example:**
```xml
<update id="updateById" parameterType="com.example.Role">
    UPDATE role
    SET role_name = #{roleName},  <!-- ✅ Valid: Role has this field -->
        invalid = #{wrongField}    <!-- ❌ Error: Role doesn't have this field -->
    WHERE id = #{id}
</update>
```

### 🔍 SQL Composition and Hover Preview
- **Hover on XML statement IDs**: See the complete composed SQL when hovering over statement `id` attributes
- **Hover on Java mapper methods**: See the complete composed SQL when hovering over method names
- **Automatic `<include>` resolution**: Recursively resolves all `<include refid="xxx">` references
- **Nested includes support**: Handles SQL fragments containing other includes
- **Circular reference detection**: Prevents infinite loops with helpful error messages
- **Missing fragment handling**: Shows clear "Fragment not found" messages
- **All statement types**: Works with `<select>`, `<insert>`, `<update>`, `<delete>`
- **Dynamic SQL preserved**: Keeps MyBatis tags (`<if>`, `<where>`, `<trim>`, etc.) for context
- **Non-invasive UI**: Uses hover tooltips, no CodeLens or decorations
- **Real-time composition**: Composes SQL on-demand with no performance impact

**Example:**
```xml
<sql id="Base_Column_List">
    id, account_cfg_id, symbol_cfg_id, profit
</sql>

<sql id="where_condition">
    <trim prefix="WHERE" prefixOverrides="AND | OR">
        <if test="accountCfgId != null">
            AND t.account_cfg_id = #{accountCfgId}
        </if>
    </trim>
</sql>

<select id="selectByCondition" resultMap="BaseResultMap">
    <!-- Hover over "selectByCondition" to see the complete SQL -->
    select
    <include refid="Base_Column_List"/>
    from t_bo_account_symbol_cfg t
    <include refid="where_condition"/>
</select>
```

**In Java mapper:**
```java
// Hover over method name to see the complete composed SQL
List<AccountSymbolCfg> selectByCondition(AccountSymbolCfgQuery query);
```

### 🔄 Flexible Navigation Modes
Choose between two navigation modes based on your workflow:

**CodeLens Mode (Default - Recommended)**
- Non-invasive: Preserves native Java definition behavior
- F12 on Java classes still jumps to class definitions
- Shows clickable "jumpToXml" links above interfaces and methods
- Automatically hides for methods with SQL annotations

**DefinitionProvider Mode (Optional)**
- F12 on Java methods jumps directly to XML statements
- More direct but overwrites native Java navigation
- Enable via `mybatis-boost.useDefinitionProvider: true`
- Changes take effect immediately

## Installation

### Prerequisites

**Package Manager Version Management**

This project uses **Corepack** to pin the pnpm version, ensuring consistent package manager versions across all environments (similar to Python's `uv`).

**First-time setup (one-time only):**
```bash
# Enable Corepack (built into Node.js 16.9+)
corepack enable
```

After enabling Corepack, it will automatically:
- Detect the `packageManager` field in `package.json`
- Download and cache the specified pnpm version (10.19.0)
- Use the correct version transparently for all `pnpm` commands

**Benefits:**
- ✅ Guarantees the same pnpm version for all team members
- ✅ Auto-downloads the correct version in new environments
- ✅ Prevents "works on my machine" issues caused by version mismatches
- ✅ No need to manually install specific pnpm versions

**Compatibility:**
- Node.js 16.9+ (includes Corepack by default)
- Works in CI/CD environments
- Supports pnpm, yarn, and npm version pinning

### Build and Run

1. Clone this repository
2. Enable Corepack (first-time only):
   ```bash
   corepack enable
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build the extension:
   ```bash
   pnpm run compile
   ```
5. Press F5 to launch Extension Development Host

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
  <!--      ^^^^^^^^ Ctrl+Click on the id value to jump to Java method -->
  SELECT * FROM users WHERE id = #{id}
  <!--    ⚠️ Note: Navigation only works when cursor is on "findById", not on the SQL content -->
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

### Navigation Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mybatis-boost.cacheSize` | number | 5000 | Maximum number of mapper pairs to cache |
| `mybatis-boost.customXmlDirectories` | array | [] | Custom directories to search for XML files (Priority 1 in matching strategy) |
| `mybatis-boost.javaParseLines` | number | 100 | Number of lines to read for namespace extraction |
| `mybatis-boost.showBindingIcons` | boolean | true | Show gutter icons for MyBatis bindings between Java methods and XML statements |
| `mybatis-boost.useDefinitionProvider` | boolean | false | Enable DefinitionProvider mode for Java-to-XML navigation (when false, uses CodeLens mode) |

### SQL Console Interceptor Settings (NEW in v0.3.0)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mybatis-boost.console.enabled` | boolean | true | Enable/disable SQL console interceptor |
| `mybatis-boost.console.autoDetectDatabase` | boolean | true | Automatically detect database type from SQL syntax |
| `mybatis-boost.console.defaultDatabase` | string | mysql | Default database type when auto-detection fails (mysql, postgresql, oracle, sqlserver) |
| `mybatis-boost.console.showExecutionTime` | boolean | true | Show SQL execution time in output |
| `mybatis-boost.console.sessionTimeout` | number | 5000 | Session timeout in milliseconds for cleaning up incomplete logs |
| `mybatis-boost.console.formatSql` | boolean | true | Format SQL output for better readability |

### Generator Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mybatis-boost.generator.basePackage` | string | com.example.mybatis | Base package for generated code |
| `mybatis-boost.generator.author` | string | MyBatis Boost | Author name for code comments |
| `mybatis-boost.generator.entitySuffix` | string | PO | Entity class suffix |
| `mybatis-boost.generator.mapperSuffix` | string | Mapper | Mapper interface suffix |
| `mybatis-boost.generator.serviceSuffix` | string | Service | Service class suffix |
| `mybatis-boost.generator.datetime` | string | LocalDateTime | DateTime type mapping (Date, LocalDateTime, Instant) |
| `mybatis-boost.generator.useLombok` | boolean | true | Enable Lombok annotations |
| `mybatis-boost.generator.useSwagger` | boolean | false | Enable Swagger 2 annotations |
| `mybatis-boost.generator.useSwaggerV3` | boolean | false | Enable Swagger 3 (OpenAPI) annotations |
| `mybatis-boost.generator.useMyBatisPlus` | boolean | false | Enable MyBatis Plus annotations |

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

### CodeLens Not Showing

1. Ensure `mybatis-boost.useDefinitionProvider` is set to `false` (default)
2. Check that the Java file has a corresponding XML mapper
3. Verify that the Java interface has `@Mapper` annotation or MyBatis imports
4. CodeLens automatically hides for methods with SQL annotations (`@Select`, etc.)

### Parameter Validation Not Working

1. Ensure the XML file has a valid `namespace` attribute
2. Check that the statement has a matching Java method
3. Verify `parameterType` attribute is a valid fully-qualified class name
4. For nested properties, ensure the base object exists (e.g., for `#{user.name}`, validate `user` exists)

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

## Internationalization

The extension supports multiple languages:

- **English** (default)
- **简体中文** (Simplified Chinese)

The extension automatically uses your VS Code display language. To change the language:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Configure Display Language"
3. Select your preferred language
4. Restart VS Code

For more details, see [docs/i18n.md](docs/i18n.md).

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `pnpm test`
2. Code is linted: `pnpm run lint`
3. Performance targets are met (< 100ms P50, < 200ms P95)
4. Changes are documented in CLAUDE.md

## License

MIT

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
