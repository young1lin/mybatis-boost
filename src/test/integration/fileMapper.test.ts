/**
 * Integration tests for FileMapper
 * These tests use real file system and VS Code workspace API
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { FileMapper } from '../../navigator';

suite('FileMapper Integration Tests', () => {
    let fileMapper: FileMapper;
    let sampleProjectRoot: string;
    let userMapperJavaPath: string;
    let userMapperXmlPath: string;

    suiteSetup(async function() {
        this.timeout(30000);

        // Get sample project paths
        const extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath;
        if (!extensionPath) {
            throw new Error('Extension not found: young1lin.mybatis-boost');
        }

        sampleProjectRoot = path.join(extensionPath, 'src', 'test', 'fixtures', 'sample-mybatis-project');
        userMapperJavaPath = path.join(sampleProjectRoot, 'src', 'main', 'java', 'com', 'example', 'mapper', 'UserMapper.java');
        userMapperXmlPath = path.join(sampleProjectRoot, 'src', 'main', 'resources', 'mapper', 'UserMapper.xml');

        // Create a mock extension context
        const context = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {}
            },
            extensionPath: extensionPath,
            storagePath: undefined,
            globalStoragePath: undefined,
            logPath: undefined,
            extensionUri: vscode.Uri.file(extensionPath),
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            storageUri: undefined,
            globalStorageUri: undefined,
            logUri: undefined,
            asAbsolutePath: (relativePath: string) => path.join(extensionPath, relativePath),
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        } as unknown as vscode.ExtensionContext;

        // Initialize FileMapper
        fileMapper = new FileMapper(context, 1000);
        await fileMapper.initialize();
    });

    suiteTeardown(() => {
        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    test('should find XML path from Java file', async function() {
        this.timeout(10000);

        const xmlPath = await fileMapper.getXmlPath(userMapperJavaPath);
        assert.ok(xmlPath, 'XML path should be found');
        assert.ok(xmlPath.endsWith('UserMapper.xml'), 'XML path should end with UserMapper.xml');
    });

    test('should find Java path from XML file', async function() {
        this.timeout(10000);

        const javaPath = await fileMapper.getJavaPath(userMapperXmlPath);
        assert.ok(javaPath, 'Java path should be found');
        assert.ok(javaPath.endsWith('UserMapper.java'), 'Java path should end with UserMapper.java');
    });

    test('should cache mappings for performance', async function() {
        this.timeout(10000);

        // First call (should build mapping)
        const start1 = Date.now();
        const xmlPath1 = await fileMapper.getXmlPath(userMapperJavaPath);
        const time1 = Date.now() - start1;

        // Second call (should use cache)
        const start2 = Date.now();
        const xmlPath2 = await fileMapper.getXmlPath(userMapperJavaPath);
        const time2 = Date.now() - start2;

        assert.strictEqual(xmlPath1, xmlPath2, 'Both calls should return same path');
        // Second call should be significantly faster (cached)
        assert.ok(time2 < time1, `Cached call (${time2}ms) should be faster than first call (${time1}ms)`);
    });

    test('should return null for non-MyBatis Java files', async function() {
        this.timeout(10000);

        const userJavaPath = path.join(sampleProjectRoot, 'src', 'main', 'java', 'com', 'example', 'mapper', 'User.java');
        const xmlPath = await fileMapper.getXmlPath(userJavaPath);
        assert.strictEqual(xmlPath, null, 'Non-mapper files should return null');
    });

    test('should handle file changes and invalidate cache', async function() {
        this.timeout(10000);

        // Get initial mapping
        const xmlPath1 = await fileMapper.getXmlPath(userMapperJavaPath);
        assert.ok(xmlPath1, 'Initial XML path should be found');

        // Clear cache manually (simulates file change)
        fileMapper.clearCache();

        // Get mapping again (should rebuild)
        const xmlPath2 = await fileMapper.getXmlPath(userMapperJavaPath);
        assert.strictEqual(xmlPath1, xmlPath2, 'Should rebuild same mapping after cache clear');
    });
});
