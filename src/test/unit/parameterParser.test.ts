/**
 * Unit tests for parameterParser
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import {
    extractParameterReferences,
    extractStatementParameterInfo,
    getParameterAtPosition
} from '../../navigator/parsers/parameterParser';
import * as fileUtils from '../../utils/fileUtils';

describe('parameterParser Unit Tests', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractParameterReferences', () => {
        it('should extract prepared statement parameters #{param}', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" parameterType="Long">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].type, 'prepared');
            assert.strictEqual(result[0].line, 3);
        });

        it('should extract string substitution parameters ${param}', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByTable">
        SELECT * FROM \${tableName} WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByTable', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'tableName');
            assert.strictEqual(result[0].type, 'substitution');
            assert.strictEqual(result[1].name, 'id');
            assert.strictEqual(result[1].type, 'prepared');
        });

        it('should extract multiple parameters', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <update id="update" parameterType="User">
        UPDATE users
        SET name = #{name},
            age = #{age},
            email = #{email}
        WHERE id = #{id}
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'update', type: 'update' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[1].name, 'age');
            assert.strictEqual(result[2].name, 'email');
            assert.strictEqual(result[3].name, 'id');
        });

        it('should handle property paths by extracting root property', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByUser" parameterType="User">
        SELECT * FROM users WHERE id = #{user.id} AND name = #{user.name}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByUser', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'user');
            assert.strictEqual(result[1].name, 'user');
        });

        it('should extract parameters with jdbcType attribute', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <insert id="insert" parameterType="com.example.User">
        INSERT INTO users (id, name, email, age)
        VALUES (#{id,jdbcType=BIGINT}, #{name,jdbcType=VARCHAR}, #{email,jdbcType=VARCHAR}, #{age,jdbcType=INTEGER})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'insert', type: 'insert' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[2].name, 'email');
            assert.strictEqual(result[3].name, 'age');
        });

        it('should extract parameters with multiple MyBatis attributes', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <update id="update" parameterType="com.example.User">
        UPDATE users
        SET name = #{name,jdbcType=VARCHAR,javaType=string},
            data = #{data,jdbcType=BLOB,typeHandler=MyBlobHandler}
        WHERE id = #{id,jdbcType=BIGINT}
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'update', type: 'update' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[1].name, 'data');
            assert.strictEqual(result[2].name, 'id');
        });

        it('should extract parameters with nested properties and jdbcType', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <insert id="insert" parameterType="com.example.Order">
        INSERT INTO orders (user_id, product_id, amount)
        VALUES (#{user.id,jdbcType=BIGINT}, #{product.id,jdbcType=BIGINT}, #{amount,jdbcType=DECIMAL})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'insert', type: 'insert' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'user'); // Root property
            assert.strictEqual(result[1].name, 'product'); // Root property
            assert.strictEqual(result[2].name, 'amount');
        });

        it('should handle real-world complex insert with selectKey', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.AccountMapper">
    <insert id="insert" parameterType="com.zx.atrader.dal.po.AccountSymbolCfgPO">
        <selectKey keyProperty="id" order="AFTER" resultType="java.lang.Long">
            SELECT LAST_INSERT_ID()
        </selectKey>
        insert into t_bo_account_symbol_cfg (account_cfg_id, symbol_cfg_id, profit,
        gmt_create, gmt_modified, create_by,
        modify_by)
        values (#{accountCfgId,jdbcType=BIGINT}, #{symbolCfgId,jdbcType=BIGINT}, #{profit,jdbcType=DECIMAL},
        #{gmtCreate,jdbcType=TIMESTAMP}, #{gmtModified,jdbcType=TIMESTAMP}, #{createBy,jdbcType=VARCHAR},
        #{modifyBy,jdbcType=VARCHAR})
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'insert', type: 'insert' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 7);
            assert.strictEqual(result[0].name, 'accountCfgId');
            assert.strictEqual(result[1].name, 'symbolCfgId');
            assert.strictEqual(result[2].name, 'profit');
            assert.strictEqual(result[3].name, 'gmtCreate');
            assert.strictEqual(result[4].name, 'gmtModified');
            assert.strictEqual(result[5].name, 'createBy');
            assert.strictEqual(result[6].name, 'modifyBy');
        });
    });

    describe('extractStatementParameterInfo', () => {
        it('should extract parameterType attribute', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" parameterType="java.lang.Long">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractStatementParameterInfo('/fake/path.xml', statement);

            assert.strictEqual(result.parameterType, 'java.lang.Long');
            assert.strictEqual(result.parameterMap, undefined);
        });

        it('should extract parameterMap attribute', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" parameterMap="userParamMap">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractStatementParameterInfo('/fake/path.xml', statement);

            assert.strictEqual(result.parameterMap, 'userParamMap');
            assert.strictEqual(result.parameterType, undefined);
        });

        it('should handle multi-line statement tags', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById"
            parameterType="com.example.User"
            resultType="User">
        SELECT * FROM users WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractStatementParameterInfo('/fake/path.xml', statement);

            assert.strictEqual(result.parameterType, 'com.example.User');
        });
    });

    describe('getParameterAtPosition', () => {
        it('should detect cursor on prepared statement parameter', () => {
            const line = '        SELECT * FROM users WHERE id = #{id}';
            const result = getParameterAtPosition(line, 42); // Position within #{id}

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'id');
            assert.strictEqual(result.type, 'prepared');
        });

        it('should detect cursor on substitution parameter', () => {
            const line = '        SELECT * FROM ${tableName} WHERE id = #{id}';
            const result = getParameterAtPosition(line, 24); // Position within ${tableName}

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'tableName');
            assert.strictEqual(result.type, 'substitution');
        });

        it('should return null when cursor is not on parameter', () => {
            const line = '        SELECT * FROM users WHERE id = #{id}';
            const result = getParameterAtPosition(line, 10); // Position on 'SELECT'

            assert.strictEqual(result, null);
        });

        it('should handle property paths', () => {
            const line = '        WHERE id = #{user.id}';
            const result = getParameterAtPosition(line, 22); // Position within #{user.id}

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'user'); // Root property
        });

        it('should handle parameters with jdbcType attribute', () => {
            const line = '        VALUES (#{id,jdbcType=BIGINT}, #{name,jdbcType=VARCHAR})';
            const resultId = getParameterAtPosition(line, 18); // Position within #{id,jdbcType=BIGINT}
            const resultName = getParameterAtPosition(line, 44); // Position within #{name,jdbcType=VARCHAR}

            assert.ok(resultId !== null);
            assert.strictEqual(resultId.name, 'id');
            assert.strictEqual(resultId.type, 'prepared');

            assert.ok(resultName !== null);
            assert.strictEqual(resultName.name, 'name');
            assert.strictEqual(resultName.type, 'prepared');
        });

        it('should handle parameters with multiple MyBatis attributes', () => {
            const line = '        SET data = #{data,jdbcType=BLOB,typeHandler=MyBlobHandler}';
            const result = getParameterAtPosition(line, 25); // Position within the parameter

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'data');
            assert.strictEqual(result.type, 'prepared');
        });

        it('should handle nested properties with jdbcType', () => {
            const line = '        VALUES (#{user.id,jdbcType=BIGINT})';
            const result = getParameterAtPosition(line, 20); // Position within #{user.id,jdbcType=BIGINT}

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'user'); // Root property
            assert.strictEqual(result.type, 'prepared');
        });

        it('should handle substitution parameters with jdbcType', () => {
            const line = '        ORDER BY ${column,jdbcType=VARCHAR}';
            const result = getParameterAtPosition(line, 20); // Position within ${column,jdbcType=VARCHAR}

            assert.ok(result !== null);
            assert.strictEqual(result.name, 'column');
            assert.strictEqual(result.type, 'substitution');
        });
    });

    describe('extractParameterReferences - CDATA sections', () => {
        it('should extract parameters inside CDATA section', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" parameterType="Long">
        <![CDATA[ WHERE id = #{id} ]]>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].type, 'prepared');
        });

        it('should extract multiple parameters inside CDATA', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <update id="update" parameterType="User">
        <![CDATA[
            UPDATE users SET name = #{name}, age = #{age}
            WHERE id = #{id}
        ]]>
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'update', type: 'update' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[1].name, 'age');
            assert.strictEqual(result[2].name, 'id');
        });

        it('should extract params from both CDATA and non-CDATA in same statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByCondition" parameterType="User">
        SELECT * FROM users
        WHERE name = #{name}
        <![CDATA[ AND age > #{minAge} AND age < #{maxAge} ]]>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByCondition', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[1].name, 'minAge');
            assert.strictEqual(result[2].name, 'maxAge');
        });
    });
});
