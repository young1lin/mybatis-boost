# MyBatis XML SQL Syntax Highlighting

This directory contains the TextMate grammar injection for SQL keyword highlighting in MyBatis XML mapper files.

## Features

- ✅ **SQL Keyword Highlighting** - Highlights SQL keywords (SELECT, FROM, WHERE, JOIN, etc.) inside MyBatis statement tags
- ✅ **Multi-Database Support** - Supports keywords from MySQL, PostgreSQL, Oracle, SQL Server, and more
- ✅ **Dynamic Tag Preservation** - Preserves MyBatis dynamic SQL tags (`<if>`, `<foreach>`, etc.) without interfering with SQL highlighting
- ✅ **Parameter Recognition** - Recognizes MyBatis parameters (`#{param}`, `${param}`)
- ✅ **High Performance** - Native VS Code TextMate grammar, compiled and optimized for large files (1000+ lines)

## How It Works

The grammar injection uses VS Code's TextMate grammar system to inject SQL syntax highlighting into XML files:

1. **Injection Scope**: `text.xml` - applies to all XML files
2. **Detection**: Automatically detects MyBatis statement tags: `<select>`, `<insert>`, `<update>`, `<delete>`
3. **Embedded Language**: Treats content inside these tags as SQL
4. **Smart Parsing**: Skips XML tags and MyBatis dynamic tags to focus on SQL keywords

## Highlighted Elements

### SQL Keywords (by category):

- **Query Keywords**: SELECT, FROM, WHERE, JOIN, UNION, etc.
- **DML Keywords**: INSERT, UPDATE, DELETE, MERGE
- **DDL Keywords**: CREATE, ALTER, DROP, TABLE, INDEX
- **Aggregate Functions**: COUNT, SUM, AVG, MIN, MAX
- **Window Functions**: ROW_NUMBER, RANK, LEAD, LAG, PARTITION, OVER
- **Conditional Logic**: CASE, WHEN, THEN, ELSE, END
- **Data Types**: INT, VARCHAR, DATE, TIMESTAMP, etc.
- **String Functions**: CONCAT, SUBSTRING, TRIM, UPPER, LOWER
- **Date Functions**: NOW, CURRENT_DATE, DATE_FORMAT, TO_CHAR
- **Operators**: =, <>, <=, >=, AND, OR, NOT, LIKE, IN, BETWEEN

### Other Highlighted Elements:

- **SQL Comments**: `-- comment` and `/* block comment */`
- **SQL Strings**: `'single quoted'` and `"double quoted"`
- **Comparison Operators**: `=`, `<>`, `!=`, `<=`, `>=`, `<`, `>`
- **Arithmetic Operators**: `+`, `-`, `*`, `/`, `%`
- **MyBatis Parameters**: `#{param}` and `${param}` (distinct color)

## Testing the Syntax Highlighting

### Method 1: Test in Development Mode

1. **Open the project in VS Code**
   ```bash
   cd /home/user/mybatis-boost
   code .
   ```

2. **Press F5** to launch the Extension Development Host (a new VS Code window)

3. **Open the test fixture file**:
   ```
   src/test/fixtures/sample-mybatis-project/UserMapper-highlight-test.xml
   ```

4. **Verify SQL keywords are highlighted** in different colors from XML tags

### Method 2: Install and Test Locally

1. **Package the extension**:
   ```bash
   pnpm run package
   vsce package
   ```

2. **Install the .vsix file**:
   - In VS Code: Extensions → ... → Install from VSIX
   - Select the generated `mybatis-boost-x.x.x.vsix` file

3. **Open any MyBatis XML mapper file** and verify syntax highlighting

### Method 3: Inspect TextMate Scopes (Advanced)

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: **Developer: Inspect Editor Tokens and Scopes**
3. Click on a SQL keyword in the XML file
4. Verify the token has scope: `keyword.other.sql` or similar

## File Structure

```
syntaxes/
├── README.md                              # This file
└── mybatis-xml-injection.tmLanguage.json  # TextMate grammar injection
```

## Configuration in package.json

```json
{
  "contributes": {
    "grammars": [
      {
        "path": "./syntaxes/mybatis-xml-injection.tmLanguage.json",
        "scopeName": "mybatis.xml.injection.sql",
        "injectTo": ["text.xml"],
        "embeddedLanguages": {
          "meta.embedded.block.sql.mybatis": "sql"
        }
      }
    ]
  }
}
```

## Grammar Structure

The grammar defines patterns for:

1. **Statement Tag Detection** (`<select>`, `<insert>`, `<update>`, `<delete>`)
2. **Dynamic Tag Handling** (`<if>`, `<foreach>`, `<where>`, `<set>`, etc.)
3. **SQL Keyword Classification** (11 categories for precise highlighting)
4. **SQL Comments** (line and block comments)
5. **SQL Strings** (single and double quoted)
6. **SQL Operators** (comparison, arithmetic, logical)
7. **MyBatis Parameters** (`#{...}`, `${...}`)

## Troubleshooting

### Keywords not highlighted?

1. **Check file language mode**: Bottom-right corner should show "XML"
2. **Check namespace**: File must have `<mapper namespace="...">` tag
3. **Reload VS Code**: `Cmd+R` / `Ctrl+R` or restart VS Code
4. **Check theme**: Some color themes may not show distinct keyword colors

### Highlighting looks wrong?

1. **Check TextMate scopes**: Use "Inspect Editor Tokens and Scopes"
2. **Check for regex conflicts**: Verify the grammar regex patterns in the `.tmLanguage.json` file
3. **Check grammar injection**: Use Developer Tools Console to see if grammar is loaded

### Performance issues with large files?

- TextMate grammars are optimized for performance
- Tested with 1000+ line files
- If you experience lag, try disabling other XML-related extensions

## Database-Specific Examples

### MySQL
```xml
<select id="example">
    SELECT * FROM user WHERE id = #{id} LIMIT 10
</select>
```

### PostgreSQL
```xml
<select id="example">
    SELECT * FROM user WHERE created_at::DATE = CURRENT_DATE FETCH FIRST 10 ROWS ONLY
</select>
```

### Oracle
```xml
<select id="example">
    SELECT * FROM user WHERE ROWNUM <= 10 AND email = NVL(#{email}, 'default@example.com')
</select>
```

### SQL Server
```xml
<select id="example">
    SELECT TOP 10 * FROM [user] WHERE email = ISNULL(#{email}, 'default@example.com')
</select>
```

## Future Enhancements

Possible improvements for future versions:

- [ ] Add semantic highlighting for table names and column names
- [ ] Add hover tooltips for SQL keywords
- [ ] Add autocomplete for SQL keywords inside statement tags
- [ ] Add syntax validation for SQL statements
- [ ] Add support for custom SQL dialects
- [ ] Add configurable keyword case (UPPER/lower)

## Contributing

To modify the grammar:

1. Edit `mybatis-xml-injection.tmLanguage.json`
2. Test in Extension Development Host (F5)
3. Run `pnpm run compile` to verify
4. Submit a pull request

## References

- [VS Code Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [TextMate Grammar Documentation](https://macromates.com/manual/en/language_grammars)
- [MyBatis Mapper XML Documentation](https://mybatis.org/mybatis-3/sqlmap-xml.html)
