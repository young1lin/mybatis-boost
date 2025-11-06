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
        // If there's only one parameter without @Param annotation, and it's not a primitive type,
        // MyBatis will automatically map the object's fields
        if (methodParams.length === 1 && !methodParams[0].hasParamAnnotation) {
            const singleParam = methodParams[0];
            const paramType = singleParam.paramType;

            console.log(`[XmlParameterDefinitionProvider] Checking single parameter auto-mapping for ${singleParam.name} (${paramType})`);

            // Check if it's not a built-in type (primitives, String, Integer, etc.)
            if (!this.isBuiltInType(paramType) && !this.isCollectionType(paramType)) {
                try {
                    // Try to get the fully qualified class name from the Java file
                    const fullyQualifiedType = await this.resolveFullyQualifiedType(javaPath, paramType);

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
            'String',
            'Integer',
            'Long',
            'Double',
            'Float',
            'Boolean',
            'Byte',
            'Short',
            'Character',
            'Object',
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
     * Check if a class name is a collection type
     */
    private isCollectionType(className: string): boolean {
        const collectionTypes = [
            'List',
            'Set',
            'Map',
            'Collection',
            'ArrayList',
            'LinkedList',
            'HashSet',
            'HashMap',
            'LinkedHashMap',
            'TreeMap',
            'TreeSet',
            'Vector',
            'Stack',
            'Queue',
            'Deque',
            'java.util.List',
            'java.util.Set',
            'java.util.Map',
            'java.util.Collection',
            'java.util.ArrayList',
            'java.util.LinkedList',
            'java.util.HashSet',
            'java.util.HashMap',
            'java.util.LinkedHashMap',
            'java.util.TreeMap',
            'java.util.TreeSet',
            'java.util.Vector',
            'java.util.Stack',
            'java.util.Queue',
            'java.util.Deque'
        ];

        return collectionTypes.includes(className);
    }

    /**
     * Resolve the fully qualified class name from a simple type name in a Java file
     */
    private async resolveFullyQualifiedType(javaPath: string, simpleTypeName: string): Promise<string | null> {
        try {
            // If the type name already contains dots, it's already fully qualified
            if (simpleTypeName.includes('.')) {
                console.log(`[XmlParameterDefinitionProvider] ${simpleTypeName} is already fully qualified`);
                return simpleTypeName;
            }

            const fs = await import('fs');
            const content = await fs.promises.readFile(javaPath, 'utf-8');
            const lines = content.split('\n');

            // Look for import statements that match the simple type name
            for (const line of lines) {
                const trimmed = line.trim();

                // Stop at the class/interface declaration
                if (trimmed.match(/(?:class|interface|enum)\s+/)) {
                    break;
                }

                // Check for matching import
                const importMatch = trimmed.match(/import\s+([\w.]+\.(\w+))\s*;/);
                if (importMatch) {
                    const fullyQualified = importMatch[1];
                    const importedSimpleName = importMatch[2];

                    if (importedSimpleName === simpleTypeName) {
                        console.log(`[XmlParameterDefinitionProvider] Resolved ${simpleTypeName} to ${fullyQualified}`);
                        return fullyQualified;
                    }
                }
            }

            // If not found in imports, check if it's in the same package
            const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
            if (packageMatch) {
                const packageName = packageMatch[1];
                const possibleFullyQualified = `${packageName}.${simpleTypeName}`;

                // Try to find the class file in the same package
                const pathPattern = possibleFullyQualified.replace(/\./g, '/') + '.java';
                const searchPattern = `**/${pathPattern}`;

                const files = await vscode.workspace.findFiles(
                    searchPattern,
                    '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**',
                    1
                );

                if (files.length > 0) {
                    console.log(`[XmlParameterDefinitionProvider] Resolved ${simpleTypeName} to ${possibleFullyQualified} (same package)`);
                    return possibleFullyQualified;
                }
            }

            console.log(`[XmlParameterDefinitionProvider] Could not resolve fully qualified name for ${simpleTypeName}`);
            return null;

        } catch (error) {
            console.error(`[XmlParameterDefinitionProvider] Error resolving type ${simpleTypeName}:`, error);
            return null;
        }
    }
}
