/**
 * Unit tests for javaTreeSitterParser
 * Tests the tree-sitter AST-based parser directly, covering edge cases
 * that regex parsing cannot handle correctly.
 */

import * as assert from 'assert';
import {
    initTreeSitter,
    extractMethodsFromAST,
    extractParametersFromAST,
    extractFieldsFromAST,
    extractNamespaceFromAST,
    extractSuperclassNameFromAST,
    isMyBatisMapperFromAST,
} from '../../navigator/parsers/javaTreeSitterParser';

describe('javaTreeSitterParser', () => {
    before(async function () {
        this.timeout(15000);
        const ok = await initTreeSitter();
        if (!ok) {
            this.skip();
        }
    });

    describe('extractNamespaceFromAST', () => {
        it('should extract namespace from valid mapper interface', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;
            const result = await extractNamespaceFromAST(content);
            assert.strictEqual(result, 'com.example.mapper.UserMapper');
        });

        it('should return null for non-interface files', async () => {
            const content = `
package com.example.service;

public class UserService {
    public void doSomething() {}
}
`;
            const result = await extractNamespaceFromAST(content);
            assert.strictEqual(result, null);
        });

        it('should return null when package is missing', async () => {
            const content = `
public interface UserMapper {
    User selectById(Long id);
}
`;
            const result = await extractNamespaceFromAST(content);
            assert.strictEqual(result, null);
        });
    });

    describe('isMyBatisMapperFromAST', () => {
        it('should return true for interface with @Mapper annotation', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;
            assert.strictEqual(await isMyBatisMapperFromAST(content), true);
        });

        it('should return true for interface with MyBatis imports', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.session.SqlSession;

public interface UserMapper {
    User selectById(Long id);
}
`;
            assert.strictEqual(await isMyBatisMapperFromAST(content), true);
        });

        it('should return true for interface with @Select annotation', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Select;

public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(Long id);
}
`;
            assert.strictEqual(await isMyBatisMapperFromAST(content), true);
        });

        it('should return false for regular interface without MyBatis indicators', async () => {
            const content = `
package com.example.service;

public interface UserService {
    User getUser(Long id);
}
`;
            assert.strictEqual(await isMyBatisMapperFromAST(content), false);
        });

        it('should return false for non-interface files', async () => {
            const content = `
package com.example.model;

public class User {
    private Long id;
    private String name;
}
`;
            assert.strictEqual(await isMyBatisMapperFromAST(content), false);
        });
    });

    describe('extractMethodsFromAST', () => {
        it('should extract all method declarations from interface', async () => {
            const content = `
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
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'selectById');
            assert.strictEqual(result[1].name, 'selectAll');
            assert.strictEqual(result[2].name, 'insert');
            assert.strictEqual(result[3].name, 'delete');
        });

        it('should handle methods with annotations', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User selectById(@Param("id") Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectById');
        });

        it('should handle generic return types', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    List<User> findByAge(int age);
    Map<String, Object> getUserMap(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'findByAge');
            assert.strictEqual(result[1].name, 'getUserMap');
        });

        it('should return empty array for non-interface files', async () => {
            const content = `
package com.example.model;

public class User {
    private Long id;
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 0);
        });

        it('should track column range for each method', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
    List<User> selectAll();
    int insert(User user);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 3);

            result.forEach(method => {
                assert.ok(method.startColumn >= 0, `Method ${method.name} should have startColumn >= 0`);
                assert.ok(method.endColumn > method.startColumn, `Method ${method.name} endColumn should be > startColumn`);
                assert.strictEqual(method.endColumn - method.startColumn, method.name.length, `Column range should equal method name length`);
            });
        });

        // ======== Edge cases that regex parsing cannot handle ========

        it('should handle nested generic return types like List<Map<String, Object>>', async () => {
            const content = `
package com.example.mapper;

public interface OrderMapper {
    List<Map<String, Object>> selectOrderStats(Long id);
    Map<String, List<Integer>> getGroupedData();
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'selectOrderStats');
            assert.strictEqual(result[1].name, 'getGroupedData');
        });

        it('should handle deeply nested generics', async () => {
            const content = `
package com.example.mapper;

public interface StatsMapper {
    Map<String, Map<String, List<Integer>>> getDeeplyNested(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'getDeeplyNested');
        });

        it('should handle same-line annotations before method (edge case #3)', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    @Nullable User findById(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'findById');
        });

        it('should handle @Nullable on return type with no-arg method (real-world case)', async () => {
            const content = `
package com.example.mapper;

import jakarta.annotation.Nullable;

@Mapper
public interface UserMapper {
    int batchInsert(List<User> users);

    @Nullable Integer selectCount();
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'batchInsert');
            assert.strictEqual(result[1].name, 'selectCount');
            // Verify column position points to method name, not annotation
            const lines = content.split('\n');
            const line = lines[result[1].line];
            const extracted = line.substring(result[1].startColumn, result[1].endColumn);
            assert.strictEqual(extracted, 'selectCount');
        });

        it('should handle @SelectProvider annotation with parens (edge case #4)', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.SelectProvider;

public interface UserMapper {
    @SelectProvider(type = UserSqlProvider.class, method = "selectById")
    User selectById(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectById');
        });

        it('should handle Javadoc with parentheses before method (edge case #2)', async () => {
            const content = `
package com.example.mapper;

public interface StatsMapper {
    /**
     * Get daily stats (chart data) for the dashboard (admin only)
     * @param id the user ID (required)
     */
    List<DailyStat> selectDailyStats(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectDailyStats');
        });

        it('should not be confused by string literals containing braces (edge case #5)', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Select;

public interface UserMapper {
    @Select("SELECT * FROM users WHERE name = #{name}")
    User selectByName(String name);

    @Select("SELECT * FROM users WHERE id = #{id} AND status = #{status}")
    User selectByIdAndStatus(Long id, String status);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'selectByName');
            assert.strictEqual(result[1].name, 'selectByIdAndStatus');
        });

        it('should correctly find method name position (no indexOf substring match, edge case #6)', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    UserInfo selectUserInfoById(Long id);
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectUserInfoById');
            // Tree-sitter gives exact position; verify it points to method name not type
            const lines = content.split('\n');
            const line = lines[result[0].line];
            const extracted = line.substring(result[0].startColumn, result[0].endColumn);
            assert.strictEqual(extracted, 'selectUserInfoById');
        });

        it('should return empty array for interface with no methods', async () => {
            const content = `
package com.example.mapper;

public interface Empty {
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 0);
        });

        it('should handle default method', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);

    default User selectDefault() {
        return null;
    }
}
`;
            const result = await extractMethodsFromAST(content);
            // default methods are valid interface methods - should be included
            assert.ok(result.some(m => m.name === 'selectById'));
        });

        it('should handle void return type', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    void deleteAll();
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'deleteAll');
        });

        it('should handle wildcard generic return type List<? extends User>', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    List<? extends User> selectAll();
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'selectAll');
        });

        it('should handle super wildcard Map<String, ? super Number>', async () => {
            const content = `
package com.example.mapper;

public interface DataMapper {
    Map<String, ? super Number> getData();
}
`;
            const result = await extractMethodsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'getData');
        });
    });

    describe('extractParametersFromAST', () => {
        it('should extract parameters with @Param annotation', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    User selectByAge(@Param("age") Integer age);
}
`;
            const result = await extractParametersFromAST(content, 'selectByAge');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'age');
            assert.strictEqual(result[0].paramType, 'Integer');
            assert.strictEqual(result[0].hasParamAnnotation, true);
        });

        it('should extract multiple parameters with @Param annotations', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    List<User> selectByAgeRange(@Param("minAge") Integer minAge, @Param("maxAge") Integer maxAge);
}
`;
            const result = await extractParametersFromAST(content, 'selectByAgeRange');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'minAge');
            assert.strictEqual(result[0].paramType, 'Integer');
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'maxAge');
            assert.strictEqual(result[1].paramType, 'Integer');
            assert.strictEqual(result[1].hasParamAnnotation, true);
        });

        it('should extract parameters without @Param annotation', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            const result = await extractParametersFromAST(content, 'selectById');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].paramType, 'Long');
            assert.strictEqual(result[0].hasParamAnnotation, false);
        });

        it('should handle mixed parameters (with and without @Param)', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    User selectByIdAndAge(@Param("userId") Long id, Integer age);
}
`;
            const result = await extractParametersFromAST(content, 'selectByIdAndAge');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'userId');
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'age');
            assert.strictEqual(result[1].hasParamAnnotation, false);
        });

        it('should handle generic type parameters', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    int insertBatch(List<User> users);
}
`;
            const result = await extractParametersFromAST(content, 'insertBatch');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'users');
            assert.strictEqual(result[0].paramType, 'List');
        });

        it('should return empty array for methods with no parameters', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    List<User> selectAll();
}
`;
            const result = await extractParametersFromAST(content, 'selectAll');
            assert.strictEqual(result.length, 0);
        });

        it('should handle multi-line method declarations', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    User selectByMultipleParams(
        @Param("id") Long id,
        @Param("name") String name,
        @Param("age") Integer age
    );
}
`;
            const result = await extractParametersFromAST(content, 'selectByMultipleParams');
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[2].name, 'age');
        });

        it('should return empty array for non-existent method', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            const result = await extractParametersFromAST(content, 'nonExistentMethod');
            assert.strictEqual(result.length, 0);
        });

        it('should handle parameters with @Nonnull and @Param annotations', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;
import javax.annotation.Nonnull;

public interface RoleMapper {
    int deleteById(
        @Nonnull @Param("id") Long id,
        @Nonnull @Param("version") Integer version);
}
`;
            const result = await extractParametersFromAST(content, 'deleteById');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].paramType, 'Long');
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'version');
            assert.strictEqual(result[1].paramType, 'Integer');
            assert.strictEqual(result[1].hasParamAnnotation, true);
        });

        it('should handle Javadoc with parentheses before method (edge case #2)', async () => {
            const content = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface DailyStatMapper {
    /**
     * Get daily stats (chart data)
     */
    List<DailyStat> selectDailyStats(@Param("startDate") String startDate, @Param("endDate") String endDate);
}
`;
            const result = await extractParametersFromAST(content, 'selectDailyStats');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'startDate');
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'endDate');
            assert.strictEqual(result[1].hasParamAnnotation, true);
        });

        it('should handle nested generic parameter types', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    int insertBatch(List<Map<String, Object>> records);
}
`;
            const result = await extractParametersFromAST(content, 'insertBatch');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'records');
            assert.strictEqual(result[0].paramType, 'List');
        });

        it('should handle varargs parameter Integer...', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    void delete(Integer... ids);
}
`;
            const result = await extractParametersFromAST(content, 'delete');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'ids');
        });

        it('should handle array type parameter String[]', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    void insert(String[] names);
}
`;
            const result = await extractParametersFromAST(content, 'insert');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'names');
        });

        it('should handle wildcard generic parameter List<? extends User>', async () => {
            const content = `
