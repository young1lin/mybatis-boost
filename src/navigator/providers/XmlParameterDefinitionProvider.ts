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
import { isBuiltInType, isCollectionType } from '../../utils/javaTypeUtils';
import { resolveFullyQualifiedType } from '../../utils/javaTypeResolver';
import { findFieldInHierarchy } from '../../utils/javaFieldHierarchy';

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
        const javaPath = await this.fileMapper.getJavaPath(document.uri.fsPath);
        if (!javaPath) {
            console.log('[XmlParameterDefinitionProvider] No Java mapping found');
            return null;
        }

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

        // MyBatis 3.x+ single object parameter auto-mapping
        if (methodParams.length === 1 && !methodParams[0].hasParamAnnotation) {
            const singleParam = methodParams[0];
            const paramType = singleParam.paramType;

            console.log(`[XmlParameterDefinitionProvider] Checking single parameter auto-mapping for ${singleParam.name} (${paramType})`);

            if (!isBuiltInType(paramType) && !isCollectionType(paramType)) {
                try {
                    const fullyQualifiedType = await resolveFullyQualifiedType(javaPath, paramType);

                    if (fullyQualifiedType) {
                        console.log(`[XmlParameterDefinitionProvider] Auto-mapping enabled for ${fullyQualifiedType}`);
                        const location = await this.findJavaFieldInClass(fullyQualifiedType, paramMatch.name);
                        if (location) {
                            return location;
                        }
                    }
                } catch (error) {
                    console.error(`[XmlParameterDefinitionProvider] Error with auto-mapping:`, error);
                }
            }
        }

        console.log(`[XmlParameterDefinitionProvider] Parameter ${paramMatch.name} not found in any source`);
        return null;
    }

    /**
     * Find a field in a Java class (or one of its superclasses) by fully-qualified class name
     */
    private async findJavaFieldInClass(
        className: string,
        fieldName: string
    ): Promise<vscode.Location | null> {
        if (isBuiltInType(className)) {
            return null;
        }

        try {
            const resolved = await findFieldInHierarchy(className, fieldName);
            if (!resolved) {
                console.log(`[XmlParameterDefinitionProvider] Field ${fieldName} not found in class ${className} or its superclasses`);
                return null;
            }

            console.log(`[XmlParameterDefinitionProvider] Found field ${fieldName} in ${resolved.className}`);
            return new vscode.Location(
                vscode.Uri.file(resolved.filePath),
                new vscode.Position(resolved.field.line, resolved.field.startColumn)
            );

        } catch (error) {
            console.error('[XmlParameterDefinitionProvider] Error finding Java field:', error);
            return null;
        }
    }

}
