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
    });
});
