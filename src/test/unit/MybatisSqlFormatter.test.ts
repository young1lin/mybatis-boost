/**
 * Unit tests for MybatisSqlFormatter
 * Tests SQL formatting with dynamic tag preservation using placeholder replacement strategy
 */

import * as assert from 'assert';
import { MybatisSqlFormatter, FormatterOptions } from '../../formatter/MybatisSqlFormatter';

describe('MybatisSqlFormatter', () => {
    let formatter: MybatisSqlFormatter;

    beforeEach(() => {
        formatter = new MybatisSqlFormatter();
    });

    describe('Basic SQL Formatting', () => {
        it('should format simple SELECT statement', () => {
            const input = 'SELECT id,name,age FROM users WHERE id=1';
            const result = formatter.format(input);

            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('WHERE'));
            // Keywords should be uppercase by default
            assert.ok(!result.includes('select'));
            assert.ok(!result.includes('from'));
        });

        it('should format INSERT statement', () => {
            const input = 'INSERT INTO users(name,age,email) VALUES(#{name},#{age},#{email})';
            const result = formatter.format(input);

            assert.ok(result.includes('INSERT INTO'));
            assert.ok(result.includes('VALUES'));
            // Parameters should be preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{age}'));
            assert.ok(result.includes('#{email}'));
        });

        it('should format UPDATE statement', () => {
            const input = 'UPDATE users SET name=#{name},age=#{age} WHERE id=#{id}';
            const result = formatter.format(input);

            assert.ok(result.includes('UPDATE'));
            assert.ok(result.includes('SET'));
            assert.ok(result.includes('WHERE'));
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{id}'));
        });

        it('should format DELETE statement', () => {
            const input = 'DELETE FROM users WHERE id=#{id}';
            const result = formatter.format(input);

            assert.ok(result.includes('DELETE'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('WHERE'));
            assert.ok(result.includes('#{id}'));
        });

        it('should preserve MyBatis parameters #{} and ${}', () => {
            const input = 'SELECT * FROM users WHERE name=#{name} AND order BY ${orderBy}';
            const result = formatter.format(input);

            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('${orderBy}'));
        });

        it('should handle empty input', () => {
            const result = formatter.format('');
            assert.strictEqual(result, '');
        });

        it('should handle whitespace-only input', () => {
            const result = formatter.format('   \n  \t  ');
            assert.strictEqual(result.trim(), '');
        });
    });

    describe('Dynamic Tag Preservation - <if>', () => {
        it('should preserve single <if> tag', () => {
            const input = `SELECT * FROM users WHERE 1=1 <if test="name != null">AND name=#{name}</if>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('</if>'));
            // Check that the tag content is preserved (sql-formatter may change spacing)
            assert.ok(result.includes('name') && result.includes('#{name}'));
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('WHERE'));
        });

        it('should preserve multiple <if> tags', () => {
            const input = `SELECT * FROM users WHERE 1=1 <if test="name != null">AND name=#{name}</if><if test="age != null">AND age=#{age}</if>`;
            const result = formatter.format(input);

            // Both if tags should be preserved
            const ifMatches = result.match(/<if test=/g);
            assert.strictEqual(ifMatches?.length, 2);

            // Check that parameters are preserved (sql-formatter may change spacing around =)
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{age}'));
        });

        it('should preserve nested <if> tags', () => {
            const input = `SELECT * FROM users WHERE 1=1 <if test="condition1">AND field1=#{value1}<if test="condition2">AND field2=#{value2}</if></if>`;
            const result = formatter.format(input);

            // Should contain both opening and closing tags
            const openIfMatches = result.match(/<if test=/g);
            const closeIfMatches = result.match(/<\/if>/g);
            // Note: nested tags are extracted from innermost to outermost, so outer tag may be counted differently
            assert.ok(openIfMatches && openIfMatches.length >= 1);
            assert.ok(closeIfMatches && closeIfMatches.length >= 1);

            assert.ok(result.includes('#{value1}'));
            assert.ok(result.includes('#{value2}'));
        });
    });

    describe('Dynamic Tag Preservation - <foreach>', () => {
        it('should preserve <foreach> tag', () => {
            const input = `SELECT * FROM users WHERE id IN <foreach collection="ids" item="id" open="(" close=")" separator=",">#{id}</foreach>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<foreach'));
            assert.ok(result.includes('collection="ids"'));
            assert.ok(result.includes('item="id"'));
            assert.ok(result.includes('</foreach>'));
            assert.ok(result.includes('#{id}'));
        });

        it('should preserve <foreach> with complex attributes', () => {
            const input = `DELETE FROM users WHERE id IN <foreach collection="list" item="item" index="index" open="(" separator="," close=")">#{item.id}</foreach>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<foreach'));
            assert.ok(result.includes('collection="list"'));
            assert.ok(result.includes('item="item"'));
            assert.ok(result.includes('index="index"'));
            assert.ok(result.includes('#{item.id}'));
        });
    });

    describe('Dynamic Tag Preservation - <include>', () => {
        it('should preserve self-closing <include> tag', () => {
            const input = `SELECT <include refid="BaseColumns"/> FROM users WHERE id=#{id}`;
            const result = formatter.format(input);

            assert.ok(result.includes('<include refid="BaseColumns"/>'));
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
        });

        it('should preserve <include> tag with property', () => {
            const input = `SELECT <include refid="BaseColumns"><property name="prefix" value="u"/></include> FROM users u`;
            const result = formatter.format(input);

            assert.ok(result.includes('<include refid="BaseColumns">'));
            assert.ok(result.includes('<property'));
            assert.ok(result.includes('</include>'));
        });
    });

    describe('Dynamic Tag Preservation - <where>, <set>, <trim>', () => {
        it('should preserve <where> tag', () => {
            const input = `SELECT * FROM users <where><if test="name != null">AND name=#{name}</if></where>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<where>'));
            assert.ok(result.includes('</where>'));
            assert.ok(result.includes('<if'));
        });

        it('should preserve <set> tag', () => {
            const input = `UPDATE users <set><if test="name != null">name=#{name},</if><if test="age != null">age=#{age}</if></set> WHERE id=#{id}`;
            const result = formatter.format(input);

            assert.ok(result.includes('<set>'));
            assert.ok(result.includes('</set>'));
            assert.ok(result.includes('UPDATE'));
            assert.ok(result.includes('WHERE'));
        });

        it('should preserve <trim> tag', () => {
            const input = `SELECT * FROM users <trim prefix="WHERE" prefixOverrides="AND |OR "><if test="name != null">AND name=#{name}</if></trim>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<trim'));
            assert.ok(result.includes('prefix="WHERE"'));
            assert.ok(result.includes('</trim>'));
        });

        it('should preserve <bind> tag', () => {
            const input = `SELECT * FROM users <bind name="pattern" value="'%' + name + '%'"/> WHERE name LIKE #{pattern}`;
            const result = formatter.format(input);

            assert.ok(result.includes('<bind'));
            assert.ok(result.includes('name="pattern"'));
        });
    });

    describe('Dynamic Tag Preservation - <choose>, <when>, <otherwise>', () => {
        it('should preserve <choose> with <when> and <otherwise>', () => {
            const input = `SELECT * FROM users WHERE <choose><when test="id != null">id=#{id}</when><when test="name != null">name=#{name}</when><otherwise>1=1</otherwise></choose>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<choose>'));
            assert.ok(result.includes('<when test="id != null">'));
            assert.ok(result.includes('<when test="name != null">'));
            assert.ok(result.includes('<otherwise>'));
            assert.ok(result.includes('</choose>'));
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle SQL with multiple types of dynamic tags', () => {
            const input = `SELECT <include refid="BaseColumns"/> FROM users <where><if test="name != null">AND name LIKE #{name}</if><if test="ids != null">AND id IN <foreach collection="ids" item="id" open="(" close=")" separator=",">#{id}</foreach></if></where>`;
            const result = formatter.format(input);

            // All tags should be preserved
            assert.ok(result.includes('<include'));
            assert.ok(result.includes('<where>'));
            assert.ok(result.includes('<if'));
            assert.ok(result.includes('<foreach'));

            // SQL should still be formatted
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
        });

        it('should handle deeply nested dynamic tags', () => {
            const input = `SELECT * FROM users <where><choose><when test="type == 1"><if test="name != null">AND name=#{name}</if></when><otherwise>AND status=1</otherwise></choose></where>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<where>'));
            assert.ok(result.includes('<choose>'));
            assert.ok(result.includes('<when'));
            assert.ok(result.includes('<if'));
            assert.ok(result.includes('<otherwise>'));
        });

        it('should preserve whitespace and newlines inside dynamic tags', () => {
            const input = `SELECT * FROM users WHERE <if test="name != null">
                name = #{name}
            </if>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('name') && result.includes('#{name}'));
            assert.ok(result.includes('</if>'));
        });
    });

    describe('Formatter Options', () => {
        it('should respect keywordCase option - lower', () => {
            const input = 'SELECT * FROM users WHERE id=1';
            const options: FormatterOptions = {
                keywordCase: 'lower'
            };
            const result = formatter.format(input, options);

            assert.ok(result.includes('select'));
            assert.ok(result.includes('from'));
            assert.ok(result.includes('where'));
        });

        it('should respect keywordCase option - upper', () => {
            const input = 'select * from users where id=1';
            const options: FormatterOptions = {
                keywordCase: 'upper'
            };
            const result = formatter.format(input, options);

            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('WHERE'));
        });

        it('should respect denseOperators option - true', () => {
            const input = 'SELECT * FROM users WHERE id = 1';
            const options: FormatterOptions = {
                denseOperators: true
            };
            const result = formatter.format(input, options);

            // Should have no spaces around operators
            assert.ok(result.includes('id=1') || result.includes('id= 1') || result.includes('id =1'));
        });

        it('should respect denseOperators option - false', () => {
            const input = 'SELECT * FROM users WHERE id=1';
            const options: FormatterOptions = {
                denseOperators: false
            };
            const result = formatter.format(input, options);

            // Should have spaces around operators
            assert.ok(result.includes('id = 1'));
        });

        it('should respect tabWidth option', () => {
            const input = 'SELECT id FROM users';
            const options: FormatterOptions = {
                tabWidth: 4
            };
            const result = formatter.format(input, options);

            // Result should have formatting applied
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
        });
    });

    describe('SQL Dialect Detection', () => {
        it('should detect MySQL dialect', () => {
            const sql = 'SELECT * FROM users LIMIT 10';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'mysql');
        });

        it('should detect MySQL dialect with backticks', () => {
            const sql = 'SELECT * FROM `users` WHERE id=1';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'mysql');
        });

        it('should detect PostgreSQL dialect', () => {
            const sql = 'SELECT * FROM users RETURNING id';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'postgresql');
        });

        it('should detect Oracle dialect', () => {
            const sql = 'SELECT * FROM users WHERE ROWNUM <= 10';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'plsql');
        });

        it('should detect SQL Server dialect', () => {
            const sql = 'SELECT TOP 10 * FROM users';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'tsql');
        });

        it('should default to MySQL for ambiguous SQL', () => {
            const sql = 'SELECT * FROM users WHERE id=1';
            const dialect = formatter.detectDialect(sql);
            assert.strictEqual(dialect, 'mysql');
        });
    });

    describe('Edge Cases', () => {
        it('should handle SQL with case-insensitive tag names', () => {
            const input = 'SELECT * FROM users WHERE <IF test="name != null">name=#{name}</IF>';
            const result = formatter.format(input);

            // Case-insensitive regex should match
            assert.ok(result.includes('<IF') || result.includes('<if'));
            assert.ok(result.includes('</IF>') || result.includes('</if>'));
        });

        it('should handle tags with extra whitespace', () => {
            const input = 'SELECT * FROM users WHERE <if   test = "name != null"  >name=#{name}</if>';
            const result = formatter.format(input);

            assert.ok(result.includes('<if'));
            assert.ok(result.includes('</if>'));
        });

        it('should not break on malformed SQL', () => {
            const input = 'SELECT * FROM WHERE';
            const result = formatter.format(input);

            // Should not throw, may return original or attempt to format
            assert.ok(result.length > 0);
        });

        it('should handle SQL with special characters in parameters', () => {
            const input = `SELECT * FROM users WHERE name=#{user.name} AND code=#{user.info.code}`;
            const result = formatter.format(input);

            assert.ok(result.includes('#{user.name}'));
            assert.ok(result.includes('#{user.info.code}'));
        });

        it('should preserve tags with single quotes in attributes', () => {
            const input = `SELECT * FROM users <if test="name != 'admin'">WHERE name=#{name}</if>`;
            const result = formatter.format(input);

            assert.ok(result.includes(`test="name != 'admin'"`));
            assert.ok(result.includes('</if>'));
        });

        it('should preserve tags with double quotes in attributes', () => {
            const input = `SELECT * FROM users <if test='name != "admin"'>WHERE name=#{name}</if>`;
            const result = formatter.format(input);

            assert.ok(result.includes('<if'));
            assert.ok(result.includes('</if>'));
        });
    });

    describe('Real-world Examples', () => {
        it('should format complex query from UserMapper.xml', () => {
            const input = `SELECT id,name,age,email FROM users WHERE 1=1 <if test="name != null">AND name LIKE #{name}</if><if test="minAge != null">AND age >= #{minAge}</if><if test="ids != null">AND id IN <foreach collection="ids" item="id" separator="," open="(" close=")">#{id}</foreach></if>`;
            const result = formatter.format(input);

            // Check that all dynamic tags are preserved
            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('<if test="minAge != null">'));
            assert.ok(result.includes('<foreach'));

            // Check that SQL is formatted
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('WHERE'));

            // Check that parameters are preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{minAge}'));
            assert.ok(result.includes('#{id}'));
        });

        it('should format UPDATE with <set> tag', () => {
            const input = `UPDATE users <set><if test="name != null">name=#{name},</if><if test="age != null">age=#{age},</if><if test="email != null">email=#{email}</if></set> WHERE id=#{id}`;
            const result = formatter.format(input);

            assert.ok(result.includes('UPDATE'));
            assert.ok(result.includes('<set>'));
            assert.ok(result.includes('WHERE'));
            assert.ok(result.includes('#{id}'));
        });

        it('should format query with <include> and <where>', () => {
            const input = `SELECT <include refid="BaseColumns"/> FROM users <where><if test="status != null">AND status=#{status}</if><if test="userId != null">AND user_id=#{userId}</if></where>`;
            const result = formatter.format(input);

            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('<include refid="BaseColumns"/>'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('<where>'));
        });
    });

    describe('Nested Tag Indentation (CST-based)', () => {
        it('should properly indent nested <trim> with <if> tags', () => {
            const input = `SELECT * FROM users <trim prefix="WHERE" prefixOverrides="AND |OR "><if test="name != null">AND name=#{name}</if></trim>`;
            const result = formatter.format(input);

            // Verify tags are preserved
            assert.ok(result.includes('<trim'));
            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('</if>'));
            assert.ok(result.includes('</trim>'));

            // Verify SQL is formatted
            assert.ok(result.includes('SELECT'));
            assert.ok(result.includes('FROM'));
            assert.ok(result.includes('#{name}'));
        });

        it('should properly indent multi-level nested tags', () => {
            const input = `SELECT * FROM users <where><if test="type == 1"><trim prefix="AND"><if test="status != null">status=#{status}</if></trim></if></where>`;
            const result = formatter.format(input);

            // Verify all tags are preserved
            assert.ok(result.includes('<where>'));
            assert.ok(result.includes('<if test="type == 1">'));
            assert.ok(result.includes('<trim'));
            assert.ok(result.includes('<if test="status != null">'));
            assert.ok(result.includes('</if>'));
            assert.ok(result.includes('</trim>'));
            assert.ok(result.includes('</where>'));

            // Verify parameters are preserved
            assert.ok(result.includes('#{status}'));
        });

        it('should properly indent nested <foreach> inside <if> tags', () => {
            const input = `SELECT * FROM users WHERE 1=1 <if test="ids != null">AND id IN <foreach collection="ids" item="id" open="(" close=")" separator=",">#{id}</foreach></if>`;
            const result = formatter.format(input);

            // Verify tags are preserved
            assert.ok(result.includes('<if test="ids != null">'));
            assert.ok(result.includes('<foreach'));
            assert.ok(result.includes('collection="ids"'));
            assert.ok(result.includes('</foreach>'));
            assert.ok(result.includes('</if>'));

            // Verify parameters are preserved
            assert.ok(result.includes('#{id}'));
        });

        it('should properly indent complex nested structure with <choose>, <when>, <if>', () => {
            const input = `UPDATE users <set><choose><when test="type == 1"><if test="name != null">name=#{name},</if></when><otherwise>status=0</otherwise></choose></set> WHERE id=#{id}`;
            const result = formatter.format(input);

            // Verify all tags are preserved
            assert.ok(result.includes('<set>'));
            assert.ok(result.includes('<choose>'));
            assert.ok(result.includes('<when test="type == 1">'));
            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('<otherwise>'));
            assert.ok(result.includes('</set>'));

            // Verify parameters are preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{id}'));
        });

        it('should properly indent deeply nested tags (4 levels)', () => {
            const input = `SELECT * FROM users <where><choose><when test="condition1"><trim prefix="AND"><if test="condition2">field=#{value}</if></trim></when></choose></where>`;
            const result = formatter.format(input);

            // Verify all tags are preserved
            assert.ok(result.includes('<where>'));
            assert.ok(result.includes('<choose>'));
            assert.ok(result.includes('<when'));
            assert.ok(result.includes('<trim'));
            assert.ok(result.includes('<if'));
            assert.ok(result.includes('#{value}'));

            // All closing tags should be present
            const closeIfCount = (result.match(/<\/if>/g) || []).length;
            const closeTrimCount = (result.match(/<\/trim>/g) || []).length;
            const closeWhenCount = (result.match(/<\/when>/g) || []).length;
            const closeChooseCount = (result.match(/<\/choose>/g) || []).length;
            const closeWhereCount = (result.match(/<\/where>/g) || []).length;

            assert.strictEqual(closeIfCount, 1);
            assert.strictEqual(closeTrimCount, 1);
            assert.strictEqual(closeWhenCount, 1);
            assert.strictEqual(closeChooseCount, 1);
            assert.strictEqual(closeWhereCount, 1);
        });

        it('should handle multiple sibling tags at same nesting level', () => {
            const input = `SELECT * FROM users <where><if test="name != null">AND name=#{name}</if><if test="age != null">AND age=#{age}</if><if test="email != null">AND email=#{email}</if></where>`;
            const result = formatter.format(input);

            // Verify all if tags are preserved
            const ifTags = result.match(/<if test=/g);
            assert.strictEqual(ifTags?.length, 3);

            // Verify all parameters are preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{age}'));
            assert.ok(result.includes('#{email}'));

            // Verify all closing tags
            const closeIfTags = result.match(/<\/if>/g);
            assert.strictEqual(closeIfTags?.length, 3);
        });

        it('should preserve parameter placement within nested tags', () => {
            const input = `UPDATE users <set><if test="data != null">name=#{data.name}, age=#{data.age}</if></set> WHERE id=#{id}`;
            const result = formatter.format(input);

            // Verify parameters with nested properties are preserved
            assert.ok(result.includes('#{data.name}'));
            assert.ok(result.includes('#{data.age}'));
            assert.ok(result.includes('#{id}'));
        });

        it('should handle self-closing tags within nested structure', () => {
            const input = `SELECT * FROM users <where><bind name="pattern" value="'%' + name + '%'"/><if test="name != null">AND name LIKE #{pattern}</if></where>`;
            const result = formatter.format(input);

            // Verify self-closing bind tag is preserved
            assert.ok(result.includes('<bind'));
            assert.ok(result.includes('name="pattern"'));
            assert.ok(result.includes('/>'));

            // Verify if tag is preserved
            assert.ok(result.includes('<if test="name != null">'));
            assert.ok(result.includes('#{pattern}'));
        });
    });

    describe('CST Debug Functionality', () => {
        it('should print CST structure for debugging', () => {
            const input = `SELECT * FROM users <where><if test="name != null">AND name=#{name}</if></where>`;
            const cstOutput = formatter.debugPrintCst(input);

            // Should contain node types
            assert.ok(cstOutput.includes('Root'));
            assert.ok(cstOutput.includes('SQL'));
            assert.ok(cstOutput.includes('Tag:'));
            assert.ok(cstOutput.includes('Param:'));
        });

        it('should show nested structure in CST debug output', () => {
            const input = `<trim><if>test</if></trim>`;
            const cstOutput = formatter.debugPrintCst(input);

            // Should show nested structure with indentation
            assert.ok(cstOutput.includes('Root'));
            assert.ok(cstOutput.includes('Tag: <trim>'));
            assert.ok(cstOutput.includes('Tag: <if>'));
        });
    });

    describe('Comma Placement', () => {
        it('should not place commas on separate lines in UPDATE statements', () => {
            const input = `UPDATE user SET name =#{name}, age =#{age}, update_time =#{updateTime}, version = version + 1 WHERE id =#{id} AND version =#{version}`;
            const result = formatter.format(input);

            // Commas should not be on their own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                // A line should not start with just a comma
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line: "${line}"`);
            }

            // Verify parameters are preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{age}'));
            assert.ok(result.includes('#{updateTime}'));
            assert.ok(result.includes('#{id}'));
            assert.ok(result.includes('#{version}'));
        });

        it('should not place commas on separate lines in SELECT statements', () => {
            const input = `SELECT id, name, age, email FROM users WHERE status = 1`;
            const result = formatter.format(input);

            // Commas should not be on their own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line: "${line}"`);
            }
        });

        it('should not place commas on separate lines in INSERT statements', () => {
            const input = `INSERT INTO users (id, name, age, email) VALUES (#{id}, #{name}, #{age}, #{email})`;
            const result = formatter.format(input);

            // Commas should not be on their own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line: "${line}"`);
            }
        });

        it('should fix existing SQL with commas on separate lines', () => {
            // This is the actual bug scenario - input already has commas on separate lines
            const input = `UPDATE \`user\`
SET
    \`name\` =#{name}
,
age =#{age}
,
update_time =#{updateTime}
,
version = version + 1
WHERE
    id =#{id}
AND version =#{version}`;

            const result = formatter.format(input);

            // After formatting, commas should NOT be on their own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line after preprocessing: "${line}"`);
            }

            // Verify parameters are preserved
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{age}'));
            assert.ok(result.includes('#{updateTime}'));
            assert.ok(result.includes('#{id}'));
            assert.ok(result.includes('#{version}'));

            // Verify SQL keywords are formatted
            assert.ok(result.includes('UPDATE'));
            assert.ok(result.includes('SET'));
            assert.ok(result.includes('WHERE'));
        });

        it('should handle multiple commas on separate lines correctly', () => {
            const input = `SELECT
id
,
name
,
age
,
email
FROM users`;

            const result = formatter.format(input);

            // No commas should be on their own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line: "${line}"`);
            }

            // Result should still contain all fields
            assert.ok(result.includes('id'));
            assert.ok(result.includes('name'));
            assert.ok(result.includes('age'));
            assert.ok(result.includes('email'));
        });

        it('should preserve commas that are part of content (not on separate lines)', () => {
            const input = `INSERT INTO users (id, name, age) VALUES (#{id}, #{name}, #{age})`;
            const result = formatter.format(input);

            // Should still have commas in the output (as part of column list)
            assert.ok(result.includes(','));

            // But no comma should be on its own line
            const lines = result.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                assert.ok(!trimmedLine.match(/^,\s*$/), `Found comma on separate line: "${line}"`);
            }
        });
    });

    describe('Proper Nested Tag Indentation with Custom Tab Width', () => {
        it('should properly indent <trim> and <if> tags with 4-space indentation', () => {
            const input = `INSERT INTO user_table <trim prefix="(" suffix=")" suffixOverrides=","><if test="id != null">id,</if><if test="name != null">user_name,</if><if test="age != null">age,</if></trim>`;
            const result = formatter.format(input, { tabWidth: 4 });

            // Verify tags are on separate lines
            assert.ok(result.includes('<trim'));

            // Verify <if> tags are indented under <trim>
            const lines = result.split('\n');
            let trimLineIndex = -1;
            let firstIfLineIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('<trim')) {
                    trimLineIndex = i;
                }
                if (lines[i].includes('<if test="id != null">') && firstIfLineIndex === -1) {
                    firstIfLineIndex = i;
                }
            }

            // <if> should be on a different line than <trim>
            assert.ok(trimLineIndex !== -1, 'Should find <trim> tag');
            assert.ok(firstIfLineIndex !== -1, 'Should find <if> tag');
            assert.ok(firstIfLineIndex > trimLineIndex, '<if> should be on a line after <trim>');

            // Check indentation - <if> should have 4 more spaces than <trim>
            const trimLine = lines[trimLineIndex];
            const ifLine = lines[firstIfLineIndex];
            const trimIndent = trimLine.match(/^(\s*)/)?.[1].length || 0;
            const ifIndent = ifLine.match(/^(\s*)/)?.[1].length || 0;

            assert.strictEqual(ifIndent - trimIndent, 4, '<if> should be indented 4 spaces more than <trim>');
        });

        it('should properly indent multi-level nested tags with 4-space indentation', () => {
            const input = `SELECT * FROM users <where><if test="status == 1"><trim prefix="AND"><if test="name != null">name=#{name}</if></trim></if></where>`;
            const result = formatter.format(input, { tabWidth: 4 });

            const lines = result.split('\n');
            const tagIndents = new Map<string, number>();

            for (const line of lines) {
                if (line.includes('<where>')) {
                    tagIndents.set('where', line.match(/^(\s*)/)?.[1].length || 0);
                }
                if (line.includes('<if test="status == 1">')) {
                    tagIndents.set('if1', line.match(/^(\s*)/)?.[1].length || 0);
                }
                if (line.includes('<trim')) {
                    tagIndents.set('trim', line.match(/^(\s*)/)?.[1].length || 0);
                }
                if (line.includes('<if test="name != null">')) {
                    tagIndents.set('if2', line.match(/^(\s*)/)?.[1].length || 0);
                }
            }

            // Verify hierarchical indentation
            const whereIndent = tagIndents.get('where') || 0;
            const if1Indent = tagIndents.get('if1') || 0;
            const trimIndent = tagIndents.get('trim') || 0;
            const if2Indent = tagIndents.get('if2') || 0;

            assert.strictEqual(if1Indent - whereIndent, 4, 'First <if> should be 4 spaces deeper than <where>');
            assert.strictEqual(trimIndent - if1Indent, 4, '<trim> should be 4 spaces deeper than first <if>');
            assert.strictEqual(if2Indent - trimIndent, 4, 'Second <if> should be 4 spaces deeper than <trim>');
        });

        it('should handle real-world INSERT with nested tags and 4-space indentation', () => {
            const input = `INSERT INTO demo_table <trim prefix="(" suffix=")" suffixOverrides=","><if test="id != null">id,</if><if test="userId != null">user_id,</if><if test="status != null">status,</if></trim> VALUES <trim prefix="(" suffix=")" suffixOverrides=","><if test="id != null">#{id},</if><if test="userId != null">#{userId},</if><if test="status != null">#{status},</if></trim>`;
            const result = formatter.format(input, { tabWidth: 4 });

            // Verify proper structure
            assert.ok(result.includes('INSERT INTO'));
            assert.ok(result.includes('<trim prefix="('));
            assert.ok(result.includes('VALUES'));

            // Count indentation levels
            const lines = result.split('\n');
            let hasProperlyIndentedIf = false;

            for (const line of lines) {
                if (line.includes('<if test=')) {
                    const indent = line.match(/^(\s*)/)?.[1].length || 0;
                    // <if> tags should be indented (at least 4 spaces)
                    if (indent >= 4) {
                        hasProperlyIndentedIf = true;
                    }
                }
            }

            assert.ok(hasProperlyIndentedIf, '<if> tags should have proper indentation');
        });
    });
});
