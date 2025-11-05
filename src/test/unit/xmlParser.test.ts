/**
 * Unit tests for xmlParser
 * These tests use mocked file system and do not require VS Code API
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import {
    extractXmlNamespace,
    extractXmlStatements,
    findXmlStatementLine,
    findXmlStatementPosition,
    extractStatementIdFromPosition
} from '../../navigator/parsers/xmlParser';
import * as fileUtils from '../../utils/fileUtils';

describe('xmlParser Unit Tests', () => {
    let readFirstLinesStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFirstLinesStub = sinon.stub(fileUtils, 'readFirstLines');
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractXmlNamespace', () => {
        it('should extract namespace from mapper tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">
</mapper>`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractXmlNamespace('/fake/path/UserMapper.xml');
            assert.strictEqual(result, 'com.example.mapper.UserMapper');
        });

        it('should handle namespace with single quotes', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace='com.example.mapper.UserMapper'>
</mapper>`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractXmlNamespace('/fake/path/UserMapper.xml');
            assert.strictEqual(result, 'com.example.mapper.UserMapper');
        });

        it('should return null when namespace is missing', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper>
</mapper>`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractXmlNamespace('/fake/path/UserMapper.xml');
            assert.strictEqual(result, null);
        });
    });

    describe('extractXmlStatements', () => {
        it('should extract all SQL statements with IDs', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <insert id="insert">
        INSERT INTO users (name, age) VALUES (#{name}, #{age})
    </insert>

    <update id="update">
        UPDATE users SET name = #{name} WHERE id = #{id}
    </update>

    <delete id="delete">
        DELETE FROM users WHERE id = #{id}
    </delete>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].id, 'selectById');
            assert.strictEqual(result[0].type, 'select');
            assert.strictEqual(result[0].resultType, 'com.example.model.User');
            assert.strictEqual(result[1].id, 'insert');
            assert.strictEqual(result[1].type, 'insert');
            assert.strictEqual(result[2].id, 'update');
            assert.strictEqual(result[3].id, 'delete');
        });

        it('should handle multi-line tags', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select
        id="selectByAge"
        resultType="com.example.model.User"
        parameterType="int">
        SELECT * FROM users WHERE age = #{age}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'selectByAge');
            assert.strictEqual(result[0].type, 'select');
        });

        it('should return empty array for invalid XML', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <!-- No statements -->
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 0);
        });
    });

    describe('findXmlStatementLine', () => {
        it('should find correct line number for statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <insert id="insert">
        INSERT INTO users (name, age) VALUES (#{name}, #{age})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await findXmlStatementLine('/fake/path/UserMapper.xml', 'insert');
            // Line 6 (0-indexed)
            assert.strictEqual(result, 6);
        });

        it('should return null for non-existent statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await findXmlStatementLine('/fake/path/UserMapper.xml', 'nonExistent');
            assert.strictEqual(result, null);
        });
    });

    describe('findXmlStatementPosition', () => {
        it('should find correct position (line and column range) for statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <insert id="insert">
        INSERT INTO users (name, age) VALUES (#{name}, #{age})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await findXmlStatementPosition('/fake/path/UserMapper.xml', 'insert');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 6);
            // Column should point to the start of "insert" value (after the quote)
            const line = mockContent.split('\n')[6];
            const expectedStartColumn = line.indexOf('"insert"') + 1; // After opening quote
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'insert'.length);
        });

        it('should handle single quotes in id attribute', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id='selectAllById' resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await findXmlStatementPosition('/fake/path/UserMapper.xml', 'selectAllById');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 2);
            const line = mockContent.split('\n')[2];
            const expectedStartColumn = line.indexOf("'selectAllById'") + 1; // After opening quote
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'selectAllById'.length);
        });

        it('should return null for non-existent statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await findXmlStatementPosition('/fake/path/UserMapper.xml', 'nonExistent');
            assert.strictEqual(result, null);
        });
    });

    describe('extractStatementIdFromPosition', () => {
        it('should extract statement ID from cursor position', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            // Line 3 is inside the select statement
            const result = await extractStatementIdFromPosition('/fake/path/UserMapper.xml', 3);
            assert.strictEqual(result, 'selectById');
        });

        it('should search backward to find nearest statement tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users
        WHERE id = #{id}
        AND status = 'active'
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            // Line 5 is far from the tag, but should still find it
            const result = await extractStatementIdFromPosition('/fake/path/UserMapper.xml', 5);
            assert.strictEqual(result, 'selectById');
        });

        it('should return null when no statement tag found within search range', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <resultMap id="UserResultMap" type="com.example.model.User">
        <result property="id" column="id"/>
    </resultMap>
</mapper>`;
            readFileStub.resolves(mockContent);

            // Line 3 is inside resultMap, not a statement
            const result = await extractStatementIdFromPosition('/fake/path/UserMapper.xml', 3);
            assert.strictEqual(result, null);
        });
    });

    describe('extractXmlStatements - XML comments handling', () => {
        it('should ignore commented-out statements', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <!-- <delete id="deleteById">
        DELETE FROM users WHERE id = #{id}
    </delete> -->

    <update id="updateById">
        UPDATE users SET name = #{name} WHERE id = #{id}
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            // Should only find selectById and updateById, not the commented deleteById
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'selectById');
            assert.strictEqual(result[1].id, 'updateById');

            // Ensure deleteById is not in results
            const hasDeleteById = result.some(stmt => stmt.id === 'deleteById');
            assert.strictEqual(hasDeleteById, false, 'Should not extract commented statement');
        });

        it('should handle inline comments correctly', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <!-- This is a comment --> <insert id="insert">
        INSERT INTO users (name) VALUES (#{name})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'selectById');
            assert.strictEqual(result[1].id, 'insert');
        });

        it('should preserve line numbers after removing comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>

    <!-- Multi-line comment
         spanning multiple lines
         should preserve line numbers -->

    <update id="updateById">
        UPDATE users SET name = #{name} WHERE id = #{id}
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 2);

            // Line numbers should be accurate (the update is on line 10, 0-indexed)
            const updateStmt = result.find(s => s.id === 'updateById');
            assert.ok(updateStmt);
            assert.strictEqual(updateStmt.line, 10);
        });
    });

    describe('extractXmlStatements - column tracking', () => {
        it('should track column position for each statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM users WHERE id = #{id}
    </select>
    <insert id="insert">
        INSERT INTO users (name, age) VALUES (#{name}, #{age})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 2);

            // All statements should have column positions
            result.forEach(stmt => {
                assert.ok(stmt.startColumn >= 0, `Statement ${stmt.id} should have startColumn >= 0`);
                assert.ok(stmt.endColumn > stmt.startColumn, `Statement ${stmt.id} should have endColumn > startColumn`);
            });

            // Check specific column positions
            const lines = mockContent.split('\n');
            assert.strictEqual(result[0].startColumn, lines[2].indexOf('"selectById"') + 1);
            assert.strictEqual(result[1].startColumn, lines[5].indexOf('"insert"') + 1);
        });

        it('should handle multi-line tags correctly', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select
        id="selectByAge"
        resultType="com.example.model.User"
        parameterType="int">
        SELECT * FROM users WHERE age = #{age}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractXmlStatements('/fake/path/UserMapper.xml');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'selectByAge');
            // The id attribute is on line 3 (0-indexed)
            // Column should point to start of id value
            assert.ok(result[0].startColumn >= 0);
            assert.ok(result[0].endColumn > result[0].startColumn);
        });
    });
});
