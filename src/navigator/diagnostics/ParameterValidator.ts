/**
 * Parameter validator for XML SQL statements
 * Validates that parameter references in XML have corresponding definitions in Java
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { extractParameterReferences, extractStatementParameterInfo, extractLocalVariables, extractAttributeReferences } from '../parsers/parameterParser';
import { extractXmlStatements } from '../parsers/xmlParser';
import { extractMethodParameters } from '../parsers/javaParser';
import { extractJavaFields } from '../parsers/javaFieldParser';

/**
 * Validates parameters in XML mapper files
 */
export class ParameterValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private fileMapper: FileMapper
    ) {
        // Create diagnostic collection
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('mybatis-parameters');
        this.context.subscriptions.push(this.diagnosticCollection);

        // Validate on file open
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (doc.languageId === 'xml') {
                    this.validateDocument(doc);
                }
            })
        );

        // Validate on file change
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'xml') {
                    this.validateDocument(event.document);
                }
            })
        );

        // Validate on file save
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.languageId === 'xml') {
                    this.validateDocument(doc);
                }
            })
        );

        // Validate all open XML documents
        vscode.workspace.textDocuments.forEach(doc => {
            if (doc.languageId === 'xml') {
                this.validateDocument(doc);
            }
        });
    }

    /**
     * Validate a single XML document
     */
    async validateDocument(document: vscode.TextDocument): Promise<void> {
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // Only validate if this is a MyBatis mapper file
            const javaPath = await this.fileMapper.getJavaPath(document.uri.fsPath);
            if (!javaPath) {
                // Not a MyBatis mapper, clear any existing diagnostics
                this.diagnosticCollection.set(document.uri, []);
                return;
            }
            const statements = await extractXmlStatements(document.uri.fsPath);

            // Validate each statement
            for (const statement of statements) {
                const statementDiagnostics = await this.validateStatement(
                    document.uri.fsPath,
                    javaPath,
                    statement
                );
                diagnostics.push(...statementDiagnostics);
            }

            // Set diagnostics for this document
            this.diagnosticCollection.set(document.uri, diagnostics);

        } catch (error) {
            console.error('[ParameterValidator] Error validating document:', error);
        }
    }

    /**
     * Validate parameters in a single SQL statement
     */
    private async validateStatement(
        xmlPath: string,
        javaPath: string,
        statement: { id: string; type: string; line: number }
    ): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // Extract parameters from the statement (#{...} and ${...})
            const parameters = await extractParameterReferences(xmlPath, statement as any);

            // Also extract parameters referenced in attributes (e.g., collection="ids")
            const attrReferences = await extractAttributeReferences(xmlPath, statement as any);

            // Combine both types of references
            const allReferences = [...parameters];
            attrReferences.forEach(attrRef => {
                // Convert attribute references to ParameterReference format for validation
                allReferences.push({
                    name: attrRef,
                    line: statement.line,
                    startColumn: 0,
                    endColumn: 0,
                    type: 'prepared' as const
                });
            });

            // Get parameter info from the statement tag
            const paramInfo = await extractStatementParameterInfo(xmlPath, statement as any);

            // Get valid parameter names
            const validParams = new Set<string>();

            // 1. Add parameters from @Param annotations in Java method
            try {
                const methodParams = await extractMethodParameters(javaPath, statement.id);
                methodParams.forEach(p => validParams.add(p.name));
                console.log(`[ParameterValidator] Method ${statement.id} has parameters: ${Array.from(validParams).join(', ')}`);
            } catch (error) {
                console.error(`[ParameterValidator] Error extracting method parameters:`, error);
            }

            // 2. Add fields from parameterType class
            if (paramInfo.parameterType && !this.isBuiltInType(paramInfo.parameterType)) {
                try {
                    const fields = await this.getClassFields(paramInfo.parameterType);
                    fields.forEach(f => validParams.add(f));
                    console.log(`[ParameterValidator] Class ${paramInfo.parameterType} has fields: ${fields.join(', ')}`);
                } catch (error) {
                    console.error(`[ParameterValidator] Error extracting class fields:`, error);
                }
            }

            // 3. Add local variables from dynamic SQL tags (foreach, bind)
            try {
                const localVars = await extractLocalVariables(xmlPath, statement as any);
                localVars.forEach(v => validParams.add(v));
                if (localVars.size > 0) {
                    console.log(`[ParameterValidator] Statement ${statement.id} has local variables: ${Array.from(localVars).join(', ')}`);
                }
            } catch (error) {
                console.error(`[ParameterValidator] Error extracting local variables:`, error);
            }

            // 4. TODO: Add parameters from parameterMap (future enhancement)

            // Validate each parameter reference
            for (const param of allReferences) {
                if (!validParams.has(param.name)) {
                    // Parameter not found - create diagnostic
                    const range = new vscode.Range(
                        new vscode.Position(param.line, param.startColumn),
                        new vscode.Position(param.line, param.endColumn)
                    );

                    const message = `Parameter '${param.name}' is not defined. ` +
                        `Expected one of: ${Array.from(validParams).join(', ') || '(none)'}`;

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Error
                    );

                    diagnostic.source = 'MyBatis Boost';
                    diagnostics.push(diagnostic);

                    console.log(`[ParameterValidator] Invalid parameter: ${param.name} at line ${param.line}`);
                }
            }

        } catch (error) {
            console.error('[ParameterValidator] Error validating statement:', error);
        }

        return diagnostics;
    }

    /**
     * Get field names from a Java class
     */
    private async getClassFields(className: string): Promise<string[]> {
        // Convert fully-qualified class name to file path
        const pathPattern = className.replace(/\./g, '/') + '.java';
        const searchPattern = `**/${pathPattern}`;

        try {
            const files = await vscode.workspace.findFiles(
                searchPattern,
                '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**',
                1
            );

            if (files.length === 0) {
                console.log(`[ParameterValidator] Class not found: ${className}`);
                return [];
            }

            const fields = await extractJavaFields(files[0].fsPath);
            return fields.map(f => f.name);

        } catch (error) {
            console.error(`[ParameterValidator] Error getting class fields:`, error);
            return [];
        }
    }

    /**
     * Check if a class name is a built-in type
     */
    private isBuiltInType(className: string): boolean {
        const primitives = ['int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char'];
        const javaLang = [
            'java.lang.String',
            'java.lang.Integer',
            'java.lang.Long',
            'java.lang.Double',
            'java.lang.Float',
            'java.lang.Boolean',
            'java.lang.Byte',
            'java.lang.Short',
            'java.lang.Character',
            'java.lang.Object'
        ];

        return primitives.includes(className) || javaLang.includes(className);
    }

    /**
     * Clear all diagnostics
     */
    public clear(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