package com.example.mapper;

public interface UserMapper {
    void process(List<? extends User> users);
}
`;
            const result = await extractParametersFromAST(content, 'process');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'users');
            assert.strictEqual(result[0].paramType, 'List');
        });
    });

    describe('extractFieldsFromAST', () => {
        it('should extract basic fields from a class', async () => {
            const content = `
package com.example.model;

public class User {
    private Long id;
    private String name;
    protected Integer age;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].fieldType, 'Long');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[1].fieldType, 'String');
            assert.strictEqual(result[2].name, 'age');
            assert.strictEqual(result[2].fieldType, 'Integer');
        });

        it('should extract fields with generic types', async () => {
            const content = `
package com.example.model;

public class User {
    private List<String> items;
    private Map<String, Object> metadata;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'items');
            assert.strictEqual(result[0].fieldType, 'List');
            assert.strictEqual(result[1].name, 'metadata');
            assert.strictEqual(result[1].fieldType, 'Map');
        });

        it('should extract fields with initializers', async () => {
            const content = `
package com.example.model;

public class Config {
    private int maxRetries = 3;
    private String defaultName = "test";
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'maxRetries');
            assert.strictEqual(result[1].name, 'defaultName');
        });

        it('should track correct column positions', async () => {
            const content = `
package com.example.model;

public class User {
    private Long id;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            const lines = content.split('\n');
            const line = lines[result[0].line];
            const extracted = line.substring(result[0].startColumn, result[0].endColumn);
            assert.strictEqual(extracted, 'id');
        });

        it('should handle nested generic types in fields', async () => {
            const content = `
package com.example.model;

public class Report {
    private Map<String, List<Integer>> groupedData;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'groupedData');
            assert.strictEqual(result[0].fieldType, 'Map');
        });

        it('should extract static field', async () => {
            const content = `
package com.example.model;

public class Config {
    private static String instance;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'instance');
            assert.strictEqual(result[0].fieldType, 'String');
        });

        it('should extract final field', async () => {
            const content = `
package com.example.model;

public class Config {
    private final Long id;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].fieldType, 'Long');
        });

        it('should extract static final field', async () => {
            const content = `
package com.example.model;

public class Config {
    private static final String VERSION = "1.0";
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'VERSION');
            assert.strictEqual(result[0].fieldType, 'String');
        });

        it('should extract array type field', async () => {
            const content = `
package com.example.model;

public class Data {
    private String[] names;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'names');
        });

        it('should extract nested array type field', async () => {
            const content = `
package com.example.model;

public class Data {
    private int[][] matrix;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'matrix');
        });

        it('should extract field with single annotation', async () => {
            const content = `
package com.example.model;

public class User {
    @Column
    private String name;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'name');
            assert.strictEqual(result[0].fieldType, 'String');
        });

        it('should extract field with multiple annotations', async () => {
            const content = `
package com.example.model;

public class User {
    @Id
    @Column
    private Long id;
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].fieldType, 'Long');
        });

        it('should return empty array for class with no fields', async () => {
            const content = `
package com.example.model;

public class Empty {
}
`;
            const result = await extractFieldsFromAST(content);
            assert.strictEqual(result.length, 0);
        });

        it('should only return the named class\'s fields when className is given', async () => {
            const content = `
package com.example.model;

class Helper {
    private String helperField;
}

public class Role {
    private String roleName;
}
`;
            const roleFields = await extractFieldsFromAST(content, 'Role');
            assert.deepStrictEqual(roleFields.map(f => f.name), ['roleName']);

            const helperFields = await extractFieldsFromAST(content, 'Helper');
            assert.deepStrictEqual(helperFields.map(f => f.name), ['helperField']);
        });

        it('should exclude nested class fields when className targets the outer class', async () => {
            const content = `
package com.example.model;

public class Role {
    private String roleName;

    public static class Builder {
        private String pendingName;
    }
}
`;
            const result = await extractFieldsFromAST(content, 'Role');
            assert.deepStrictEqual(result.map(f => f.name), ['roleName']);
        });

        it('should return empty array when the named class does not exist', async () => {
            const content = `
package com.example.model;

public class Role {
    private String roleName;
}
`;
            const result = await extractFieldsFromAST(content, 'Missing');
            assert.strictEqual(result.length, 0);
        });
    });

    describe('extractSuperclassNameFromAST', () => {
        it('should extract simple superclass name', async () => {
            const content = `
package com.example.model;

public class Role extends BaseEntity {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should strip generic type arguments from superclass', async () => {
            const content = `
package com.example.model;

public class Role extends BaseEntity<Long> {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should extract fully-qualified superclass name', async () => {
            const content = `
package com.example.model;

public class Role extends com.example.entity.BaseEntity {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'com.example.entity.BaseEntity');
        });

        it('should extract superclass when class also implements interfaces', async () => {
            const content = `
package com.example.model;

public class Role extends BaseEntity implements Serializable, Cloneable {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should handle bounded type parameters on the class itself', async () => {
            const content = `
package com.example.model;

public class Holder<T extends Number> extends BaseHolder {
    private T value;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'BaseHolder');
        });

        it('should return null when class has no extends clause', async () => {
            const content = `
package com.example.model;

public class Role implements Serializable {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, null);
        });

        it('should return null for interface-only files', async () => {
            const content = `
package com.example.mapper;

public interface RoleMapper extends BaseMapper {
    Role selectById(Long id);
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, null);
        });

        it('should handle multi-line class declarations', async () => {
            const content = `
package com.example.model;

public class Role
        extends BaseEntity<Long>
        implements Serializable {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content);
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should only inspect the named class when className is given', async () => {
            const content = `
package com.example.model;

class Helper extends HelperBase {
    private String helperField;
}

public class Role extends RoleBase {
    private String roleName;
}
`;
            assert.strictEqual(await extractSuperclassNameFromAST(content, 'Role'), 'RoleBase');
            assert.strictEqual(await extractSuperclassNameFromAST(content, 'Helper'), 'HelperBase');
        });

        it('should return null when the named class extends nothing even if another class does', async () => {
            const content = `
package com.example.model;

public class Role {
    private String roleName;

    public static class Builder extends AbstractBuilder {
        private String pending;
    }
}
`;
            const result = await extractSuperclassNameFromAST(content, 'Role');
            assert.strictEqual(result, null);
        });

        it('should return null when the named class does not exist in the file', async () => {
            const content = `
package com.example.model;

public class Role extends BaseEntity {
    private String roleName;
}
`;
            const result = await extractSuperclassNameFromAST(content, 'Missing');
            assert.strictEqual(result, null);
        });
    });
});
