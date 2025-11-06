/**
 * Unit tests for parameterParser - extractLocalVariables
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { extractLocalVariables, extractAttributeReferences } from '../../navigator/parsers/parameterParser';
import * as fileUtils from '../../utils/fileUtils';

describe('parameterParser - extractLocalVariables Unit Tests', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractLocalVariables', () => {
        it('should extract item variable from foreach tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">
    <select id="listAllByIds" resultType="User">
        SELECT * FROM user WHERE id IN
        <foreach collection="ids" item="id" separator="," open="(" close=")">
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'listAllByIds',
                type: 'select',
                line: 4
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('id'), true);
        });

        it('should extract both item and index variables from foreach tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="listAllByIds" resultType="User">
        SELECT * FROM user WHERE id IN
        <foreach collection="ids" item="id" index="idx" separator="," open="(" close=")">
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'listAllByIds',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 2);
            assert.strictEqual(result.has('id'), true);
            assert.strictEqual(result.has('idx'), true);
        });

        it('should extract variable from bind tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="findByName" resultType="User">
        <bind name="pattern" value="'%' + name + '%'" />
        SELECT * FROM user WHERE name LIKE #{pattern}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'findByName',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('pattern'), true);
        });

        it('should extract multiple local variables from different tags', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="complexQuery" resultType="User">
        <bind name="pattern" value="'%' + name + '%'" />
        SELECT * FROM user
        WHERE name LIKE #{pattern}
        AND id IN
        <foreach collection="ids" item="id" index="idx" separator="," open="(" close=")">
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'complexQuery',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 3);
            assert.strictEqual(result.has('pattern'), true);
            assert.strictEqual(result.has('id'), true);
            assert.strictEqual(result.has('idx'), true);
        });

        it('should return empty set when no local variables exist', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="findById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'findById',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 0);
        });

        it('should handle nested foreach tags', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="complexQuery" resultType="User">
        SELECT * FROM user WHERE
        <foreach collection="filters" item="filter" index="filterIdx" separator="OR">
            (
            <foreach collection="filter.values" item="value" separator="," open="id IN (" close=")">
                #{value}
            </foreach>
            )
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'complexQuery',
                type: 'select',
                line: 2
            } as any);

            // Should extract: filter, filterIdx, value
            assert.strictEqual(result.size, 3);
            assert.strictEqual(result.has('filter'), true);
            assert.strictEqual(result.has('filterIdx'), true);
            assert.strictEqual(result.has('value'), true);
        });

        it('should handle foreach with single quotes', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="listAllByIds" resultType="User">
        SELECT * FROM user WHERE id IN
        <foreach collection='ids' item='id' separator=',' open='(' close=')'>
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractLocalVariables('/fake/path/UserMapper.xml', {
                id: 'listAllByIds',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('id'), true);
        });
    });

    describe('extractAttributeReferences', () => {
        it('should extract collection attribute from foreach tag', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="listAllByIds" resultType="User">
        SELECT * FROM user WHERE id IN
        <foreach collection="ids" item="id" separator="," open="(" close=")">
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'listAllByIds',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('ids'), true);
        });

        it('should handle property paths in collection attribute', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="complexQuery" resultType="User">
        SELECT * FROM user WHERE
        <foreach collection="filter.values" item="value" separator=",">
            #{value}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'complexQuery',
                type: 'select',
                line: 2
            } as any);

            // Should extract only root property 'filter'
            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('filter'), true);
        });

        it('should extract multiple collection attributes from nested foreach', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="complexQuery" resultType="User">
        SELECT * FROM user WHERE
        <foreach collection="filters" item="filter">
            <foreach collection="filter.values" item="value">
                #{value}
            </foreach>
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'complexQuery',
                type: 'select',
                line: 2
            } as any);

            // Should extract: filters (from outer foreach) and filter (from inner foreach collection)
            assert.strictEqual(result.size, 2);
            assert.strictEqual(result.has('filters'), true);
            assert.strictEqual(result.has('filter'), true);
        });

        it('should return empty set when no foreach tags exist', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="findById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'findById',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 0);
        });

        it('should handle foreach with single quotes', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="listAllByIds" resultType="User">
        SELECT * FROM user WHERE id IN
        <foreach collection='ids' item='id'>
            #{id}
        </foreach>
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const result = await extractAttributeReferences('/fake/path/UserMapper.xml', {
                id: 'listAllByIds',
                type: 'select',
                line: 2
            } as any);

            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.has('ids'), true);
        });
    });
});
