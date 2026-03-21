/**
 * Unit tests for javaParser
 * These tests use mocked file system and do not require VS Code API
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { extractJavaNamespace, isMyBatisMapper, extractJavaMethods, extractJavaMethodsFromContent, findJavaMethodLine, findJavaMethodPosition } from '../../navigator/parsers/javaParser';
import * as fileUtils from '../../utils/fileUtils';
import * as javaTreeSitterParser from '../../navigator/parsers/javaTreeSitterParser';

describe('javaParser Unit Tests', () => {
    let readFirstLinesStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFirstLinesStub = sinon.stub(fileUtils, 'readFirstLines');
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractJavaNamespace', () => {
        it('should extract namespace from valid mapper interface', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractJavaNamespace('/fake/path/UserMapper.java');
            assert.strictEqual(result, 'com.example.mapper.UserMapper');
            assert.ok(readFirstLinesStub.calledWith('/fake/path/UserMapper.java', 100));
        });

        it('should return null for non-interface files', async () => {
            const mockContent = `
package com.example.service;

public class UserService {
    public void doSomething() {}
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractJavaNamespace('/fake/path/UserService.java');
            assert.strictEqual(result, null);
        });

        it('should return null when package is missing', async () => {
            const mockContent = `
public interface UserMapper {
    User selectById(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await extractJavaNamespace('/fake/path/UserMapper.java');
            assert.strictEqual(result, null);
        });
    });

    describe('isMyBatisMapper', () => {
        it('should return true for interface with @Mapper annotation', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await isMyBatisMapper('/fake/path/UserMapper.java');
            assert.strictEqual(result, true);
        });

        it('should return true for interface with MyBatis imports', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.session.SqlSession;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await isMyBatisMapper('/fake/path/UserMapper.java');
            assert.strictEqual(result, true);
        });

        it('should return true for interface with @Select annotation', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Select;

public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await isMyBatisMapper('/fake/path/UserMapper.java');
            assert.strictEqual(result, true);
        });

        it('should return false for regular interface without MyBatis indicators', async () => {
            const mockContent = `
package com.example.service;

public interface UserService {
    User getUser(Long id);
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await isMyBatisMapper('/fake/path/UserService.java');
            assert.strictEqual(result, false);
        });

        it('should return false for non-interface files', async () => {
            const mockContent = `
package com.example.model;

public class User {
    private Long id;
    private String name;
}
`;
            readFirstLinesStub.resolves(mockContent);

            const result = await isMyBatisMapper('/fake/path/User.java');
            assert.strictEqual(result, false);
        });
    });

    describe('extractJavaMethods', () => {
        it('should extract all method declarations from interface', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);

    List<User> selectAll();

    int insert(User user);

    void delete(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectAll');
            assert.strictEqual(result[2].name, 'insert');
            assert.strictEqual(result[3].name, 'delete');
        });

        it('should handle methods with annotations', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(@Param("id") Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectById');
        });

        it('should handle generic return types', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    List<User> findByAge(int age);
    Map<String, Object> getUserMap(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'findByAge');
            assert.strictEqual(result[1].name, 'getUserMap');
        });

        it('should return empty array for non-interface files', async () => {
            const mockContent = `
package com.example.model;

public class User {
    private Long id;
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/User.java');
            assert.strictEqual(result.length, 0);
        });
    });

    describe('findJavaMethodLine', () => {
        it('should find correct line number for method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    List<User> selectAll();
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodLine('/fake/path/UserMapper.java', 'selectAll');
            // Line 6 (0-indexed) - template literal starts with newline
            assert.strictEqual(result, 6);
        });

        it('should return null for non-existent method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodLine('/fake/path/UserMapper.java', 'nonExistentMethod');
            assert.strictEqual(result, null);
        });
    });

    describe('findJavaMethodPosition', () => {
        it('should find correct position (line and column range) for method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    TestVO selectAllById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'selectAllById');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 6);
            // The method name "selectAllById" should have start and end columns
            assert.ok(result.startColumn > 0);
            assert.strictEqual(result.endColumn, result.startColumn + 'selectAllById'.length);
        });

        it('should find correct column range for indented method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'selectById');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 4);
            // Method name should be after "User " which has 4 spaces indent + "User "
            const line = mockContent.split('\n')[4];
            const expectedStartColumn = line.indexOf('selectById');
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'selectById'.length);
        });

        it('should return null for non-existent method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'nonExistentMethod');
            assert.strictEqual(result, null);
        });

        it('should handle methods with generic return types', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    List<User> findByAge(int age);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'findByAge');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 4);
            const line = mockContent.split('\n')[4];
            const expectedStartColumn = line.indexOf('findByAge');
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'findByAge'.length);
        });
    });

    describe('extractJavaMethods - nested generic return types', () => {
        it('should handle nested generic return types like List<Map<String, Object>>', async () => {
            const mockContent = `
package com.example.mapper;

public interface OrderMapper {
    List<Map<String, Object>> selectOrderStats(Long id);
    Map<String, List<Integer>> getGroupedData();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/OrderMapper.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'selectOrderStats');
            assert.strictEqual(result[1].name, 'getGroupedData');
        });

        it('should handle deeply nested generics', async () => {
            const mockContent = `
package com.example.mapper;

public interface StatsMapper {
    Map<String, Map<String, List<Integer>>> getDeeplyNested(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/StatsMapper.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'getDeeplyNested');
        });
    });

    describe('findJavaMethodPosition - nested generics', () => {
        it('should find correct position for method with nested generic return type', async () => {
            const mockContent = `
package com.example.mapper;

public interface OrderMapper {
    List<Map<String, Object>> selectOrderStats(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/OrderMapper.java', 'selectOrderStats');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 4);
            const line = mockContent.split('\n')[4];
            const expectedStartColumn = line.indexOf('selectOrderStats');
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'selectOrderStats'.length);
        });
    });

    describe('extractJavaMethods - column tracking', () => {
        it('should track column range for each method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
    List<User> selectAll();
    int insert(User user);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 3);

            // All methods should have start and end column positions
            result.forEach(method => {
                assert.ok(method.startColumn >= 0, `Method ${method.name} should have startColumn >= 0`);
                assert.ok(method.endColumn > method.startColumn, `Method ${method.name} endColumn should be > startColumn`);
                assert.strictEqual(method.endColumn - method.startColumn, method.name.length, `Column range should equal method name length`);
            });

            // Check specific column positions
            const lines = mockContent.split('\n');
            assert.strictEqual(result[0].startColumn, lines[4].indexOf('selectById'));
            assert.strictEqual(result[0].endColumn, lines[4].indexOf('selectById') + 'selectById'.length);
            assert.strictEqual(result[1].startColumn, lines[5].indexOf('selectAll'));
            assert.strictEqual(result[1].endColumn, lines[5].indexOf('selectAll') + 'selectAll'.length);
            assert.strictEqual(result[2].startColumn, lines[6].indexOf('insert'));
            assert.strictEqual(result[2].endColumn, lines[6].indexOf('insert') + 'insert'.length);
        });
    });

    describe('extractJavaMethods - annotation-prefixed methods (bug fix)', () => {
        it('should recognize method with @Nullable annotation on same line', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import jakarta.annotation.Nullable;

@Mapper
public interface UserMapper {
    User selectById(Long id);
    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 2, 'Should find 2 methods');
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectCount');
        });

        it('should recognize method with @Nonnull annotation on same line', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Nonnull User selectById(Long id);
    @Nonnull List<User> selectAll();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 2, 'Should find 2 methods');
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectAll');
        });

        it('should recognize method with multiple annotations on same line', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Deprecated @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1, 'Should find 1 method');
            assert.strictEqual(result[0].name, 'selectCount');
        });

        it('should still skip pure annotation lines like @Mapper', async () => {
            const mockContent = `
package com.example.mapper;

@Mapper
public interface UserMapper {
    @Override
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1, 'Should find 1 method (not @Override as method)');
            assert.strictEqual(result[0].name, 'selectById');
        });

        it('should skip @Select annotation lines (not treat as method)', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(Long id);
    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 2, 'Should find 2 methods');
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectCount');
        });

        it('should handle real-world UserMapper with @Nullable', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

import jakarta.annotation.Nullable;

@Mapper
public interface UserMapper {

    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(Long id);

    List<User> selectAll();

    List<User> selectByAge(@Param("age") Integer age);

    int insert(User user);

    int update(User user);

    void delete(Long id);

    @Nullable Integer count();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 7, 'Should find all 7 methods including @Nullable count()');
            const methodNames = result.map(m => m.name);
            assert.ok(methodNames.includes('selectById'), 'Should include selectById');
            assert.ok(methodNames.includes('selectAll'), 'Should include selectAll');
            assert.ok(methodNames.includes('selectByAge'), 'Should include selectByAge');
            assert.ok(methodNames.includes('insert'), 'Should include insert');
            assert.ok(methodNames.includes('update'), 'Should include update');
            assert.ok(methodNames.includes('delete'), 'Should include delete');
            assert.ok(methodNames.includes('count'), 'Should include count');
        });

        it('should track correct column position for annotation-prefixed method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectCount');

            // Column should point to "selectCount" in the original line, not to @Nullable
            const lines = mockContent.split('\n');
            const expectedStartCol = lines[result[0].line].indexOf('selectCount');
            assert.strictEqual(result[0].startColumn, expectedStartCol,
                'startColumn should point to method name, not annotation');
            assert.strictEqual(result[0].endColumn, expectedStartCol + 'selectCount'.length);
        });

        it('should handle @Nonnull on return type with @Param in parameters', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;
import jakarta.annotation.Nonnull;

public interface UserMapper {
    @Nonnull User selectByIdAndName(@Param("id") Long id, @Param("name") String name);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1, 'Should find 1 method');
            assert.strictEqual(result[0].name, 'selectByIdAndName');
        });

        it('should handle @SelectProvider annotation (should be skipped as pure annotation)', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @SelectProvider(type = UserSqlProvider.class, method = "selectById")
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1, 'Should find 1 method');
            assert.strictEqual(result[0].name, 'selectById');
        });

        it('should handle integration test UserMapper pattern', async () => {
            // This mirrors the real java-project/integration-test UserMapper.java
            const mockContent = `
package com.young1lin.mybatis.boost.integration.test.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.young1lin.mybatis.boost.integration.test.domain.User;

import jakarta.annotation.Nonnull;
import jakarta.annotation.Nullable;

@Mapper
public interface UserMapper {

    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(@Param("id") Long id);

    List<User> listAllByIds(@Param("ids") List<Long> ids);

    User selectByIdAndName(
            @Param("id") Long id,
            @Param("name") String name);

    int updateById(@Nonnull User user);

    int batchInsert(List<User> users);

    int batchInsertV2(@Param("users") List<User> users);

    int batchInsertV3(@Param("aUsers") List<User> users);

    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 8, 'Should find all 8 methods including @Nullable selectCount()');
            const methodNames = result.map(m => m.name);
            assert.ok(methodNames.includes('selectById'), 'Should include selectById');
            assert.ok(methodNames.includes('listAllByIds'), 'Should include listAllByIds');
            assert.ok(methodNames.includes('selectByIdAndName'), 'Should include selectByIdAndName');
            assert.ok(methodNames.includes('updateById'), 'Should include updateById');
            assert.ok(methodNames.includes('batchInsert'), 'Should include batchInsert');
            assert.ok(methodNames.includes('batchInsertV2'), 'Should include batchInsertV2');
            assert.ok(methodNames.includes('batchInsertV3'), 'Should include batchInsertV3');
            assert.ok(methodNames.includes('selectCount'), 'Should include selectCount');
        });
    });

    describe('extractJavaMethodsFromContent - direct content API', () => {
        it('should work with content string directly (for CodeLens/DefinitionProvider)', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
    @Nullable Integer selectCount();
}
`;
            const result = await extractJavaMethodsFromContent(content);
            assert.strictEqual(result.length, 2, 'Should find 2 methods from content string');
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectCount');
        });
    });

    describe('findJavaMethodLine - annotation-prefixed methods', () => {
        it('should find line number for @Nullable annotated method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodLine('/fake/path/UserMapper.java', 'selectCount');
            assert.ok(result !== null, 'Should find selectCount method');
            // The method is on the line containing "@Nullable Integer selectCount()"
            const lines = mockContent.split('\n');
            assert.ok(lines[result!].includes('selectCount'), 'Found line should contain selectCount');
        });
    });

    describe('findJavaMethodPosition - annotation-prefixed methods', () => {
        it('should find correct position for @Nullable annotated method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'selectCount');
            assert.ok(result !== null, 'Should find selectCount method');
            const lines = mockContent.split('\n');
            const line = lines[result!.line];
            assert.ok(line.includes('selectCount'), 'Found line should contain selectCount');
            // Column should point to method name
            assert.strictEqual(result!.startColumn, line.indexOf('selectCount'));
            assert.strictEqual(result!.endColumn, line.indexOf('selectCount') + 'selectCount'.length);
        });

        it('should find correct position for @Nonnull annotated method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Nonnull User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaMethodPosition('/fake/path/UserMapper.java', 'selectById');
            assert.ok(result !== null, 'Should find selectById method');
            const lines = mockContent.split('\n');
            const line = lines[result!.line];
            assert.ok(line.includes('selectById'), 'Found line should contain selectById');
            assert.strictEqual(result!.startColumn, line.indexOf('selectById'));
            assert.strictEqual(result!.endColumn, line.indexOf('selectById') + 'selectById'.length);
        });
    });

    describe('extractJavaMethodsRegex - edge cases (AST forced to throw)', () => {
        let extractMethodsFromASTStub: sinon.SinonStub;

        beforeEach(() => {
            extractMethodsFromASTStub = sinon.stub(javaTreeSitterParser, 'extractMethodsFromAST')
                .rejects(new Error('WASM not available'));
        });

        it('should return empty array for empty interface', async () => {
            const mockContent = `
package com.example.mapper;

public interface EmptyMapper {
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/EmptyMapper.java');
            assert.strictEqual(result.length, 0);
        });

        it('should extract void return type method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    void deleteAll();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'deleteAll');
        });

        it('should skip default methods with body (brace level > 1 — correct behavior: no XML mapping)', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    default User selectDefault() {
        return null;
    }
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            // Regex parser skips default methods with body - this is correct behavior
            // because default methods don't have corresponding XML statements
            assert.ok(result.some(m => m.name === 'selectById'));
            // default methods with body are skipped by regex (brace level > 1)
            assert.ok(!result.some(m => m.name === 'selectDefault'));
        });

        it('should handle method with annotation prefix on same line', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    @Nullable Integer selectCount();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaMethods('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectCount');
        });
    });
});
