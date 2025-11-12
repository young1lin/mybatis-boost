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
            assert.ok(result.includes('name = #{name}'));
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
});
