/**
 * Extension Test Suite
 * Comprehensive tests for MyBatis Boost extension
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting MyBatis Boost test suite...');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('young1lin.mybatis-boost'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('young1lin.mybatis-boost');
        assert.ok(extension);

        await extension.activate();
        assert.strictEqual(extension.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);

        assert.ok(
            commands.includes('mybatis-boost.clearCache'),
            'clearCache command should be registered'
        );

        assert.ok(
            commands.includes('mybatis-boost.refreshMappings'),
            'refreshMappings command should be registered'
        );
    });

    test('Configuration should have default values', () => {
        const config = vscode.workspace.getConfiguration('mybatis-boost');

        assert.strictEqual(
            config.get('cacheSize'),
            1000,
            'Default cache size should be 1000'
        );

        assert.deepStrictEqual(
            config.get('customXmlDirectories'),
            [],
            'Default custom XML directories should be empty array'
        );

        assert.strictEqual(
            config.get('javaParseLines'),
            100,
            'Default Java parse lines should be 100'
        );
    });
});
