/**
 * Unit tests for multi-line foreach tags
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { extractLocalVariables, extractAttributeReferences } from '../../navigator/parsers/parameterParser';
import * as fileUtils from '../../utils/fileUtils';

describe('parameterParser - Multi-line Tag Handling', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractLocalVariables - multi-line tags', () => {
        it('should extract item from multi-line foreach tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsert">
        INSERT INTO user VALUES
        <foreach collection="users" item="user"
            separator=",">
            (#{user.name}, #{user.age})
        </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('user'), true);
        });

        it('should handle foreach tag split across 3 lines', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsert">
        INSERT INTO user VALUES
        <foreach collection="users"
            item="user"
            separator=",">
            (#{user.name})
        </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('user'), true);
        });

        it('should handle foreach with index on separate line', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="query">
        SELECT * FROM user WHERE id IN
        <foreach collection="ids" item="id"
            index="idx"
            separator=",">
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'query',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 2);
            assert.strictEqual(result.has('id'), true);
            assert.strictEqual(result.has('idx'), true);
        });
    });

    describe('extractAttributeReferences - multi-line tags', () => {
        it('should extract collection from multi-line foreach tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsert">
        INSERT INTO user VALUES
        <foreach collection="users" item="user"
            separator=",">
            (#{user.name})
        </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('users'), true);
        });

        it('should handle collection attribute on separate line', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsert">
        INSERT INTO user VALUES
        <foreach
            collection="users"
            item="user"
            separator=",">
            (#{user.name})
        </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('users'), true);
        });

        it('should handle prefixed collection on separate line', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsertV3">
        INSERT INTO user VALUES
        <foreach collection="aUsers"
            item="user"
            separator=",">
            (#{user.name})
        </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsertV3',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('aUsers'), true);
        });
    });

    describe('Real-world scenarios from user', () => {
        it('should handle batchInsert scenario (no parameterType, no @Param)', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsert" keyProperty="id" useGeneratedKeys="true"
        parameterType="com.young1lin.mybatis.boost.integration.test.domain.User"> INSERT INTO \`user\`
        (<include refid="BaseInsertColumns" />) VALUES <foreach collection="users" item="user"
            separator=","> (#{user.name}, #{user.age}, #{user.createTime}, #{user.updateTime}, 0) </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const localVars = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            const attrRefs = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsert',
                type: 'insert',
                line: 2
            } as any);

            // Should extract: user (item), users (collection)
            assert.strictEqual(localVars.has('user'), true, 'Should extract "user" from item attribute');
            assert.strictEqual(attrRefs.has('users'), true, 'Should extract "users" from collection attribute');
        });

        it('should handle batchInsertV2 scenario (no parameterType, with @Param)', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsertV2" keyProperty="id" useGeneratedKeys="true"> INSERT INTO \`user\` (<include
            refid="BaseInsertColumns" />) VALUES <foreach collection="users" item="user"
            separator=","> (#{user.name}, #{user.age}, #{user.createTime}, #{user.updateTime}, 0) </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const localVars = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'batchInsertV2',
                type: 'insert',
                line: 2
            } as any);

            const attrRefs = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsertV2',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(localVars.has('user'), true);
            assert.strictEqual(attrRefs.has('users'), true);
        });

        it('should handle batchInsertV3 scenario (custom collection name)', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <insert id="batchInsertV3" keyProperty="id" useGeneratedKeys="true"> INSERT INTO \`user\` (<include
            refid="BaseInsertColumns" />) VALUES <foreach collection="aUsers" item="user"
            separator=","> (#{user.name}, #{user.age}, #{user.createTime}, #{user.updateTime}, 0) </foreach>
    </insert>
</mapper>`;
            readFileStub.resolves(mockContent);

            const localVars = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'batchInsertV3',
                type: 'insert',
                line: 2
            } as any);

            const attrRefs = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'batchInsertV3',
                type: 'insert',
                line: 2
            } as any);

            assert.strictEqual(localVars.has('user'), true);
            assert.strictEqual(attrRefs.has('aUsers'), true, 'Should extract "aUsers" from collection attribute');
        });
    });
});
