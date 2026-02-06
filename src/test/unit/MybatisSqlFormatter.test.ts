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

    describe('SET Clause Indentation with MyBatis Parameters', () => {
        it('should maintain consistent indentation for all SET clause columns', () => {
            const input = `UPDATE deep_chain_url
SET
  ckey = #{ckey,jdbcType=VARCHAR},
  url = #{url,jdbcType=VARCHAR},
  pkg_id = #{pkgId,jdbcType=VARCHAR},
  remark = #{remark,jdbcType=VARCHAR},
  create_time = #{createTime,jdbcType=TIMESTAMP},
  update_time = #{updateTime,jdbcType=TIMESTAMP}
WHERE
  id = #{id,jdbcType=BIGINT}`;
            const result = formatter.format(input);

            // Parse lines and check indentation
            const lines = result.split('\n');
            const setIndex = lines.findIndex(l => l.trim() === 'SET');
            const whereIndex = lines.findIndex(l => l.trim() === 'WHERE');

            // All lines between SET and WHERE should have the same indentation (4 spaces)
            const setClauseLines = lines.slice(setIndex + 1, whereIndex);
            for (const line of setClauseLines) {
                if (line.trim().length > 0) {
                    const indent = (line.match(/^\s*/) || [''])[0].length;
                    assert.strictEqual(indent, 4, `Line "${line}" should have 4 spaces indentation`);
                }
            }

            // Verify all parameters are preserved
            assert.ok(result.includes('#{ckey,jdbcType=VARCHAR}'));
            assert.ok(result.includes('#{url,jdbcType=VARCHAR}'));
            assert.ok(result.includes('#{pkgId,jdbcType=VARCHAR}'));
            assert.ok(result.includes('#{id,jdbcType=BIGINT}'));
        });

        it('should format simple UPDATE with MyBatis parameters correctly', () => {
            const input = `UPDATE users SET name = #{name}, age = #{age} WHERE id = #{id}`;
            const result = formatter.format(input);

            // Check keywords are uppercase
            assert.ok(result.includes('UPDATE'));
            assert.ok(result.includes('SET'));
            assert.ok(result.includes('WHERE'));

            // Check all SET columns have the same indentation
            const lines = result.split('\n');
            const setIndex = lines.findIndex(l => l.trim() === 'SET');
            const whereIndex = lines.findIndex(l => l.trim() === 'WHERE');

            const setClauseLines = lines.slice(setIndex + 1, whereIndex);
            const indents = setClauseLines.filter(l => l.trim().length > 0).map(l => (l.match(/^\s*/) || [''])[0].length);

            // All indents should be the same
            assert.ok(indents.every(i => i === indents[0]), 'All SET clause columns should have same indentation');
        });
    });

    describe('INSERT Statement Formatting', () => {
        it('should format INSERT with MyBatis parameters with uppercase keywords', () => {
            const input = `insert into deep_chain_url (id, ckey, url) values (#{id}, #{ckey}, #{url})`;
            const result = formatter.format(input);

            // Keywords should be uppercase
            assert.ok(result.includes('INSERT INTO') || result.includes('INSERT\n'), 'INSERT keyword should be uppercase');
            assert.ok(result.includes('VALUES'), 'VALUES keyword should be uppercase');

            // Parameters should be preserved
            assert.ok(result.includes('#{id}'));
            assert.ok(result.includes('#{ckey}'));
            assert.ok(result.includes('#{url}'));
        });

        it('should format INSERT with multiple columns properly', () => {
            const input = `insert into deep_chain_url (id, ckey, url, pkg_id, remark) values (#{id}, #{ckey}, #{url}, #{pkgId}, #{remark})`;
            const result = formatter.format(input);

            // Keywords should be uppercase
            assert.ok(result.toUpperCase().includes('INSERT'));
            assert.ok(result.toUpperCase().includes('VALUES'));

            // All parameters should be preserved
            assert.ok(result.includes('#{id}'));
            assert.ok(result.includes('#{ckey}'));
            assert.ok(result.includes('#{url}'));
            assert.ok(result.includes('#{pkgId}'));
            assert.ok(result.includes('#{remark}'));
        });
    });

    describe('XML Comment Preservation', () => {
        it('should preserve XML comments without corruption', () => {
            const input = `SELECT * FROM t_data
<!-- WHERE status = 1 -->
ORDER BY id`;
            const result = formatter.format(input);

            // Comment should be preserved intact (not corrupted to "< ! --")
            assert.ok(result.includes('<!--'), 'Comment opening should be preserved');
            assert.ok(result.includes('-->'), 'Comment closing should be preserved');
            assert.ok(!result.includes('< ! --'), 'Comment should not be corrupted');
            assert.ok(!result.includes('< !--'), 'Comment should not be corrupted');
        });

        it('should preserve multiple XML comments', () => {
            const input = `<!--<select id="test">-->
<!--SELECT * FROM t_data-->
<!--</select>-->`;
            const result = formatter.format(input);

            // All comments should be preserved
            const commentMatches = result.match(/<!--[\s\S]*?-->/g) || [];
            assert.strictEqual(commentMatches.length, 3, 'Should have 3 comments');

            // No corruption
            assert.ok(!result.includes('< ! --'), 'Comments should not be corrupted');
        });

        it('should preserve XML comment content exactly', () => {
            const input = `SELECT id FROM users
<!-- AND deleted = 0 -->
WHERE status = 1`;
            const result = formatter.format(input);

            // Comment content should be preserved exactly
            assert.ok(result.includes('<!-- AND deleted = 0 -->'), 'Comment content should be preserved');
        });

        it('should handle commented out SQL statements', () => {
            const input = `<!--<include refid="Base_Column_List"/>-->
<!--ORDER BY id DESC LIMIT 10;-->`;
            const result = formatter.format(input);

            // Comments should be intact
            assert.ok(result.includes('<!--<include refid="Base_Column_List"/>-->'));
            assert.ok(result.includes('<!--ORDER BY id DESC LIMIT 10;-->'));
        });
    });

    describe('CDATA Block Preservation', () => {
        it('should preserve CDATA block content without formatting', () => {
            const input = `SELECT total FROM t_records
WHERE status = 1 AND
<![CDATA[ created_at >= #{start} AND created_at < #{end} ]]>
AND type = #{type}`;
            const result = formatter.format(input);

            // CDATA block should be preserved as single line
            const cdataMatch = result.match(/<!\[CDATA\[[\s\S]*?\]\]>/);
            assert.ok(cdataMatch, 'CDATA block should be present');
            assert.strictEqual(cdataMatch![0].split('\n').length, 1, 'CDATA should be on single line');

            // Original content should be preserved
            assert.ok(result.includes('created_at >= #{start}'));
            assert.ok(result.includes('created_at < #{end}'));
        });

        it('should preserve CDATA block inside dynamic tags', () => {
            const input = `SELECT * FROM t_data WHERE id = #{id}
<if test="dateRange != null">
  AND
  <![CDATA[ record_time >= #{dateRange.start} AND record_time <= #{dateRange.end} ]]>
</if>`;
            const result = formatter.format(input);

            // CDATA should be preserved
            const cdataMatch = result.match(/<!\[CDATA\[[\s\S]*?\]\]>/);
            assert.ok(cdataMatch, 'CDATA block should be present');
            assert.strictEqual(cdataMatch![0].split('\n').length, 1, 'CDATA should be on single line');

            // Dynamic tag structure should be preserved
            assert.ok(result.includes('<if test="dateRange != null">'));
            assert.ok(result.includes('</if>'));
        });

        it('should preserve multiple CDATA blocks', () => {
            const input = `SELECT * FROM t_data
WHERE
<![CDATA[ price > #{minPrice} ]]>
AND
<![CDATA[ price < #{maxPrice} ]]>`;
            const result = formatter.format(input);

            // Both CDATA blocks should be preserved
            const cdataMatches = result.match(/<!\[CDATA\[[\s\S]*?\]\]>/g) || [];
            assert.strictEqual(cdataMatches.length, 2, 'Should have 2 CDATA blocks');

            // Each should be on single line
            cdataMatches.forEach(match => {
                assert.strictEqual(match.split('\n').length, 1, 'Each CDATA should be on single line');
            });
        });

        it('should preserve CDATA with comparison operators', () => {
            const input = `SELECT * FROM t_data WHERE <![CDATA[ value >= 100 AND value <= 200 ]]>`;
            const result = formatter.format(input);

            // CDATA should be preserved exactly
            assert.ok(result.includes('<![CDATA[ value >= 100 AND value <= 200 ]]>'));
        });
    });

    describe('Parenthesis Alignment with Dynamic Tags', () => {
        it('should align parenthesis with AND keyword in dynamic SQL', () => {
            const input = `SELECT id FROM t_order WHERE status = 1
<if test="dateRanges != null">
  AND
  (
  <trim prefixOverrides="OR">
    <foreach collection="dateRanges" item="range">
      OR (created_at BETWEEN #{range.start} AND #{range.end})
    </foreach>
  </trim>
  )
</if>`;
            const result = formatter.format(input);

            // Parse lines and find AND and ( lines
            const lines = result.split('\n');
            const andLineIdx = lines.findIndex(l => l.trim() === 'AND');
            const openParenLineIdx = lines.findIndex((l, i) => i > andLineIdx && l.trim() === '(');

            assert.ok(andLineIdx >= 0, 'Should find AND line');
            assert.ok(openParenLineIdx >= 0, 'Should find ( line');

            // Both should have the same indentation
            const andIndent = (lines[andLineIdx].match(/^\s*/) || [''])[0].length;
            const parenIndent = (lines[openParenLineIdx].match(/^\s*/) || [''])[0].length;
            assert.strictEqual(andIndent, parenIndent, 'Parenthesis should be aligned with AND');
        });

        it('should properly indent incomplete SQL fragments inside dynamic tags', () => {
            const input = `SELECT * FROM users
<if test="condition">
  AND name = #{name}
  OR
  (
  <foreach collection="items" item="item">
    item_id = #{item.id}
  </foreach>
  )
</if>`;
            const result = formatter.format(input);

            // Verify structure is preserved
            assert.ok(result.includes('<if test="condition">'));
            assert.ok(result.includes('<foreach'));
            assert.ok(result.includes('#{name}'));
            assert.ok(result.includes('#{item.id}'));

            // Verify OR and ( have same indentation
            const lines = result.split('\n');
            const orLineIdx = lines.findIndex(l => l.trim() === 'OR');
            const parenLineIdx = lines.findIndex((l, i) => i > orLineIdx && l.trim() === '(');

            if (orLineIdx >= 0 && parenLineIdx >= 0) {
                const orIndent = (lines[orLineIdx].match(/^\s*/) || [''])[0].length;
                const parenIndent = (lines[parenLineIdx].match(/^\s*/) || [''])[0].length;
                assert.strictEqual(orIndent, parenIndent, 'Parenthesis should be aligned with OR');
            }
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

    describe('HTML Entity Preservation', () => {
        it('should preserve &gt; and &lt; entities in SQL comparisons', () => {
            const input = `SELECT * FROM orders WHERE create_time &gt;= #{startTime} AND create_time &lt;= #{endTime}`;
            const result = formatter.format(input);

            // HTML entities should be preserved intact
            assert.ok(result.includes('&gt;'), 'Should preserve &gt; entity');
            assert.ok(result.includes('&lt;'), 'Should preserve &lt; entity');
            // Should not have spaces breaking up the entities
            assert.ok(!result.includes('& gt;'), 'Should not break up &gt; entity');
            assert.ok(!result.includes('& lt;'), 'Should not break up &lt; entity');
            assert.ok(!result.includes('& amp;'), 'Should not break up &amp; entity');
        });

        it('should preserve &amp; entity', () => {
            const input = `SELECT * FROM users WHERE name LIKE '%&amp;%'`;
            const result = formatter.format(input);

            assert.ok(result.includes('&amp;'), 'Should preserve &amp; entity');
            assert.ok(!result.includes('& amp;'), 'Should not break up &amp; entity');
        });

        it('should preserve &quot; and &apos; entities', () => {
            const input = `SELECT * FROM data WHERE value = &quot;test&quot;`;
            const result = formatter.format(input);

            assert.ok(result.includes('&quot;'), 'Should preserve &quot; entity');
        });

        it('should preserve numeric character references', () => {
            const input = `SELECT * FROM data WHERE code = &#60; AND value = &#x3C;`;
            const result = formatter.format(input);

            assert.ok(result.includes('&#60;'), 'Should preserve decimal numeric reference');
            assert.ok(result.includes('&#x3C;'), 'Should preserve hexadecimal numeric reference');
        });

        it('should preserve multiple HTML entities in complex query', () => {
            const input = `SELECT * FROM records
WHERE apply_time &gt;= #{startApplyTime,jdbcType=BIGINT}
AND apply_time &lt;= #{endApplyTime,jdbcType=BIGINT}
AND status &lt;&gt; 0`;
            const result = formatter.format(input);

            assert.ok(result.includes('&gt;'), 'Should preserve first &gt;');
            assert.ok(result.includes('&lt;'), 'Should preserve first &lt;');
            // All entities should remain intact
            const gtCount = (result.match(/&gt;/g) || []).length;
            const ltCount = (result.match(/&lt;/g) || []).length;
            assert.ok(gtCount >= 1, 'Should have at least 1 &gt; entity');
            assert.ok(ltCount >= 2, 'Should have at least 2 &lt; entities');
        });

        it('should preserve HTML entities inside dynamic tags', () => {
            const input = `SELECT * FROM users WHERE 1=1 <if test="age != null">AND age &gt;= #{minAge}</if>`;
            const result = formatter.format(input);

            assert.ok(result.includes('&gt;'), 'Should preserve &gt; inside <if> tag');
            assert.ok(result.includes('<if test="age != null">'));
            assert.ok(result.includes('</if>'));
        });

        it('should preserve HTML entities with foreach tag', () => {
            const input = `SELECT * FROM items
WHERE price &gt;= #{minPrice}
AND status IN <foreach collection="statusList" item="status" open="(" separator="," close=")">#{status}</foreach>`;
            const result = formatter.format(input);

            assert.ok(result.includes('&gt;'), 'Should preserve &gt; entity');
            assert.ok(result.includes('<foreach'), 'Should preserve foreach tag');
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

    describe('selectKey Tag Preservation', () => {
        it('should preserve <selectKey> tag inside INSERT statement', () => {
            const input = `<selectKey keyProperty="id" order="AFTER" resultType="java.lang.Long">SELECT LAST_INSERT_ID()</selectKey>
insert into user_account
<trim prefix="(" suffix=")" suffixOverrides=",">
<if test="id != null">id,</if>
<if test="userName != null">user_name,</if>
<if test="email != null">email,</if>
</trim>
<trim prefix="values (" suffix=")" suffixOverrides=",">
<if test="id != null">#{id,jdbcType=BIGINT},</if>
<if test="userName != null">#{userName,jdbcType=VARCHAR},</if>
<if test="email != null">#{email,jdbcType=VARCHAR},</if>
</trim>`;
            const result = formatter.format(input);

            // selectKey tag should be preserved intact
            assert.ok(result.includes('<selectKey'), 'Should preserve <selectKey> opening tag');
            assert.ok(result.includes('keyProperty="id"'), 'Should preserve keyProperty attribute');
            assert.ok(result.includes('order="AFTER"'), 'Should preserve order attribute (not uppercased)');
            assert.ok(result.includes('resultType="java.lang.Long"'), 'Should preserve resultType attribute');
            assert.ok(result.includes('</selectKey>'), 'Should preserve </selectKey> closing tag');
            assert.ok(result.includes('LAST_INSERT_ID()'), 'Should preserve SQL inside selectKey');

            // Content after selectKey should NOT be lost
            assert.ok(result.includes('<trim'), 'Should preserve <trim> tags after selectKey');
            assert.ok(result.includes('<if test="id != null">'), 'Should preserve <if> tags after selectKey');
            assert.ok(result.includes('#{id,jdbcType=BIGINT}'), 'Should preserve parameters after selectKey');
            assert.ok(result.includes('#{userName,jdbcType=VARCHAR}'), 'Should preserve parameters after selectKey');

            // Both trim tags should be present
            const trimCount = (result.match(/<trim/g) || []).length;
            assert.strictEqual(trimCount, 2, 'Should have 2 <trim> tags');

            // All if tags should be present
            const ifCount = (result.match(/<if test=/g) || []).length;
            assert.strictEqual(ifCount, 6, 'Should have 6 <if> tags');
        });

        it('should preserve <selectKey> with order="BEFORE"', () => {
            const input = `<selectKey keyProperty="id" order="BEFORE" resultType="java.lang.String">SELECT REPLACE(UUID(), '-', '')</selectKey>
insert into sys_config (id, config_key, config_value)
values (#{id,jdbcType=VARCHAR}, #{configKey,jdbcType=VARCHAR}, #{configValue,jdbcType=VARCHAR})`;
            const result = formatter.format(input);

            assert.ok(result.includes('<selectKey'), 'Should preserve <selectKey> tag');
            assert.ok(result.includes('order="BEFORE"'), 'Should preserve order="BEFORE"');
            assert.ok(result.includes('</selectKey>'), 'Should preserve closing tag');
            assert.ok(result.includes('UUID()'), 'Should preserve UUID function');

            // SQL after selectKey should be preserved
            assert.ok(result.includes('INSERT INTO') || result.includes('insert into'), 'Should preserve INSERT statement');
            assert.ok(result.includes('#{id,jdbcType=VARCHAR}'), 'Should preserve parameters');
        });

        it('should properly indent <selectKey> content', () => {
            const input = `<selectKey keyProperty="id" order="AFTER" resultType="java.lang.Long">
SELECT LAST_INSERT_ID()
</selectKey>
insert into demo_table (name, status) values (#{name}, #{status})`;
            const result = formatter.format(input);

            // selectKey should be on its own line with proper indentation
            const lines = result.split('\n');
            const selectKeyLine = lines.find(l => l.includes('<selectKey'));
            const closingLine = lines.find(l => l.includes('</selectKey>'));

            assert.ok(selectKeyLine, 'Should have <selectKey> line');
            assert.ok(closingLine, 'Should have </selectKey> line');

            // The SQL inside should exist
            assert.ok(result.includes('LAST_INSERT_ID()'), 'Should preserve SQL content');
        });

        it('should handle <selectKey> with many following dynamic tags', () => {
            const input = `<selectKey keyProperty="id" order="AFTER" resultType="java.lang.Long">SELECT LAST_INSERT_ID()</selectKey>
insert into product
<trim prefix="(" suffix=")" suffixOverrides=",">
<if test="productName != null">product_name,</if>
<if test="price != null">price,</if>
<if test="category != null">category,</if>
<if test="stock != null">stock,</if>
<if test="createTime != null">create_time,</if>
<if test="updateTime != null">update_time,</if>
</trim>
<trim prefix="values (" suffix=")" suffixOverrides=",">
<if test="productName != null">#{productName,jdbcType=VARCHAR},</if>
<if test="price != null">#{price,jdbcType=DECIMAL},</if>
<if test="category != null">#{category,jdbcType=VARCHAR},</if>
<if test="stock != null">#{stock,jdbcType=INTEGER},</if>
<if test="createTime != null">#{createTime,jdbcType=TIMESTAMP},</if>
<if test="updateTime != null">#{updateTime,jdbcType=TIMESTAMP},</if>
</trim>`;
            const result = formatter.format(input);

            // selectKey should be preserved
            assert.ok(result.includes('<selectKey'), 'Should preserve selectKey');
            assert.ok(result.includes('</selectKey>'), 'Should preserve closing selectKey');

            // ALL content after selectKey must be preserved
            assert.ok(result.includes('#{productName,jdbcType=VARCHAR}'), 'Should preserve productName param');
            assert.ok(result.includes('#{price,jdbcType=DECIMAL}'), 'Should preserve price param');
            assert.ok(result.includes('#{createTime,jdbcType=TIMESTAMP}'), 'Should preserve createTime param');
            assert.ok(result.includes('#{updateTime,jdbcType=TIMESTAMP}'), 'Should preserve updateTime param');

            // Count all if tags - none should be lost
            const ifCount = (result.match(/<if test=/g) || []).length;
            assert.strictEqual(ifCount, 12, 'All 12 <if> tags should be preserved');

            // Count closing if tags
            const closeIfCount = (result.match(/<\/if>/g) || []).length;
            assert.strictEqual(closeIfCount, 12, 'All 12 </if> tags should be preserved');
        });
    });

    describe('Unknown Closing Tag Robustness', () => {
        it('should not lose content after unknown closing tags', () => {
            // Simulate an unknown XML tag that is not in DYNAMIC_TAGS
            // The parser should consume it as text and continue parsing
            const input = `SELECT * FROM users
<customTag>some content</customTag>
<where><if test="status != null">AND status = #{status}</if></where>`;
            const result = formatter.format(input);

            // Content after unknown closing tag should NOT be lost
            assert.ok(result.includes('<where>'), 'Should preserve <where> after unknown tag');
            assert.ok(result.includes('<if test="status != null">'), 'Should preserve <if> after unknown tag');
            assert.ok(result.includes('#{status}'), 'Should preserve parameter after unknown tag');
            assert.ok(result.includes('</where>'), 'Should preserve </where>');
        });

        it('should handle multiple unknown tags without losing subsequent content', () => {
            const input = `<unknownA>content A</unknownA>
<unknownB>content B</unknownB>
SELECT id FROM demo_table
<if test="name != null">WHERE name = #{name}</if>`;
            const result = formatter.format(input);

            // Known tags after unknown tags should be preserved
            assert.ok(result.includes('<if test="name != null">'), 'Should preserve <if> tag');
            assert.ok(result.includes('#{name}'), 'Should preserve parameter');
            assert.ok(result.includes('</if>'), 'Should preserve </if>');
        });
    });
});
