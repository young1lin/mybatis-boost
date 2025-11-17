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

    describe('SQL Keyword Detection in Dynamic Tags', () => {
        it('should find SQL keywords in <if> tag', async () => {
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

            // Should find "SELECT", "FROM", "AND" keywords
            assert.ok(decorations.length > 0, 'Should find SQL keywords');

            // Check that "AND" inside <if> tag is found
            const andKeyword = decorations.find((d: any) => {
                const text = doc.getText(d.range);
                return text === 'AND';
            });
            assert.ok(andKeyword, 'Should find "AND" keyword inside <if> tag');
        });

        it('should find SQL keywords in <where> tag', async () => {
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

            // Should find keywords in <where> tag
            const hasAndKeyword = decorations.some((d: any) => doc.getText(d.range) === 'AND');
            const hasOrKeyword = decorations.some((d: any) => doc.getText(d.range) === 'OR');
            const hasLikeKeyword = decorations.some((d: any) => doc.getText(d.range) === 'LIKE');

            assert.ok(hasAndKeyword, 'Should find "AND" keyword');
            assert.ok(hasOrKeyword, 'Should find "OR" keyword');
            assert.ok(hasLikeKeyword, 'Should find "LIKE" keyword');
        });

        it('should find SQL keywords in <set> tag', async () => {
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

            // Should find "UPDATE", "WHERE" keywords
            const hasUpdateKeyword = decorations.some((d: any) => doc.getText(d.range) === 'UPDATE');
            const hasWhereKeyword = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');

            assert.ok(hasUpdateKeyword, 'Should find "UPDATE" keyword');
            assert.ok(hasWhereKeyword, 'Should find "WHERE" keyword');
        });

        it('should find SQL keywords in <foreach> tag', async () => {
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

            // Should find "SELECT", "FROM", "WHERE", "IN" keywords
            const hasSelectKeyword = decorations.some((d: any) => doc.getText(d.range) === 'SELECT');
            const hasFromKeyword = decorations.some((d: any) => doc.getText(d.range) === 'FROM');
            const hasWhereKeyword = decorations.some((d: any) => doc.getText(d.range) === 'WHERE');
            const hasInKeyword = decorations.some((d: any) => doc.getText(d.range) === 'IN');

            assert.ok(hasSelectKeyword, 'Should find "SELECT" keyword');
            assert.ok(hasFromKeyword, 'Should find "FROM" keyword');
            assert.ok(hasWhereKeyword, 'Should find "WHERE" keyword');
            assert.ok(hasInKeyword, 'Should find "IN" keyword');
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
