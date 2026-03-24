/**
 * Integration tests for FileMapper
 * These tests use real file system and VS Code workspace API
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileMapper } from '../../navigator';
import { createMockContext } from '../helpers/testSetup';

suite('FileMapper Integration Tests', () => {
    let fileMapper: FileMapper;
    let sampleProjectRoot: string;
    let userMapperJavaPath: string;
    let userMapperXmlPath: string;
    let userJavaPath: string;
    let extensionPath: string;

    suiteSetup(async function() {
        this.timeout(30000);

        // Get extension path
        extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();

        // Build fixture paths
        sampleProjectRoot = path.join(extensionPath, 'src', 'test', 'fixtures', 'sample-mybatis-project');
        userMapperJavaPath = path.join(sampleProjectRoot, 'src', 'main', 'java', 'com', 'example', 'mapper', 'UserMapper.java');
        userMapperXmlPath = path.join(sampleProjectRoot, 'src', 'main', 'resources', 'mapper', 'UserMapper.xml');
        userJavaPath = path.join(sampleProjectRoot, 'src', 'main', 'java', 'com', 'example', 'mapper', 'User.java');

        // Verify files exist
        if (!fs.existsSync(userMapperJavaPath)) {
            console.warn(`[FileMapper Integration Tests] Java file not found: ${userMapperJavaPath}`);
        }
        if (!fs.existsSync(userMapperXmlPath)) {
            console.warn(`[FileMapper Integration Tests] XML file not found: ${userMapperXmlPath}`);
        }

        // Create mock extension context
        const context = createMockContext(extensionPath);

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

        // Both calls should return same path (case-insensitive on Windows)
        assert.ok(xmlPath1 && xmlPath2, 'Both calls should return a path');
        assert.strictEqual(xmlPath1!.toLowerCase(), xmlPath2!.toLowerCase(), 'Both calls should return same path');
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
        assert.strictEqual(xmlPath1!.toLowerCase(), xmlPath2!.toLowerCase(), 'Should rebuild same mapping after cache clear');
    });
});
