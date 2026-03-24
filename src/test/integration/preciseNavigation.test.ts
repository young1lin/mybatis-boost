/**
 * Integration tests for precise position navigation
 * Tests that navigation jumps to the exact method/statement name, not just the line start
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FileMapper, JavaToXmlDefinitionProvider, XmlToJavaDefinitionProvider, XmlSqlFragmentDefinitionProvider } from '../../navigator';

// Skip: tests create temp files outside workspace, executeDefinitionProvider requires workspace-scoped FileMapper
suite.skip('Precise Position Navigation Integration Tests', () => {
    let tempDir: string;
    let javaFilePath: string;
    let xmlFilePath: string;
    let fileMapper: FileMapper;
    let javaToXmlProvider: JavaToXmlDefinitionProvider;
    let xmlToJavaProvider: XmlToJavaDefinitionProvider;
    let xmlSqlFragmentProvider: XmlSqlFragmentDefinitionProvider;

    suiteSetup(async function() {
        this.timeout(30000);

        // Create temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybatis-boost-test-'));

        // Create directory structure
        const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example', 'mapper');
        const xmlDir = path.join(tempDir, 'src', 'main', 'resources', 'mapper');
        fs.mkdirSync(javaDir, { recursive: true });
        fs.mkdirSync(xmlDir, { recursive: true });

        // Create test Java file
        javaFilePath = path.join(javaDir, 'TestMapper.java');
        const javaContent = `package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TestMapper {
    TestVO selectAllById(Long id);

    User selectById(Long id);

    int insert(User user);
}
`;
        fs.writeFileSync(javaFilePath, javaContent, 'utf-8');

        // Create test XML file
        xmlFilePath = path.join(xmlDir, 'TestMapper.xml');
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.TestMapper">
    <!-- SQL Fragment Definition -->
    <sql id="BaseColumns">
        id, permission_name, resource, action, type, description, status,
        sort_order, create_time, update_time, version
    </sql>

    <sql id="UserColumns">
        id, username, email, created_at
    </sql>

    <select id="selectAllById" resultType="com.example.model.TestVO">
        SELECT
            <include refid="BaseColumns"/>
        FROM test WHERE id = #{id}
    </select>

    <select id="selectById" resultType="com.example.model.User">
        SELECT
            <include refid="UserColumns"/>
        FROM users WHERE id = #{id}
    </select>

    <insert id="insert">
        INSERT INTO users (name) VALUES (#{name})
    </insert>
</mapper>
`;
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');

        // Initialize providers
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
            extensionPath: tempDir,
            storagePath: undefined,
            globalStoragePath: undefined,
            logPath: undefined,
            extensionUri: vscode.Uri.file(tempDir),
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            storageUri: undefined,
            globalStorageUri: undefined,
            logUri: undefined,
            asAbsolutePath: (relativePath: string) => path.join(tempDir, relativePath),
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        } as unknown as vscode.ExtensionContext;

        fileMapper = new FileMapper(context, 1000);
        await fileMapper.initialize();

        javaToXmlProvider = new JavaToXmlDefinitionProvider(fileMapper);
        xmlToJavaProvider = new XmlToJavaDefinitionProvider(fileMapper);
        xmlSqlFragmentProvider = new XmlSqlFragmentDefinitionProvider();
    });

    suiteTeardown(() => {
        // Clean up temporary files
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    suite('XML to Java - Precise Method Name Position', () => {
        test('should navigate to method name, not line start - selectAllById', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Find the position of "selectAllById" in the id attribute
            const selectAllByIdMatch = xmlContent.match(/<select id="selectAllById"/);
            assert.ok(selectAllByIdMatch, 'selectAllById statement not found in XML');

            const selectAllByIdIndex = xmlContent.indexOf('"selectAllById"') + 1; // Position at 's'
            const position = xmlDoc.positionAt(selectAllByIdIndex);

            // Call provider
            const definition = await xmlToJavaProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            assert.ok(!Array.isArray(definition), 'Should return single location');

            const location = definition as vscode.Location;
            assert.ok(location.uri.fsPath.endsWith('TestMapper.java'), 'Should navigate to Java file');

            // Verify precise position - should point to method name, not line start
            const javaDoc = await vscode.workspace.openTextDocument(location.uri);
            const javaLine = javaDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to line: "${javaLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            // Check that cursor is at the method name "selectAllById"
            const methodNameInLine = javaLine.substring(location.range.start.character);
            assert.ok(
                methodNameInLine.startsWith('selectAllById'),
                `Cursor should be at method name, but found: "${methodNameInLine.substring(0, 20)}"`
            );

            // Ensure cursor is NOT at line start (column 0)
            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0 (line start)'
            );
        });

        test('should navigate to method name, not line start - insert', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Find the position of "insert" in the id attribute
            const insertIndex = xmlContent.indexOf('"insert"') + 1; // Position at 'i'
            const position = xmlDoc.positionAt(insertIndex);

            // Call provider
            const definition = await xmlToJavaProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;

            // Verify precise position
            const javaDoc = await vscode.workspace.openTextDocument(location.uri);
            const javaLine = javaDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to line: "${javaLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            const methodNameInLine = javaLine.substring(location.range.start.character);
            assert.ok(
                methodNameInLine.startsWith('insert'),
                `Cursor should be at method name "insert", but found: "${methodNameInLine.substring(0, 20)}"`
            );

            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0'
            );
        });
    });

    suite('Java to XML - Precise ID Attribute Position', () => {
        test('should navigate to id attribute value, not line start - selectAllById', async function() {
            this.timeout(10000);

            const javaDoc = await vscode.workspace.openTextDocument(javaFilePath);
            const javaContent = javaDoc.getText();

            // Find the position of "selectAllById" method in Java
            const selectAllByIdIndex = javaContent.indexOf('selectAllById');
            const position = javaDoc.positionAt(selectAllByIdIndex);

            // Call provider
            const definition = await javaToXmlProvider.provideDefinition(
                javaDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;
            assert.ok(location.uri.fsPath.endsWith('TestMapper.xml'), 'Should navigate to XML file');

            // Verify precise position - should point to id value, not line start
            const xmlDoc = await vscode.workspace.openTextDocument(location.uri);
            const xmlLine = xmlDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to XML line: "${xmlLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            // Check that cursor is at or near "selectAllById" in the id attribute
            const textAtCursor = xmlLine.substring(location.range.start.character);
            assert.ok(
                textAtCursor.startsWith('selectAllById'),
                `Cursor should be at id value, but found: "${textAtCursor.substring(0, 30)}"`
            );

            // Ensure cursor is NOT at line start
            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0'
            );
        });

        test('should navigate to id attribute value, not line start - insert', async function() {
            this.timeout(10000);

            const javaDoc = await vscode.workspace.openTextDocument(javaFilePath);
            const javaContent = javaDoc.getText();

            // Find the position of "insert" method in Java
            const insertIndex = javaContent.indexOf('insert');
            const position = javaDoc.positionAt(insertIndex);

            // Call provider
            const definition = await javaToXmlProvider.provideDefinition(
                javaDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;

            // Verify precise position
            const xmlDoc = await vscode.workspace.openTextDocument(location.uri);
            const xmlLine = xmlDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to XML line: "${xmlLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            const textAtCursor = xmlLine.substring(location.range.start.character);
            assert.ok(
                textAtCursor.startsWith('insert'),
                `Cursor should be at id value "insert", but found: "${textAtCursor.substring(0, 20)}"`
            );

            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0'
            );
        });
    });

    suite('Edge Cases', () => {
        test('should handle methods with similar names', async function() {
            this.timeout(10000);

            const javaDoc = await vscode.workspace.openTextDocument(javaFilePath);
            const javaContent = javaDoc.getText();

            // There are two methods: "selectById" and "selectAllById"
            // Make sure we navigate to the correct one based on cursor position

            // Test selectById (not selectAllById)
            const selectByIdPattern = /\n\s+User selectById/;
            const match = javaContent.match(selectByIdPattern);
            assert.ok(match, 'selectById method not found');

            const selectByIdIndex = javaContent.indexOf('User selectById') + 'User '.length;
            const position = javaDoc.positionAt(selectByIdIndex);

            const definition = await javaToXmlProvider.provideDefinition(
                javaDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;

            const xmlDoc = await vscode.workspace.openTextDocument(location.uri);
            const xmlLine = xmlDoc.lineAt(location.range.start.line).text;

            // Should navigate to "selectById", not "selectAllById"
            const textAtCursor = xmlLine.substring(location.range.start.character);
            assert.ok(
                textAtCursor.startsWith('selectById'),
                'Should navigate to selectById'
            );
            assert.ok(
                !textAtCursor.startsWith('selectAllById'),
                'Should not navigate to selectAllById'
            );
        });
    });

    suite('SQL Fragment Navigation - Precise Position', () => {
        test('should navigate from include refid to sql id with cursor position mapping - BaseColumns', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Find the position of "BaseColumns" in the include refid attribute
            // We'll test cursor at the middle of "BaseColumns" (at 'C')
            const includePattern = /<include refid="BaseColumns"/;
            assert.ok(includePattern.test(xmlContent), 'include refid="BaseColumns" not found in XML');

            const includeRefIdIndex = xmlContent.indexOf('"BaseColumns"') + 1; // Position at 'B'
            const cursorOffset = 4; // Position at 'C' in "BaseColumns"
            const position = xmlDoc.positionAt(includeRefIdIndex + cursorOffset);

            console.log(`Testing navigation from include refid at cursor offset ${cursorOffset}`);

            // Call provider
            const definition = await xmlSqlFragmentProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            assert.ok(!Array.isArray(definition), 'Should return single location');

            const location = definition as vscode.Location;
            assert.ok(location.uri.fsPath.endsWith('TestMapper.xml'), 'Should navigate within same XML file');

            // Verify precise position - should point to same relative position in sql id
            const targetLine = xmlDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to line: "${targetLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            // Check that cursor is within "BaseColumns" in the sql id attribute
            const textAtCursor = targetLine.substring(location.range.start.character);
            assert.ok(
                textAtCursor.startsWith('BaseColumns') || textAtCursor.startsWith('eColumns') ||
                textAtCursor.startsWith('Columns') || textAtCursor.startsWith('olumns'),
                `Cursor should be within "BaseColumns", but found: "${textAtCursor.substring(0, 20)}"`
            );

            // Ensure cursor is NOT at line start (column 0)
            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0 (line start)'
            );

            // Verify it's the sql tag, not another occurrence
            assert.ok(
                targetLine.includes('<sql') && targetLine.includes('id='),
                'Should navigate to <sql id="BaseColumns"> tag'
            );
        });

        test('should navigate from include refid to sql id - UserColumns at different cursor position', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Find the position of "UserColumns" in the include refid attribute
            // Test cursor at the end of "UserColumns" (at 's')
            const includePattern = /<include refid="UserColumns"/;
            assert.ok(includePattern.test(xmlContent), 'include refid="UserColumns" not found in XML');

            const includeRefIdIndex = xmlContent.indexOf('"UserColumns"') + 1; // Position at 'U'
            const userColumnsLength = 'UserColumns'.length;
            const cursorOffset = userColumnsLength - 1; // Position at last 's'
            const position = xmlDoc.positionAt(includeRefIdIndex + cursorOffset);

            console.log(`Testing navigation from include refid at cursor offset ${cursorOffset} (near end)`);

            // Call provider
            const definition = await xmlSqlFragmentProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;

            // Verify precise position
            const targetLine = xmlDoc.lineAt(location.range.start.line).text;

            console.log(`Navigated to line: "${targetLine}"`);
            console.log(`Cursor column: ${location.range.start.character}`);

            // Check that cursor is within "UserColumns" in the sql id attribute
            const textAtCursor = targetLine.substring(location.range.start.character);
            assert.ok(
                textAtCursor.startsWith('UserColumns') || textAtCursor.startsWith('serColumns') ||
                textAtCursor.startsWith('Columns') || textAtCursor.startsWith('s') || textAtCursor.startsWith('ns'),
                `Cursor should be within "UserColumns", but found: "${textAtCursor.substring(0, 20)}"`
            );

            // Ensure cursor is NOT at line start
            assert.ok(
                location.range.start.character > 0,
                'Cursor should not be at column 0'
            );

            // Verify it's the correct sql tag
            assert.ok(
                targetLine.includes('<sql') && targetLine.includes('UserColumns'),
                'Should navigate to <sql id="UserColumns"> tag'
            );
        });

        test('should navigate from include refid at start position - BaseColumns', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Test cursor at the very start of "BaseColumns" (at 'B')
            const includeRefIdIndex = xmlContent.indexOf('"BaseColumns"') + 1; // Position at 'B'
            const position = xmlDoc.positionAt(includeRefIdIndex);

            console.log('Testing navigation from include refid at start position');

            // Call provider
            const definition = await xmlSqlFragmentProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            const location = definition as vscode.Location;

            // Verify that cursor maps to start of "BaseColumns" in sql id
            const targetLine = xmlDoc.lineAt(location.range.start.line).text;
            const textAtCursor = targetLine.substring(location.range.start.character);

            console.log(`Navigated to line: "${targetLine}"`);
            console.log(`Text at cursor: "${textAtCursor.substring(0, 30)}"`);

            // Should start with "BaseColumns" since we mapped from the start
            assert.ok(
                textAtCursor.startsWith('BaseColumns'),
                `Cursor should be at start of "BaseColumns", but found: "${textAtCursor.substring(0, 20)}"`
            );
        });

        test('should navigate from sql id to include refid with cursor position mapping - reverse navigation', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Find the position of "BaseColumns" in the sql id attribute
            // Test cursor at the middle of "BaseColumns" (at 'C')
            const sqlPattern = /<sql id="BaseColumns"/;
            assert.ok(sqlPattern.test(xmlContent), 'sql id="BaseColumns" not found in XML');

            const sqlIdIndex = xmlContent.indexOf('<sql id="BaseColumns"') + '<sql id="'.length; // Position at 'B'
            const cursorOffset = 4; // Position at 'C' in "BaseColumns"
            const position = xmlDoc.positionAt(sqlIdIndex + cursorOffset);

            console.log(`Testing reverse navigation from sql id at cursor offset ${cursorOffset}`);

            // Call provider
            const definition = await xmlSqlFragmentProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            assert.ok(Array.isArray(definition), 'Should return array of locations (references)');

            const locations = definition as vscode.Location[];
            assert.ok(locations.length > 0, 'Should find at least one include reference');

            // Check the first reference
            const firstLocation = locations[0];
            const targetLine = xmlDoc.lineAt(firstLocation.range.start.line).text;

            console.log(`Navigated to line: "${targetLine}"`);
            console.log(`Cursor column: ${firstLocation.range.start.character}`);

            // Check that cursor is within "BaseColumns" in the include refid attribute
            const textAtCursor = targetLine.substring(firstLocation.range.start.character);
            assert.ok(
                textAtCursor.startsWith('BaseColumns') || textAtCursor.startsWith('eColumns') ||
                textAtCursor.startsWith('Columns') || textAtCursor.startsWith('olumns'),
                `Cursor should be within "BaseColumns" in include refid, but found: "${textAtCursor.substring(0, 20)}"`
            );

            // Ensure cursor is NOT at line start (column 0)
            assert.ok(
                firstLocation.range.start.character > 0,
                'Cursor should not be at column 0 (line start)'
            );

            // Verify it's an include tag
            assert.ok(
                targetLine.includes('<include') && targetLine.includes('refid='),
                'Should navigate to <include refid="BaseColumns"> tag'
            );
        });

        test('should navigate from sql id at start position to include refid - reverse navigation', async function() {
            this.timeout(10000);

            const xmlDoc = await vscode.workspace.openTextDocument(xmlFilePath);
            const xmlContent = xmlDoc.getText();

            // Test cursor at the very start of "UserColumns" (at 'U')
            const sqlIdIndex = xmlContent.indexOf('<sql id="UserColumns"') + '<sql id="'.length; // Position at 'U'
            const position = xmlDoc.positionAt(sqlIdIndex);

            console.log('Testing reverse navigation from sql id at start position');

            // Call provider
            const definition = await xmlSqlFragmentProvider.provideDefinition(
                xmlDoc,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(definition, 'Definition should be returned');
            assert.ok(Array.isArray(definition), 'Should return array of locations');

            const locations = definition as vscode.Location[];
            assert.ok(locations.length > 0, 'Should find at least one include reference');

            // Check the first reference - cursor should map to start of "UserColumns" in include refid
            const firstLocation = locations[0];
            const targetLine = xmlDoc.lineAt(firstLocation.range.start.line).text;
            const textAtCursor = targetLine.substring(firstLocation.range.start.character);

            console.log(`Navigated to line: "${targetLine}"`);
            console.log(`Text at cursor: "${textAtCursor.substring(0, 30)}"`);

            // Should start with "UserColumns" since we mapped from the start
            assert.ok(
                textAtCursor.startsWith('UserColumns'),
                `Cursor should be at start of "UserColumns" in include refid, but found: "${textAtCursor.substring(0, 20)}"`
            );
        });
    });
});
