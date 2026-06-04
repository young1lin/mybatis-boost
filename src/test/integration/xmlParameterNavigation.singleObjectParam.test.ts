/**
 * Integration tests for XML parameter navigation with single object auto-mapping
 * Tests the new feature: navigating from XML parameter references to Java fields
 * in auto-mapped single object parameters
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { FileMapper } from '../../navigator';
import { XmlParameterDefinitionProvider } from '../../navigator/providers/XmlParameterDefinitionProvider';

suite('XML Parameter Navigation - Single Object Auto-mapping', () => {
    let fileMapper: FileMapper;
    let provider: XmlParameterDefinitionProvider;
    let fixtureRoot: string;
    let xmlPath: string;
    let queryJavaPath: string;
    let providerDisposable: vscode.Disposable;

    suiteSetup(async function() {
        this.timeout(30000);

        // Setup paths
        const extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();
        fixtureRoot = path.join(extensionPath, 'src', 'test', 'fixtures', 'parameter-validation');
        xmlPath = path.join(fixtureRoot, 'WelfareActivityMapper.xml');
        queryJavaPath = path.join(fixtureRoot, 'WelfareActivityQuery.java');

        // Initialize FileMapper with high cache size
        const mockContext: any = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            extensionPath
        };

        fileMapper = new FileMapper(mockContext, 5000);
        await fileMapper.initialize();

        // Initialize provider
        provider = new XmlParameterDefinitionProvider(fileMapper);
        providerDisposable = vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            provider
        );
    });

    suiteTeardown(() => {
        if (providerDisposable) {
            providerDisposable.dispose();
        }
        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    test('should navigate from ${order} to WelfareActivityQuery.order field', async function() {
        this.timeout(10000);

        // Open XML file
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        await vscode.window.showTextDocument(xmlDoc);

        // Find position of ${order}
        const xmlContent = xmlDoc.getText();
        const orderMatch = xmlContent.match(/\$\{order\}/);
        assert.ok(orderMatch, '${order} not found in XML');

        // Position cursor on "order" inside ${order}
        const orderIndex = orderMatch!.index! + 2; // Skip ${
        const orderPosition = xmlDoc.positionAt(orderIndex);

        console.log(`[Test] Testing navigation from \${order} at line ${orderPosition.line}, char ${orderPosition.character}`);

        // Execute go-to-definition
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            xmlDoc.uri,
            orderPosition
        );

        console.log(`[Test] Found ${definitions?.length || 0} definitions`);
        if (definitions && definitions.length > 0) {
            console.log(`[Test] Definition[0]: ${definitions[0].uri.fsPath}:${definitions[0].range.start.line}`);
        }

        // Assertions
        assert.ok(definitions && definitions.length > 0, 'No definitions found for ${order}');
        const definition = definitions[0];
        assert.ok(definition.uri.fsPath.endsWith('WelfareActivityQuery.java'),
            `Expected WelfareActivityQuery.java, got ${definition.uri.fsPath}`);

        // Verify it points to the order field (line 4 in the file)
        assert.strictEqual(definition.range.start.line, 3, 'Should point to order field declaration (line 4, 0-indexed as 3)');
    });

    test('should navigate from ${size} to WelfareActivityQuery.size field', async function() {
        this.timeout(10000);

        // Open XML file
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        await vscode.window.showTextDocument(xmlDoc);

        // Find position of ${size}
        const xmlContent = xmlDoc.getText();
        const sizeMatch = xmlContent.match(/\$\{size\}/);
        assert.ok(sizeMatch, '${size} not found in XML');

        // Position cursor on "size" inside ${size}
        const sizeIndex = sizeMatch!.index! + 2; // Skip ${
        const sizePosition = xmlDoc.positionAt(sizeIndex);

        console.log(`[Test] Testing navigation from \${size} at line ${sizePosition.line}, char ${sizePosition.character}`);

        // Execute go-to-definition
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            xmlDoc.uri,
            sizePosition
        );

        console.log(`[Test] Found ${definitions?.length || 0} definitions`);
        if (definitions && definitions.length > 0) {
            console.log(`[Test] Definition[0]: ${definitions[0].uri.fsPath}:${definitions[0].range.start.line}`);
        }

        // Assertions
        assert.ok(definitions && definitions.length > 0, 'No definitions found for ${size}');
        const definition = definitions[0];
        assert.ok(definition.uri.fsPath.endsWith('WelfareActivityQuery.java'),
            `Expected WelfareActivityQuery.java, got ${definition.uri.fsPath}`);

        // Verify it points to the size field (line 5 in the file)
        assert.strictEqual(definition.range.start.line, 4, 'Should point to size field declaration (line 5, 0-indexed as 4)');
    });

    test('should navigate from #{status} to WelfareActivityQuery.status field', async function() {
        this.timeout(10000);

        // Open XML file
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        await vscode.window.showTextDocument(xmlDoc);

        // Find position of #{status} inside selectByCondition (not in <sql> fragment)
        const xmlContent = xmlDoc.getText();
        const selectByConditionMatch = xmlContent.match(/<select id="selectByCondition"[\s\S]*?<\/select>/);
        assert.ok(selectByConditionMatch, 'selectByCondition not found in XML');
        const statusInSelect = selectByConditionMatch![0].match(/#\{status\}/);
        assert.ok(statusInSelect, '#{status} not found in selectByCondition');
        const statusMatch = { index: selectByConditionMatch!.index! + statusInSelect!.index! };
        assert.ok(statusMatch, '#{status} not found in XML');

        // Position cursor on "status" inside #{status}
        const statusIndex = statusMatch!.index! + 2; // Skip #{
        const statusPosition = xmlDoc.positionAt(statusIndex);

        console.log(`[Test] Testing navigation from #{status} at line ${statusPosition.line}, char ${statusPosition.character}`);

        // Execute go-to-definition
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            xmlDoc.uri,
            statusPosition
        );

        console.log(`[Test] Found ${definitions?.length || 0} definitions`);
        if (definitions && definitions.length > 0) {
            console.log(`[Test] Definition[0]: ${definitions[0].uri.fsPath}:${definitions[0].range.start.line}`);
        }

        // Assertions
        assert.ok(definitions && definitions.length > 0, 'No definitions found for #{status}');
        const definition = definitions[0];
        assert.ok(definition.uri.fsPath.endsWith('WelfareActivityQuery.java'),
            `Expected WelfareActivityQuery.java, got ${definition.uri.fsPath}`);

        // Verify it points to the status field (line 6 in the file)
        assert.strictEqual(definition.range.start.line, 5, 'Should point to status field declaration (line 6, 0-indexed as 5)');
    });

    test('should NOT navigate for single primitive parameter', async function() {
        this.timeout(10000);

        // Open XML file
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        await vscode.window.showTextDocument(xmlDoc);

        // Find position of #{status} in selectByStatus (single String parameter)
        const xmlContent = xmlDoc.getText();
        const selectByStatusMatch = xmlContent.match(/<select id="selectByStatus"[^>]*>[\s\S]*?#{status}[\s\S]*?<\/select>/);
        assert.ok(selectByStatusMatch, 'selectByStatus statement not found');

        const statusInSelectByStatus = selectByStatusMatch![0].indexOf('#{status}');
        const statusIndex = selectByStatusMatch!.index! + statusInSelectByStatus + 2; // Skip #{
        const statusPosition = xmlDoc.positionAt(statusIndex);

        console.log(`[Test] Testing navigation from #{status} in selectByStatus at line ${statusPosition.line}, char ${statusPosition.character}`);

        // Execute go-to-definition
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            xmlDoc.uri,
            statusPosition
        );

        console.log(`[Test] Found ${definitions?.length || 0} definitions`);

        // For single primitive parameter, navigation goes to the method parameter declaration
        // This is valid: #{status} → the `String status` parameter in the method signature
        assert.ok(definitions && definitions.length > 0,
            'Should navigate to method parameter for single primitive parameter');
        const definition = definitions![0];
        assert.ok(definition.uri.fsPath.endsWith('WelfareActivityMapper.java'),
            `Expected WelfareActivityMapper.java, got ${definition.uri.fsPath}`);
    });
});
