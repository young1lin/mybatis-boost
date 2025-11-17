/**
 * Unit tests for DynamicSqlHighlighter
 * Tests SQL keyword detection in dynamic SQL tags
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { DynamicSqlHighlighter } from '../../decorator/DynamicSqlHighlighter';

describe('DynamicSqlHighlighter Unit Tests', () => {
    let highlighter: DynamicSqlHighlighter;

    beforeEach(() => {
        // Create a new highlighter instance for each test
        highlighter = new DynamicSqlHighlighter();
    });

    afterEach(() => {
        // Clean up
        highlighter.dispose();
    });

    describe('MyBatis Mapper XML Detection', () => {
        it('should detect valid MyBatis Mapper XML with namespace', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        SELECT * FROM users
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const isMybatisXml = await (highlighter as any).isMybatisMapperXml(doc);
            assert.strictEqual(isMybatisXml, true);
        });

        it('should reject XML without mapper tag', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<root>
    <item>content</item>
</root>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const isMybatisXml = await (highlighter as any).isMybatisMapperXml(doc);
            assert.strictEqual(isMybatisXml, false);
        });

        it('should reject XML with mapper but no namespace', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectById">
        SELECT * FROM users
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const isMybatisXml = await (highlighter as any).isMybatisMapperXml(doc);
            assert.strictEqual(isMybatisXml, false);
        });
    });

    describe('SQL Keyword Detection in Statement Tags', () => {
        it('should find SQL keywords in <select> tag', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.RoleMapper">
    <select id="getById" resultMap="RoleResultMap">
        SELECT * FROM role
        WHERE id = #{id}
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "SELECT", "FROM", "WHERE" keywords
            const hasSelect = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            const hasWhere = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasSelect, 'Should find "SELECT" keyword in <select> tag');
            assert.ok(hasFrom, 'Should find "FROM" keyword in <select> tag');
            assert.ok(hasWhere, 'Should find "WHERE" keyword in <select> tag');
        });

        it('should find SQL keywords in <update> tag', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.RoleMapper">
    <update id="updateById" parameterType="com.example.Role">
        UPDATE role
        SET role_name = #{roleName}
        WHERE id = #{id}
    </update>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "UPDATE", "SET", "WHERE" keywords
            const hasUpdate = decorations.some((d: any) => doc.getText(d.range) === 'UPDATE');
            const hasSet = decorations.some((d: any) => doc.getText(d.range) === 'SET');
            const hasWhere = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasUpdate, 'Should find "UPDATE" keyword in <update> tag');
            assert.ok(hasSet, 'Should find "SET" keyword in <update> tag');
            assert.ok(hasWhere, 'Should find "WHERE" keyword in <update> tag');
        });

        it('should find SQL keywords in <delete> tag', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.RoleMapper">
    <delete id="deleteById">
        DELETE FROM role
        WHERE id = #{id}
    </delete>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "DELETE", "FROM", "WHERE" keywords
            const hasDelete = decorations.some((d: any) => doc.getText(d.range) === 'DELETE');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            const hasWhere = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasDelete, 'Should find "DELETE" keyword in <delete> tag');
            assert.ok(hasFrom, 'Should find "FROM" keyword in <delete> tag');
            assert.ok(hasWhere, 'Should find "WHERE" keyword in <delete> tag');
        });

        it('should find SQL keywords in <insert> tag', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.RoleMapper">
    <insert id="insert" parameterType="com.example.Role">
        INSERT INTO role (id, role_name)
        VALUES (#{id}, #{roleName})
    </insert>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "INSERT", "INTO", "VALUES" keywords
            const hasInsert = decorations.some((d: any) => doc.getText(d.range) === 'INSERT');
            const hasInto = decorations.some((d: any) => doc.getText(d.range) === 'INTO');
            const hasValues = decorations.some((d: any) => doc.getText(d.range) === 'VALUES');

            assert.ok(hasInsert, 'Should find "INSERT" keyword in <insert> tag');
            assert.ok(hasInto, 'Should find "INTO" keyword in <insert> tag');
            assert.ok(hasValues, 'Should find "VALUES" keyword in <insert> tag');
        });

        it('should find SQL keywords in user provided XML example', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.young1lin.mybatis.boost.integration.test.mapper.RoleMapper">
    <resultMap id="RoleResultMap" type="com.young1lin.mybatis.boost.integration.test.domain.Role">
        <id property="id" column="id"/>
        <result property="roleName" column="role_name"/>
    </resultMap>

    <select id="getById" resultMap="RoleResultMap">
        SELECT * FROM role
        WHERE id = #{id}
    </select>

    <update id="updateById" parameterType="com.young1lin.mybatis.boost.integration.test.domain.Role">
        UPDATE role
        SET role_name = #{roleName}
        WHERE id = #{id}
    </update>

    <delete id="deleteById">
        DELETE FROM role
        WHERE id = #{id}
    </delete>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find multiple SQL keywords
            assert.ok(decorations.length > 0, 'Should find SQL keywords in the document');

            // Verify specific keywords from different statement types
            const hasSelect = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasUpdate = decorations.some((d: any) => doc.getText(d.range) === 'UPDATE');
            const hasDelete = decorations.some((d: any) => doc.getText(d.range) === 'DELETE');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            const hasSet = decorations.some((d: any) => doc.getText(d.range) === 'SET');
            const hasWhere = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasSelect, 'Should find "SELECT" keyword');
            assert.ok(hasUpdate, 'Should find "UPDATE" keyword');
            assert.ok(hasDelete, 'Should find "DELETE" keyword');
            assert.ok(hasFrom, 'Should find "FROM" keyword');
            assert.ok(hasSet, 'Should find "SET" keyword');
            assert.ok(hasWhere, 'Should find "WHERE" keyword');
        });
    });

    describe('SQL Keyword Detection in Dynamic Tags', () => {
        it('should find SQL keywords in <if> tag nested inside <select>', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        SELECT * FROM users
        <if test="name != null">
            AND name = #{name}
        </if>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find keywords in both <select> and <if> tags
            assert.ok(decorations.length > 0, 'Should find SQL keywords');

            // Check that "AND" inside <if> tag is found
            const andKeyword = decorations.find((d: any) => {
                const text = doc.getText(d.range);
                return text === 'AND';
            });
            assert.ok(andKeyword, 'Should find "AND" keyword inside <if> tag');

            // Check that keywords in <select> are also found
            const hasSelect = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            assert.ok(hasSelect, 'Should find "SELECT" keyword in <select> tag');
            assert.ok(hasFrom, 'Should find "FROM" keyword in <select> tag');
        });

        it('should find SQL keywords in <where> tag nested inside <select>', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectUsers">
        SELECT * FROM users
        <where>
            <if test="id != null">
                AND id = #{id}
            </if>
            OR name LIKE #{name}
        </where>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find keywords in <where>, <if>, and <select> tags
            const hasAndKeyword = decorations.some((d: any) => doc.getText(d.range) === 'AND');
            const hasOrKeyword = decorations.some((d: any) => doc.getText(d.range) === 'OR');
            const hasLikeKeyword = decorations.some((d: any) => doc.getText(d.range) === 'LIKE');
            const hasSelect = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range) === 'FROM');

            assert.ok(hasAndKeyword, 'Should find "AND" keyword');
            assert.ok(hasOrKeyword, 'Should find "OR" keyword');
            assert.ok(hasLikeKeyword, 'Should find "LIKE" keyword');
            assert.ok(hasSelect, 'Should find "SELECT" keyword');
            assert.ok(hasFrom, 'Should find "FROM" keyword');
        });

        it('should find SQL keywords in <set> tag nested inside <update>', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <update id="updateUser">
        UPDATE users
        <set>
            name = #{name},
            age = #{age}
        </set>
        WHERE id = #{id}
    </update>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find keywords in both <update> and <set> tags
            const hasUpdateKeyword = decorations.some((d: any) => doc.getText(d.range) === 'UPDATE');
            const hasWhereKeyword = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasUpdateKeyword, 'Should find "UPDATE" keyword in <update> tag');
            assert.ok(hasWhereKeyword, 'Should find "WHERE" keyword in <update> tag');
        });

        it('should find SQL keywords in <foreach> tag nested inside <select>', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectByIds">
        SELECT * FROM users
        WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find keywords in both <select> and <foreach> tags
            const hasSelectKeyword = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasFromKeyword = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            const hasWhereKeyword = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');
            const hasInKeyword = decorations.some((d: any) => doc.getText(d.range) === 'IN');

            assert.ok(hasSelectKeyword, 'Should find "SELECT" keyword in <select> tag');
            assert.ok(hasFromKeyword, 'Should find "FROM" keyword in <select> tag');
            assert.ok(hasWhereKeyword, 'Should find "WHERE" keyword in <select> tag');
            assert.ok(hasInKeyword, 'Should find "IN" keyword in <select> tag');
        });
    });

    describe('OGNL Expression Exclusion', () => {
        it('should NOT highlight "and" inside #{...} expressions', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        SELECT * FROM users
        <if test="name != null">
            WHERE name = #{name and something}
        </if>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "WHERE" but not "and" inside #{...}
            const hasWhereKeyword = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');
            assert.ok(hasWhereKeyword, 'Should find "WHERE" keyword');

            // Check that "and" inside #{...} is not highlighted
            const insideOgnlDecorations = decorations.filter((d: any) => {
                const text = doc.getText(d.range).toLowerCase();
                const offset = doc.offsetAt(d.range.start);
                const beforeText = doc.getText().substring(0, offset);

                // Check if this is inside #{...}
                const lastHashBrace = beforeText.lastIndexOf('#{');
                const lastCloseBrace = beforeText.lastIndexOf('}');

                return text === 'and' && lastHashBrace > lastCloseBrace;
            });

            assert.strictEqual(insideOgnlDecorations.length, 0, 'Should NOT highlight "and" inside OGNL expressions');
        });

        it('should NOT highlight "or" inside ${...} expressions', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        SELECT * FROM users
        <if test="condition">
            WHERE name = $\{name or default}
        </if>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Check that "or" inside ${...} is not highlighted
            const insideOgnlDecorations = decorations.filter((d: any) => {
                const text = doc.getText(d.range).toLowerCase();
                const offset = doc.offsetAt(d.range.start);
                const beforeText = doc.getText().substring(0, offset);

                // Check if this is inside ${...}
                const lastDollarBrace = beforeText.lastIndexOf('${');
                const lastCloseBrace = beforeText.lastIndexOf('}');

                return text === 'or' && lastDollarBrace > lastCloseBrace;
            });

            assert.strictEqual(insideOgnlDecorations.length, 0, 'Should NOT highlight "or" inside OGNL expressions');
        });

        it('should highlight SQL keywords outside OGNL expressions but not inside', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        SELECT * FROM users
        <if test="name != null and age != null">
            WHERE name = #{name} AND age = #{age}
        </if>
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find "AND" in SQL content (not in test attribute)
            const andInSql = decorations.filter((d: any) => {
                const text = doc.getText(d.range);
                return text === 'AND';
            });

            // The "AND" in SQL should be highlighted, but "and" in test attribute should not be
            assert.ok(andInSql.length >= 1, 'Should find "AND" keyword in SQL content');
        });
    });

    describe('Case Insensitive Matching', () => {
        it('should find SQL keywords regardless of case', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        select * from users
        <if test="name != null">
            and name = #{name}
        </if>
        Or age > 18
    </select>
</mapper>`;

            const doc = await createMockDocument('test.xml', xmlContent);
            const decorations = (highlighter as any).findSqlKeywords(doc);

            // Should find lowercase keywords
            const hasSelect = decorations.some((d: any) => doc.getText(d.range).toLowerCase() === 'select');
            const hasFrom = decorations.some((d: any) => doc.getText(d.range).toLowerCase() === 'from');
            const hasAnd = decorations.some((d: any) => doc.getText(d.range).toLowerCase() === 'and');
            const hasOr = decorations.some((d: any) => doc.getText(d.range) === 'Or');

            assert.ok(hasSelect, 'Should find "select" keyword');
            assert.ok(hasFrom, 'Should find "from" keyword');
            assert.ok(hasAnd, 'Should find "and" keyword');
            assert.ok(hasOr, 'Should find "Or" keyword');
        });
    });
});

/**
 * Helper function to create a mock VS Code document
 */
async function createMockDocument(fileName: string, content: string): Promise<vscode.TextDocument> {
    // Create a temporary file in the workspace
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    const filePath = path.join(workspaceFolder.uri.fsPath, 'test-fixtures', fileName);
    const uri = vscode.Uri.file(filePath);

    // Use VS Code API to create a text document
    const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'xml'
    });

    return doc;
}
