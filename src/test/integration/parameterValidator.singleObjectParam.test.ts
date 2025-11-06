/**
 * Integration tests for ParameterValidator - MyBatis 3.x+ single object parameter auto-mapping
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ParameterValidator } from '../../navigator/diagnostics/ParameterValidator';
import { FileMapper } from '../../navigator/core/FileMapper';
import { createMockContext } from '../helpers/testSetup';

suite('ParameterValidator - Single Object Parameter Auto-mapping Integration Tests', () => {
    let parameterValidator: ParameterValidator;
    let fileMapper: FileMapper;
    let context: vscode.ExtensionContext;
    let extensionPath: string;

    suiteSetup(async function() {
        this.timeout(30000);

        // Get extension path
        extensionPath = vscode.extensions.getExtension('young1lin.mybatis-boost')?.extensionPath || process.cwd();

        // Create mock extension context
        context = createMockContext(extensionPath);

        // Initialize FileMapper
        fileMapper = new FileMapper(context, 5000);
        await fileMapper.initialize();

        // Initialize ParameterValidator
        parameterValidator = new ParameterValidator(context, fileMapper);

        // Wait a bit for initialization
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

    suite('MyBatis 3.x+ single object parameter auto-mapping', () => {
        test('should auto-map fields for single object parameter without @Param and without parameterType', async function() {
            this.timeout(10000);

            const xmlPath = path.join(
                extensionPath,
                'src', 'test', 'fixtures', 'parameter-validation',
                'WelfareActivityMapper.xml'
            );

            const xmlUri = vscode.Uri.file(xmlPath);
            const document = await vscode.workspace.openTextDocument(xmlUri);

            // Validate the document
            await parameterValidator.validateDocument(document);

            // Wait a bit for validation to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get diagnostics for the document
            const diagnostics = vscode.languages.getDiagnostics(xmlUri);

            // The selectByCondition statement uses #{order}, #{size}, #{status}, #{userId}
            // These should all be valid because:
            // 1. The method has a single parameter: WelfareActivityQuery condition
            // 2. The parameter does not have @Param annotation
            // 3. WelfareActivityQuery has fields: order, size, status, userId
            // 4. MyBatis 3.x+ will auto-map these fields

            // Log all diagnostics for debugging
            console.log(`[Test] All diagnostics: ${JSON.stringify(diagnostics.map(d => ({ message: d.message, line: d.range.start.line })))}`);

            // Filter diagnostics to only those related to selectByCondition
            const selectByConditionDiagnostics = diagnostics.filter(d => {
                // Check if diagnostic is in the selectByCondition statement range (approximately lines 21-42)
                const line = d.range.start.line;
                return line >= 20 && line <= 45 && d.source === 'MyBatis Boost';
            });

            console.log(`[Test] selectByCondition diagnostics: ${JSON.stringify(selectByConditionDiagnostics.map(d => ({ message: d.message, line: d.range.start.line })))}`);

            assert.strictEqual(
                selectByConditionDiagnostics.length,
                0,
                `Expected no parameter validation errors for single object parameter auto-mapping, but got: ${selectByConditionDiagnostics.map(d => `${d.message} at line ${d.range.start.line}`).join('; ')}`
            );
        });

        test('should NOT auto-map fields for single primitive parameter', async function() {
            this.timeout(10000);

            const xmlPath = path.join(
                extensionPath,
                'src', 'test', 'fixtures', 'parameter-validation',
                'WelfareActivityMapper.xml'
            );

            const xmlUri = vscode.Uri.file(xmlPath);
            const document = await vscode.workspace.openTextDocument(xmlUri);

            // Validate the document
            await parameterValidator.validateDocument(document);

            // Wait a bit for validation to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get diagnostics for the document
            const diagnostics = vscode.languages.getDiagnostics(xmlUri);

            // The selectByStatus statement uses #{status} at approximately line 57
            // The selectById statement uses #{id} at approximately line 65

            const selectByStatusDiagnostics = diagnostics.filter(d => {
                const line = d.range.start.line;
                return line >= 52 && line <= 60 && d.source === 'MyBatis Boost' && d.message.includes('status');
            });

            const selectByIdDiagnostics = diagnostics.filter(d => {
                const line = d.range.start.line;
                return line >= 61 && line <= 69 && d.source === 'MyBatis Boost' && d.message.includes('id');
            });

            console.log(`[Test] selectByStatus diagnostics: ${JSON.stringify(selectByStatusDiagnostics.map(d => d.message))}`);
            console.log(`[Test] selectById diagnostics: ${JSON.stringify(selectByIdDiagnostics.map(d => d.message))}`);

            assert.strictEqual(
                selectByStatusDiagnostics.length,
                0,
                `Expected no parameter validation errors for single String parameter, but got: ${selectByStatusDiagnostics.map(d => d.message).join('; ')}`
            );

            assert.strictEqual(
                selectByIdDiagnostics.length,
                0,
                `Expected no parameter validation errors for single Long parameter, but got: ${selectByIdDiagnostics.map(d => d.message).join('; ')}`
            );
        });

        test('should validate parameters with @Param annotations correctly', async function() {
            this.timeout(10000);

            const xmlPath = path.join(
                extensionPath,
                'src', 'test', 'fixtures', 'parameter-validation',
                'WelfareActivityMapper.xml'
            );

            const xmlUri = vscode.Uri.file(xmlPath);
            const document = await vscode.workspace.openTextDocument(xmlUri);

            // Validate the document
            await parameterValidator.validateDocument(document);

            // Wait a bit for validation to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get diagnostics for the document
            const diagnostics = vscode.languages.getDiagnostics(xmlUri);

            // The selectTargetTime statement is at approximately lines 47-51
            const selectTargetTimeDiagnostics = diagnostics.filter(d => {
                const line = d.range.start.line;
                return line >= 46 && line <= 52 && d.source === 'MyBatis Boost';
            });

            console.log(`[Test] selectTargetTime diagnostics: ${JSON.stringify(selectTargetTimeDiagnostics.map(d => d.message))}`);

            assert.strictEqual(
                selectTargetTimeDiagnostics.length,
                0,
                `Expected no parameter validation errors for @Param annotated parameters, but got: ${selectTargetTimeDiagnostics.map(d => d.message).join('; ')}`
            );
        });
    });
});
