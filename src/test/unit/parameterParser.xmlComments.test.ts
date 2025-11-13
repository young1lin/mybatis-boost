/**
 * Unit tests for parameterParser - XML comment handling
 * Verifies that parameters inside XML comments are not validated
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import {
    extractParameterReferences,
    extractLocalVariables,
    extractAttributeReferences
} from '../../navigator/parsers/parameterParser';
import * as fileUtils from '../../utils/fileUtils';

describe('parameterParser XML Comments Tests', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractParameterReferences with XML comments', () => {
        it('should skip parameters inside single-line XML comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" resultType="java.math.BigDecimal">
        SELECT * FROM users
        WHERE id = #{id}
        <!-- AND status = #{status} -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectById', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}, not #{status} which is inside comment
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });

        it('should skip parameters inside multi-line XML comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectAgeByUserId" resultType="java.math.BigDecimal">
        select
        sum(age)
        from user
        where
        id = #{id}
<!--        <if test="startDate != null ">-->
<!--            <![CDATA[AND close_time >= #{startDate}]]>-->
<!--        </if>-->
<!--        <if test="endTime!= null ">-->
<!--            <![CDATA[AND close_time <= #{endTime}]]>-->
<!--        </if>-->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectAgeByUserId', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}, not #{startDate} or #{endTime} which are inside comments
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });

        it('should skip parameters in multi-line comment block', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <update id="updateUser">
        UPDATE users
        SET name = #{name}
        <!--
        This is a multi-line comment block
        age = #{age},
        email = #{email},
        status = #{status}
        -->
        WHERE id = #{id}
    </update>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'updateUser', type: 'update' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{name} and #{id}, not parameters inside the comment block
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[1].name, 'id');
        });

        it('should handle mixed commented and uncommented lines', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectUser">
        SELECT * FROM users
        WHERE 1=1
        AND active = #{active}
        <!-- AND deleted = #{deleted} -->
        AND status = #{status}
        <!--
        AND role = #{role}
        AND department = #{department}
        -->
        AND id = #{id}
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectUser', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should find #{active}, #{status}, #{id}
            // Should NOT find #{deleted}, #{role}, #{department}
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'active');
            assert.strictEqual(result[1].name, 'status');
            assert.strictEqual(result[2].name, 'id');
        });

        it('should handle substitution parameters in comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectFromTable">
        SELECT * FROM users
        WHERE id = #{id}
        <!-- ORDER BY \${sortColumn} -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectFromTable', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}, not ${sortColumn} which is inside comment
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].type, 'prepared');
        });

        it('should handle CDATA sections inside comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectWithCdata">
        SELECT * FROM users
        WHERE id = #{id}
        <!--
        <![CDATA[
            AND created_at >= #{startDate}
            AND created_at <= #{endDate}
        ]]>
        -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectWithCdata', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}, not #{startDate} or #{endDate} inside commented CDATA
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });
    });

    describe('extractLocalVariables with XML comments', () => {
        it('should skip local variables inside XML comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectUsers">
        SELECT * FROM users
        <foreach collection="ids" item="id" index="index">
            #{id}
        </foreach>
        <!--
        <foreach collection="names" item="name" index="idx">
            #{name}
        </foreach>
        -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectUsers', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractLocalVariables('/fake/path.xml', statement);

            // Should find 'id' and 'index', not 'name' or 'idx' which are in comments
            assert.ok(result.has('id'));
            assert.ok(result.has('index'));
            assert.ok(!result.has('name'));
            assert.ok(!result.has('idx'));
        });

        it('should skip bind variables inside XML comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByPattern">
        <bind name="pattern" value="'%' + name + '%'" />
        SELECT * FROM users WHERE name LIKE #{pattern}
        <!--
        <bind name="emailPattern" value="'%' + email + '%'" />
        AND email LIKE #{emailPattern}
        -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByPattern', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractLocalVariables('/fake/path.xml', statement);

            // Should find 'pattern', not 'emailPattern' which is in comment
            assert.ok(result.has('pattern'));
            assert.ok(!result.has('emailPattern'));
        });
    });

    describe('extractAttributeReferences with XML comments', () => {
        it('should skip attribute references inside XML comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByIds">
        SELECT * FROM users WHERE id IN
        <foreach collection="userIds" item="id" separator=",">
            #{id}
        </foreach>
        <!--
        <foreach collection="roleIds" item="roleId" separator=",">
            #{roleId}
        </foreach>
        -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByIds', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractAttributeReferences('/fake/path.xml', statement);

            // Should find 'userIds', not 'roleIds' which is in comment
            assert.ok(result.has('userIds'));
            assert.ok(!result.has('roleIds'));
        });

        it('should skip nested property references in comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectByFilter">
        SELECT * FROM users WHERE id IN
        <foreach collection="filter.ids" item="id" separator=",">
            #{id}
        </foreach>
        <!--
        <foreach collection="filter.names" item="name" separator=",">
            #{name}
        </foreach>
        -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectByFilter', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractAttributeReferences('/fake/path.xml', statement);

            // Should find 'filter' (from filter.ids), not from filter.names which is in comment
            assert.strictEqual(result.size, 1);
            assert.ok(result.has('filter'));
        });
    });

    describe('edge cases', () => {
        it('should handle comments with nested comment-like syntax', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectUser">
        SELECT * FROM users
        WHERE id = #{id}
        <!-- This comment mentions <!-- nested --> but it's still a comment: #{commentedParam} -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectUser', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });

        it('should handle empty comments', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectUser">
        SELECT * FROM users
        <!---->
        WHERE id = #{id}
        <!--  -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectUser', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should find #{id}
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });

        it('should handle comments at the beginning and end of statement', async () => {
            const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectUser">
        <!-- Start comment: #{startParam} -->
        SELECT * FROM users
        WHERE id = #{id}
        <!-- End comment: #{endParam} -->
    </select>
</mapper>`;
            readFileStub.resolves(mockContent);

            const statement = { id: 'selectUser', type: 'select' as const, line: 2, startColumn: 0, endColumn: 0 };
            const result = await extractParameterReferences('/fake/path.xml', statement);

            // Should only find #{id}
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
        });
    });
});
