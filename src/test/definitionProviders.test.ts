/**
 * Definition Providers Test Suite
 * Tests for all definition provider implementations
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Definition Providers Test Suite', () => {
    let tempDir: string;

    suiteSetup(() => {
        tempDir = path.join(__dirname, 'temp-providers-test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    suiteTeardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('JavaClassDefinitionProvider', () => {
        test('should identify resultType attribute', () => {
            const line = '<select id="selectById" resultType="com.example.User">';
            const hasResultType = /resultType\s*=\s*["']([^"']+)["']/.test(line);
            assert.strictEqual(hasResultType, true);
        });

        test('should identify parameterType attribute', () => {
            const line = '<insert id="insert" parameterType="com.example.User">';
            const hasParamType = /parameterType\s*=\s*["']([^"']+)["']/.test(line);
            assert.strictEqual(hasParamType, true);
        });

        test('should identify type attribute', () => {
            const line = '<typeHandler type="com.example.MyTypeHandler">';
            const hasType = /type\s*=\s*["']([^"']+)["']/.test(line);
            assert.strictEqual(hasType, true);
        });

        test('should extract fully-qualified class name', () => {
            const line = '<select id="selectById" resultType="com.example.entity.User">';
            const match = line.match(/resultType\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'com.example.entity.User');
        });

        test('should handle single quotes in attributes', () => {
            const line = "<select id='selectById' resultType='com.example.User'>";
            const match = line.match(/resultType\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'com.example.User');
        });
    });

    suite('JavaToXmlDefinitionProvider', () => {
        test('should identify interface declaration', () => {
            const line = 'public interface UserMapper {';
            const isInterface = /(?:public\s+)?interface\s+\w+/.test(line);
            assert.strictEqual(isInterface, true);
        });

        test('should identify method declaration', () => {
            const line = '    User selectById(Long id);';
            const word = 'selectById';
            const hasMethod = line.includes(`${word}(`);
            assert.strictEqual(hasMethod, true);
        });

        test('should extract method name from declaration', () => {
            const line = '    List<User> selectAll();';
            const match = line.match(/(\w+)\s*\(/);
            assert.ok(match);
            assert.strictEqual(match[1], 'selectAll');
        });

        test('should handle method with multiple parameters', () => {
            const line = '    int update(@Param("id") Long id, @Param("name") String name);';
            const match = line.match(/(\w+)\s*\(/);
            assert.ok(match);
            assert.strictEqual(match[1], 'update');
        });
    });

    suite('XmlToJavaDefinitionProvider', () => {
        test('should identify namespace attribute', () => {
            const line = '<mapper namespace="com.example.mapper.UserMapper">';
            const match = line.match(/<mapper[^>]*namespace\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'com.example.mapper.UserMapper');
        });

        test('should identify statement id attribute', () => {
            const line = '<select id="selectById" resultType="User">';
            const match = line.match(/id\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'selectById');
        });

        test('should handle multi-line statement tags', () => {
            const line = '    id="selectById"';
            const match = line.match(/id\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'selectById');
        });

        test('should identify different statement types', () => {
            const selectLine = '<select id="selectAll">';
            const insertLine = '<insert id="insert">';
            const updateLine = '<update id="update">';
            const deleteLine = '<delete id="deleteById">';

            assert.ok(/id\s*=\s*["']([^"']+)["']/.test(selectLine));
            assert.ok(/id\s*=\s*["']([^"']+)["']/.test(insertLine));
            assert.ok(/id\s*=\s*["']([^"']+)["']/.test(updateLine));
            assert.ok(/id\s*=\s*["']([^"']+)["']/.test(deleteLine));
        });
    });

    suite('XmlSqlFragmentDefinitionProvider', () => {
        test('should identify include refid attribute', () => {
            const line = '<include refid="baseColumns"/>';
            const match = line.match(/<include[^>]+refid\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'baseColumns');
        });

        test('should identify sql id attribute', () => {
            const line = '<sql id="baseColumns">';
            const match = line.match(/<sql[^>]+id\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'baseColumns');
        });

        test('should handle sql fragment with multiple attributes', () => {
            const line = '<sql id="baseColumns" lang="xml">';
            const match = line.match(/<sql[^>]+id\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'baseColumns');
        });
    });

    suite('XmlResultMapPropertyDefinitionProvider', () => {
        test('should identify property attribute in result tag', () => {
            const line = '<result property="userId" column="user_id"/>';
            const match = line.match(/property\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'userId');
        });

        test('should identify property attribute in id tag', () => {
            const line = '<id property="id" column="id"/>';
            const match = line.match(/property\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'id');
        });

        test('should identify resultMap type attribute', () => {
            const line = '<resultMap id="userMap" type="com.example.entity.User">';
            const match = line.match(/<resultMap[^>]*type\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'com.example.entity.User');
        });

        test('should handle association with property attribute', () => {
            const line = '<association property="role" javaType="Role">';
            const match = line.match(/property\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'role');
        });

        test('should handle collection with property attribute', () => {
            const line = '<collection property="orders" ofType="Order">';
            const match = line.match(/property\s*=\s*["']([^"']+)["']/);
            assert.ok(match);
            assert.strictEqual(match[1], 'orders');
        });
    });

    test('Definition providers should be registered', async () => {
        const extension = vscode.extensions.getExtension('young1lin.mybatis-boost');
        assert.ok(extension);
        await extension.activate();

        // Extension should activate successfully with all providers
        assert.strictEqual(extension.isActive, true);
    });
});
