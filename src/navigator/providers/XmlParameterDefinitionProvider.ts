/**
 * Definition provider for navigating from XML parameter references to Java definitions
 * Handles navigation like: #{paramName} -> Java field or @Param annotation
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { getParameterAtPosition } from '../parsers/parameterParser';
import { extractStatementParameterInfo } from '../parsers/parameterParser';
import { extractStatementIdFromPosition } from '../parsers/xmlParser';
import { extractXmlStatements } from '../parsers/xmlParser';
import { extractMethodParameters } from '../parsers/javaParser';
import { findJavaField } from '../parsers/javaFieldParser';

/**
 * Provides go-to-definition for parameter references in XML SQL statements
 * Supports: #{paramName} and ${paramName}
 */
export class XmlParameterDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private fileMapper: FileMapper) {}

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const line = document.lineAt(position.line).text;

        // Check if cursor is on a parameter reference
        const paramMatch = getParameterAtPosition(line, position.character);
        if (!paramMatch) {
            return null;
        }

        console.log(`[XmlParameterDefinitionProvider] Found parameter reference: ${paramMatch.name}`);

        // Find the statement ID
        const statementId = await extractStatementIdFromPosition(document.uri.fsPath, position.line);
        if (!statementId) {
            console.log('[XmlParameterDefinitionProvider] Could not find statement ID');
            return null;
        }

        console.log(`[XmlParameterDefinitionProvider] Statement ID: ${statementId}`);

        // Find the statement metadata
        const statements = await extractXmlStatements(document.uri.fsPath);
        const statement = statements.find(s => s.id === statementId);
        if (!statement) {
            console.log('[XmlParameterDefinitionProvider] Statement not found');
            return null;
        }

        // Extract parameter info from the statement
        const paramInfo = await extractStatementParameterInfo(document.uri.fsPath, statement);
        console.log(`[XmlParameterDefinitionProvider] Parameter info:`, paramInfo);

        // Find the corresponding Java file
        const mapping = this.fileMapper.getByXmlPath(document.uri.fsPath);
        if (!mapping) {
            console.log('[XmlParameterDefinitionProvider] No Java mapping found');
            return null;
        }

        const javaPath = mapping.javaPath;
        console.log(`[XmlParameterDefinitionProvider] Java file: ${javaPath}`);

        // Try to find parameter in Java method parameters first (@Param annotation)
        const methodParams = await extractMethodParameters(javaPath, statementId);
        const methodParam = methodParams.find(p => p.name === paramMatch.name);

        if (methodParam) {
            console.log(`[XmlParameterDefinitionProvider] Found in method parameters: ${methodParam.name}`);
            const javaUri = vscode.Uri.file(javaPath);
            return new vscode.Location(
                javaUri,
                new vscode.Position(methodParam.line, methodParam.startColumn)
            );
        }

        // If not found in method parameters, try to find in parameterType class
        if (paramInfo.parameterType) {
            console.log(`[XmlParameterDefinitionProvider] Looking in parameterType: ${paramInfo.parameterType}`);

            // Try to find the Java class file
            const location = await this.findJavaFieldInClass(paramInfo.parameterType, paramMatch.name);
            if (location) {
                return location;
            }
        }

        console.log(`[XmlParameterDefinitionProvider] Parameter ${paramMatch.name} not found in any source`);
        return null;
    }

    /**
     * Find a field in a Java class by fully-qualified class name
     */
    private async findJavaFieldInClass(
        className: string,
        fieldName: string
    ): Promise<vscode.Location | null> {
        // Handle primitive types and java.lang classes (skip navigation)
        if (this.isBuiltInType(className)) {
            return null;
        }

        // Convert fully-qualified class name to file path
        // Example: com.example.entity.User -> **/com/example/entity/User.java
        const pathPattern = className.replace(/\./g, '/') + '.java';
        const searchPattern = `**/${pathPattern}`;

        try {
            const files = await vscode.workspace.findFiles(
                searchPattern,
                '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**',
                1 // Limit to first match
            );

            if (files.length === 0) {
                console.log(`[XmlParameterDefinitionProvider] Java class not found: ${className}`);
                return null;
            }

            const javaUri = files[0];
            console.log(`[XmlParameterDefinitionProvider] Found Java class: ${javaUri.fsPath}`);

            // Find the field in the class
            const field = await findJavaField(javaUri.fsPath, fieldName);
            if (field) {
                return new vscode.Location(
                    javaUri,
                    new vscode.Position(field.line, field.startColumn)
                );
            }

            console.log(`[XmlParameterDefinitionProvider] Field ${fieldName} not found in class ${className}`);
            return null;

        } catch (error) {
            console.error('[XmlParameterDefinitionProvider] Error finding Java field:', error);
            return null;
        }
    }

    /**
     * Check if a class name is a built-in type that doesn't need navigation
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
}
