/**
 * Integration tests for Definition Providers
 * These tests use real VS Code API and the sample MyBatis project
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileMapper } from '../../navigator';
import { createMockContext } from '../helpers/testSetup';

suite('Definition Providers Integration Tests', () => {
    let fileMapper: FileMapper;
    let sampleProjectRoot: string;
    let userMapperJavaPath: string;
    let userMapperXmlPath: string;
    let extensionPath: string;
    let originalUseDefinitionProvider: boolean | undefined;

    suiteSetup(async function() {
        // This may take time as it initializes the extension
        this.timeout(30000);

        // Get extension path
        extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();

        // Build fixture paths
        sampleProjectRoot = path.join(extensionPath, 'src', 'test', 'fixtures', 'sample-mybatis-project');
        userMapperJavaPath = path.join(sampleProjectRoot, 'src', 'main', 'java', 'com', 'example', 'mapper', 'UserMapper.java');
        userMapperXmlPath = path.join(sampleProjectRoot, 'src', 'main', 'resources', 'mapper', 'UserMapper.xml');

        // Verify files exist
        if (!fs.existsSync(userMapperJavaPath)) {
            console.warn(`[Definition Providers] Java file not found: ${userMapperJavaPath}`);
        }
        if (!fs.existsSync(userMapperXmlPath)) {
            console.warn(`[Definition Providers] XML file not found: ${userMapperXmlPath}`);
        }

        // Create mock extension context
        const context = createMockContext(extensionPath);

        // Initialize FileMapper
        fileMapper = new FileMapper(context, 1000);
        await fileMapper.initialize();

        // Java→XML F12 navigation is only registered in DefinitionProvider mode.
        const config = vscode.workspace.getConfiguration('mybatis-boost');
        originalUseDefinitionProvider = config.inspect<boolean>('useDefinitionProvider')?.workspaceValue;
        await config.update('useDefinitionProvider', true, vscode.ConfigurationTarget.Workspace);
    });

    suiteTeardown(async () => {
        await vscode.workspace
            .getConfiguration('mybatis-boost')
            .update('useDefinitionProvider', originalUseDefinitionProvider, vscode.ConfigurationTarget.Workspace);

        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    suite('Java to XML Navigation', () => {
        test('should navigate from Java method to XML statement', async function() {
            this.timeout(10000);

            // Open Java file
            const javaDoc = await vscode.workspace.openTextDocument(userMapperJavaPath);
            await vscode.window.showTextDocument(javaDoc);

            // Find position of "selectById" method
            const javaContent = javaDoc.getText();
            const selectByIdIndex = javaContent.indexOf('selectById');
            assert.ok(selectByIdIndex > -1, 'selectById method not found in Java file');

            const selectByIdPosition = javaDoc.positionAt(selectByIdIndex);

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                javaDoc.uri,
                selectByIdPosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('UserMapper.xml'), 'Definition should point to XML file');
        });

        test('should navigate from Java interface name to XML mapper tag', async function() {
            this.timeout(10000);

            // Open Java file
            const javaDoc = await vscode.workspace.openTextDocument(userMapperJavaPath);
            await vscode.window.showTextDocument(javaDoc);

            // Find position of "UserMapper" interface declaration
            const javaContent = javaDoc.getText();
            const interfaceMatch = javaContent.match(/interface\s+(UserMapper)/);
            assert.ok(interfaceMatch, 'UserMapper interface not found');

            const interfacePosition = javaDoc.positionAt(interfaceMatch!.index! + interfaceMatch![0].indexOf('UserMapper'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                javaDoc.uri,
                interfacePosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('UserMapper.xml'), 'Definition should point to XML file');
        });
    });

    suite('XML to Java Navigation', () => {
        test('should navigate from XML statement ID to Java method', async function() {
            this.timeout(10000);

            // Open XML file
            const xmlDoc = await vscode.workspace.openTextDocument(userMapperXmlPath);
            await vscode.window.showTextDocument(xmlDoc);

            // Find position of id="selectById"
            const xmlContent = xmlDoc.getText();
            const selectByIdMatch = xmlContent.match(/id="(selectById)"/);
            assert.ok(selectByIdMatch, 'selectById statement not found in XML');

            const selectByIdPosition = xmlDoc.positionAt(selectByIdMatch!.index! + selectByIdMatch![0].indexOf('selectById'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                xmlDoc.uri,
                selectByIdPosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('UserMapper.java'), 'Definition should point to Java file');
        });

        test('should navigate from XML namespace to Java interface', async function() {
            this.timeout(10000);

            // Open XML file
            const xmlDoc = await vscode.workspace.openTextDocument(userMapperXmlPath);
            await vscode.window.showTextDocument(xmlDoc);

            // Find position of namespace attribute
            const xmlContent = xmlDoc.getText();
            const namespaceMatch = xmlContent.match(/namespace="([^"]+)"/);
            assert.ok(namespaceMatch, 'namespace not found in XML');

            const namespacePosition = xmlDoc.positionAt(namespaceMatch!.index! + namespaceMatch![0].indexOf('com.example'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                xmlDoc.uri,
                namespacePosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('UserMapper.java'), 'Definition should point to Java file');
        });
    });

    suite('Java Class Reference Navigation', () => {
        test('should navigate from XML resultType to Java class', async function() {
            this.timeout(10000);

            // Open XML file
            const xmlDoc = await vscode.workspace.openTextDocument(userMapperXmlPath);
            await vscode.window.showTextDocument(xmlDoc);

            // Find position of type="com.example.mapper.User"
            const xmlContent = xmlDoc.getText();
            const typeMatch = xmlContent.match(/type="(com\.example\.mapper\.User)"/);
            assert.ok(typeMatch, 'User type not found in XML');

            const typePosition = xmlDoc.positionAt(typeMatch!.index! + typeMatch![0].indexOf('com.example'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                xmlDoc.uri,
                typePosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('User.java'), 'Definition should point to User.java');
        });
    });

    suite('SQL Fragment Navigation', () => {
        test('should navigate from include refid to sql fragment', async function() {
            this.timeout(10000);

            // Open XML file
            const xmlDoc = await vscode.workspace.openTextDocument(userMapperXmlPath);
            await vscode.window.showTextDocument(xmlDoc);

            // Find position of refid="BaseColumns"
            const xmlContent = xmlDoc.getText();
            const refidMatch = xmlContent.match(/refid="(BaseColumns)"/);
            assert.ok(refidMatch, 'BaseColumns refid not found in XML');

            const refidPosition = xmlDoc.positionAt(refidMatch!.index! + refidMatch![0].indexOf('BaseColumns'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                xmlDoc.uri,
                refidPosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];

            // Should point to the same file at the sql fragment line
            assert.ok(definition.uri.fsPath.endsWith('UserMapper.xml'), 'Definition should point to same XML file');
        });
    });

    suite('ResultMap Property Navigation', () => {
        test('should navigate from property attribute to Java field', async function() {
            this.timeout(10000);

            // Open XML file
            const xmlDoc = await vscode.workspace.openTextDocument(userMapperXmlPath);
            await vscode.window.showTextDocument(xmlDoc);

            // Find position of property="name"
            const xmlContent = xmlDoc.getText();
            const propertyMatch = xmlContent.match(/property="(name)"/);
            assert.ok(propertyMatch, 'name property not found in XML');

            const propertyPosition = xmlDoc.positionAt(propertyMatch!.index! + propertyMatch![0].indexOf('name'));

            // Execute go-to-definition
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                xmlDoc.uri,
                propertyPosition
            );

            assert.ok(definitions && definitions.length > 0, 'No definitions found');
            const definition = definitions[0];
            assert.ok(definition.uri.fsPath.endsWith('User.java'), 'Definition should point to User.java');
        });
    });
});
