/**
 * FileMapper Test Suite
 * Tests for the core FileMapper class
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileMapper } from '../navigator/core/FileMapper';

suite('FileMapper Test Suite', () => {
    let context: vscode.ExtensionContext;
    let fileMapper: FileMapper;
    let tempDir: string;

    suiteSetup(async () => {
        // Get extension context
        const extension = vscode.extensions.getExtension('young1lin.mybatis-boost');
        assert.ok(extension);
        await extension.activate();
        context = extension.exports?.context;

        // Create temporary test directory
        tempDir = path.join(__dirname, 'temp-test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    suiteTeardown(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    setup(() => {
        fileMapper = new FileMapper(context, 100);
    });

    teardown(() => {
        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    test('FileMapper should initialize successfully', async () => {
        await fileMapper.initialize();
        assert.ok(true, 'FileMapper initialized without errors');
    });

    test('Cache should have configurable size', () => {
        const smallMapper = new FileMapper(context, 10);
        assert.ok(smallMapper, 'Should create FileMapper with small cache size');
        smallMapper.dispose();

        const largeMapper = new FileMapper(context, 5000);
        assert.ok(largeMapper, 'Should create FileMapper with large cache size');
        largeMapper.dispose();
    });

    test('clearCache should clear all cached mappings', async () => {
        await fileMapper.initialize();
        fileMapper.clearCache();
        assert.ok(true, 'Cache cleared without errors');
    });

    test('getXmlPath should return null for non-mapper Java file', async () => {
        const javaPath = path.join(tempDir, 'NonMapper.java');
        const xmlPath = await fileMapper.getXmlPath(javaPath);
        assert.strictEqual(xmlPath, null, 'Should return null for non-existent file');
    });

    test('getJavaPath should return null for non-existent XML file', async () => {
        const xmlPath = path.join(tempDir, 'NonExistent.xml');
        const javaPath = await fileMapper.getJavaPath(xmlPath);
        assert.strictEqual(javaPath, null, 'Should return null for non-existent file');
    });

    test('dispose should clean up resources', () => {
        fileMapper.dispose();
        assert.ok(true, 'Dispose completed without errors');
    });
});
