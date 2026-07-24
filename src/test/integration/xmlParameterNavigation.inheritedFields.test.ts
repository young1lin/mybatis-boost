/**
 * Integration tests for XML → Java field navigation with inherited fields (issue #50)
 *
 * TaskQuery extends AuditEntity extends BaseEntity<Long>. Navigation from
 * #{param} references and resultMap property attributes must land in the
 * file that actually declares the field, walking superclasses when needed.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('XML Parameter Navigation - Inherited Fields', () => {
    let fixtureRoot: string;
    let xmlPath: string;

    suiteSetup(async function() {
        this.timeout(30000);

        const extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();
        fixtureRoot = path.join(extensionPath, 'src', 'test', 'fixtures', 'parameter-validation');
        xmlPath = path.join(fixtureRoot, 'TaskMapper.xml');
    });

    async function executeDefinitionAt(offset: number): Promise<vscode.Location[]> {
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        await vscode.window.showTextDocument(xmlDoc);
        const position = xmlDoc.positionAt(offset);

        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            xmlDoc.uri,
            position
        );
        return definitions || [];
    }

    async function findOffset(pattern: RegExp, skip: number): Promise<number> {
        const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
        const match = xmlDoc.getText().match(pattern);
        assert.ok(match && match.index !== undefined, `${pattern} not found in TaskMapper.xml`);
        return match.index + skip;
    }

    test('should navigate from #{taskName} to the field declared on TaskQuery itself', async function() {
        this.timeout(10000);

        const offset = await findOffset(/#\{taskName\}/, 2);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for #{taskName}');
        assert.ok(definitions[0].uri.fsPath.endsWith('TaskQuery.java'),
            `Expected TaskQuery.java, got ${definitions[0].uri.fsPath}`);
    });

    test('should navigate from #{updatedBy} to the inherited field in AuditEntity', async function() {
        this.timeout(10000);

        const offset = await findOffset(/#\{updatedBy\}/, 2);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for #{updatedBy}');
        assert.ok(definitions[0].uri.fsPath.endsWith('AuditEntity.java'),
            `Expected AuditEntity.java, got ${definitions[0].uri.fsPath}`);
        assert.strictEqual(definitions[0].range.start.line, 5,
            'Should point to the updatedBy declaration in AuditEntity');
    });

    test('should navigate from #{createdBy} to the field inherited from BaseEntity two levels up', async function() {
        this.timeout(10000);

        const offset = await findOffset(/#\{createdBy\}/, 2);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for #{createdBy}');
        assert.ok(definitions[0].uri.fsPath.endsWith('BaseEntity.java'),
            `Expected BaseEntity.java, got ${definitions[0].uri.fsPath}`);
        assert.strictEqual(definitions[0].range.start.line, 4,
            'Should point to the createdBy declaration in BaseEntity');
    });

    test('should navigate from resultMap property="createdBy" to the inherited field in BaseEntity', async function() {
        this.timeout(10000);

        // Cursor inside the attribute value of <result property="createdBy" .../>
        const offset = await findOffset(/property="createdBy"/, 'property="'.length);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for property="createdBy"');
        assert.ok(definitions[0].uri.fsPath.endsWith('BaseEntity.java'),
            `Expected BaseEntity.java, got ${definitions[0].uri.fsPath}`);
        assert.strictEqual(definitions[0].range.start.line, 4,
            'Should point to the createdBy declaration in BaseEntity');
    });

    test('should use the bundled AST parser for an annotated inherited field', async function() {
        this.timeout(10000);

        // The regex fallback skips lines beginning with annotations, so this
        // definition is available only when tree-sitter initializes in dist.
        const offset = await findOffset(/#\{astOnlyField\}/, 2);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for #{astOnlyField}');
        assert.ok(definitions[0].uri.fsPath.endsWith('BaseEntity.java'),
            `Expected BaseEntity.java, got ${definitions[0].uri.fsPath}`);
        assert.strictEqual(definitions[0].range.start.line, 6,
            'Should point to the annotated astOnlyField declaration in BaseEntity');
    });

    test('should navigate to the nearest declaration when a superclass field is shadowed', async function() {
        this.timeout(10000);

        // Both AuditEntity and BaseEntity declare shadowedField. TaskQuery
        // inherits through AuditEntity, so navigation must stop at that nearer
        // declaration instead of continuing to BaseEntity.
        const offset = await findOffset(/#\{shadowedField\}/, 2);
        const definitions = await executeDefinitionAt(offset);

        assert.ok(definitions.length > 0, 'No definitions found for #{shadowedField}');
        assert.ok(definitions[0].uri.fsPath.endsWith('AuditEntity.java'),
            `Expected AuditEntity.java, got ${definitions[0].uri.fsPath}`);
        assert.strictEqual(definitions[0].range.start.line, 6,
            'Should point to the nearer shadowedField declaration in AuditEntity');
    });
});
