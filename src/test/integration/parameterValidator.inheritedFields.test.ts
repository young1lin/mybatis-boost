/**
 * Integration tests for ParameterValidator - inherited fields (issue #50)
 *
 * TaskQuery extends AuditEntity extends BaseEntity<Long>, so parameters that
 * reference inherited fields must not be reported as undefined.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ParameterValidator } from '../../navigator/diagnostics/ParameterValidator';
import { FileMapper } from '../../navigator/core/FileMapper';
import { createMockContext } from '../helpers/testSetup';

suite('ParameterValidator - Inherited Fields Integration Tests', () => {
    let parameterValidator: ParameterValidator;
    let fileMapper: FileMapper;
    let context: vscode.ExtensionContext;
    let extensionPath: string;

    suiteSetup(async function() {
        this.timeout(30000);

        extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();
        context = createMockContext(extensionPath);

        fileMapper = new FileMapper(context, 5000);
        await fileMapper.initialize();

        parameterValidator = new ParameterValidator(context, fileMapper);

        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    suiteTeardown(() => {
        if (parameterValidator) {
            parameterValidator.dispose();
        }
        if (fileMapper) {
            fileMapper.dispose();
        }
    });

    test('should accept parameters that reference inherited fields', async function() {
        this.timeout(10000);

        const xmlPath = path.join(
            extensionPath,
            'src', 'test', 'fixtures', 'parameter-validation',
            'TaskMapper.xml'
        );

        const xmlUri = vscode.Uri.file(xmlPath);
        const document = await vscode.workspace.openTextDocument(xmlUri);

        await parameterValidator.validateDocument(document);
        await new Promise(resolve => setTimeout(resolve, 500));

        const diagnostics = vscode.languages.getDiagnostics(xmlUri);
        const mybatisDiagnostics = diagnostics.filter(d => d.source === 'MyBatis Boost');

        console.log(`[Test] All diagnostics: ${JSON.stringify(mybatisDiagnostics.map(d => ({ message: d.message, line: d.range.start.line })))}`);

        // The document references:
        // - #{taskName}, #{status}   (declared on TaskQuery itself)
        // - #{updatedBy}             (inherited from AuditEntity)
        // - #{createdBy}, #{id}      (inherited from BaseEntity<Long>, two levels up)
        // - #{nonExistentField}      (invalid on purpose)
        // Only nonExistentField may be flagged.
        const unexpectedDiagnostics = mybatisDiagnostics.filter(
            d => !d.message.includes('nonExistentField')
        );

        assert.strictEqual(
            unexpectedDiagnostics.length,
            0,
            `Inherited fields should not be reported as undefined, but got: ${unexpectedDiagnostics.map(d => `${d.message} at line ${d.range.start.line}`).join('; ')}`
        );
    });

    test('should still flag parameters that exist nowhere in the hierarchy', async function() {
        this.timeout(10000);

        const xmlPath = path.join(
            extensionPath,
            'src', 'test', 'fixtures', 'parameter-validation',
            'TaskMapper.xml'
        );

        const xmlUri = vscode.Uri.file(xmlPath);
        const document = await vscode.workspace.openTextDocument(xmlUri);

        await parameterValidator.validateDocument(document);
        await new Promise(resolve => setTimeout(resolve, 500));

        const diagnostics = vscode.languages.getDiagnostics(xmlUri);
        const nonExistentDiagnostics = diagnostics.filter(
            d => d.source === 'MyBatis Boost' && d.message.includes('nonExistentField')
        );

        console.log(`[Test] nonExistentField diagnostics: ${JSON.stringify(nonExistentDiagnostics.map(d => d.message))}`);

        assert.ok(
            nonExistentDiagnostics.length >= 1,
            'Parameter that exists neither on the class nor its superclasses must be flagged'
        );
    });
});
