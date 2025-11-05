/**
 * Definition provider for navigating from XML statements to Java methods
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { findJavaMethodPosition } from '../parsers/javaParser';

/**
 * Provides go-to-definition for:
 * 1. XML statement IDs to jump to Java methods
 * 2. XML namespace to jump to Java interface
 */
export class XmlToJavaDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private fileMapper: FileMapper) {}

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const line = document.lineAt(position.line).text;
        console.log(`[XmlToJavaDefinitionProvider] Line: ${line}`);
        console.log(`[XmlToJavaDefinitionProvider] Cursor position: ${position.character}`);

        // Check if cursor is on namespace attribute in mapper tag
        const namespaceRegex = /<mapper[^>]*namespace\s*=\s*["']([^"']+)["']/g;
        const namespaceMatch = namespaceRegex.exec(line);
        if (namespaceMatch) {
            const namespace = namespaceMatch[1];
            // Calculate the actual position of the namespace value in the line
            const matchStart = namespaceMatch.index;
            const namespaceStart = matchStart + namespaceMatch[0].indexOf(namespace);
            const namespaceEnd = namespaceStart + namespace.length;

            if (position.character >= namespaceStart && position.character <= namespaceEnd) {
                console.log(`[XmlToJavaDefinitionProvider] Found namespace: ${namespace} at position ${position.character}`);
                return this.navigateToJavaInterface(document.uri.fsPath);
            }
        }

        // Check if cursor is on an id attribute in a statement tag
        const idRegex = /id\s*=\s*["']([^"']+)["']/g;
        let idMatch;
        while ((idMatch = idRegex.exec(line)) !== null) {
            const statementId = idMatch[1];
            // Calculate the actual position of the id value in the line
            const matchStart = idMatch.index;
            const idValueStart = matchStart + idMatch[0].indexOf(statementId);
            const idValueEnd = idValueStart + statementId.length;

            // Check if cursor is within the id value
            if (position.character >= idValueStart && position.character <= idValueEnd) {
                console.log(`[XmlToJavaDefinitionProvider] Found statement ID: ${statementId} at position ${position.character}`);
                return this.navigateToJavaMethod(document.uri.fsPath, statementId, document, position);
            }
        }

        // Navigation only works when cursor is on id attribute, not anywhere in the statement
        return null;
    }

    /**
     * Navigate to Java interface from XML namespace
     */
    private async navigateToJavaInterface(xmlPath: string): Promise<vscode.Definition | null> {
        // Get corresponding Java file
        const javaPath = await this.fileMapper.getJavaPath(xmlPath);

        if (!javaPath) {
            return null;
        }

        // Find interface declaration line
        const fs = require('fs');
        try {
            const content = await fs.promises.readFile(javaPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match interface declaration
                // Handle multi-line cases like: public interface UserMapper
                //                                 extends BaseMapper {
                const interfaceMatch = line.match(/(?:public\s+)?interface\s+(\w+)/);
                if (interfaceMatch) {
                    const javaUri = vscode.Uri.file(javaPath);

                    // Find the exact position of the interface name
                    const interfaceName = interfaceMatch[1];
                    const nameMatch = line.match(new RegExp(`\\b${interfaceName}\\b`));

                    if (nameMatch && nameMatch.index !== undefined) {
                        const column = nameMatch.index;
                        console.log(`[XmlToJavaDefinitionProvider] Found interface at line ${i}, column ${column}`);
                        return new vscode.Location(javaUri, new vscode.Position(i, column));
                    }

                    // Fallback to line start
                    const javaPosition = new vscode.Position(i, 0);
                    return new vscode.Location(javaUri, javaPosition);
                }
            }

            // If not found, return first line
            const javaUri = vscode.Uri.file(javaPath);
            return new vscode.Location(javaUri, new vscode.Position(0, 0));
        } catch (error) {
            console.error('[XmlToJavaDefinitionProvider] Error finding Java interface:', error);
            return null;
        }
    }

    /**
     * Navigate to Java method from XML statement ID
     * Maps cursor position proportionally from XML id to Java method name
     */
    private async navigateToJavaMethod(
        xmlPath: string,
        methodName: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | null> {
        console.log(`[XmlToJavaDefinitionProvider] Navigating to Java method: ${methodName}`);
        console.log(`[XmlToJavaDefinitionProvider] XML path: ${xmlPath}`);
        console.log(`[XmlToJavaDefinitionProvider] Cursor position in XML: line ${position.line}, char ${position.character}`);

        // Get corresponding Java file
        const javaPath = await this.fileMapper.getJavaPath(xmlPath);
        console.log(`[XmlToJavaDefinitionProvider] Java path: ${javaPath}`);

        if (!javaPath) {
            console.log(`[XmlToJavaDefinitionProvider] No Java file found for XML: ${xmlPath}`);
            return null;
        }

        // Find method position in Java file
        const methodPosition = await findJavaMethodPosition(javaPath, methodName);
        console.log(`[XmlToJavaDefinitionProvider] Java method position:`, methodPosition);

        if (!methodPosition) {
            console.log(`[XmlToJavaDefinitionProvider] Method ${methodName} not found in Java file`);
            return null;
        }

        // Find the XML statement position to calculate cursor offset
        const { findXmlStatementPosition } = await import('../parsers/xmlParser.js');
        const xmlStatementPosition = await findXmlStatementPosition(xmlPath, methodName);

        let targetColumn = methodPosition.startColumn;

        if (xmlStatementPosition) {
            // Calculate cursor offset within the id attribute value in XML
            const xmlLine = document.lineAt(position.line).text;
            const cursorColumn = position.character;

            // If cursor is within the id value range, map it proportionally
            if (cursorColumn >= xmlStatementPosition.startColumn && cursorColumn <= xmlStatementPosition.endColumn) {
                const offsetInXml = cursorColumn - xmlStatementPosition.startColumn;
                const xmlNameLength = xmlStatementPosition.endColumn - xmlStatementPosition.startColumn;
                const javaNameLength = methodPosition.endColumn - methodPosition.startColumn;

                // Map the offset proportionally (or directly if names are same length)
                if (xmlNameLength > 0) {
                    const relativePosition = offsetInXml / xmlNameLength;
                    const mappedOffset = Math.floor(relativePosition * javaNameLength);
                    targetColumn = methodPosition.startColumn + Math.min(mappedOffset, javaNameLength);

                    console.log(`[XmlToJavaDefinitionProvider] Cursor offset in XML: ${offsetInXml}/${xmlNameLength}`);
                    console.log(`[XmlToJavaDefinitionProvider] Mapped to Java offset: ${mappedOffset}/${javaNameLength}`);
                }
            }
        }

        // Return location with mapped cursor position
        const javaUri = vscode.Uri.file(javaPath);
        const javaPosition = new vscode.Position(methodPosition.line, targetColumn);
        console.log(`[XmlToJavaDefinitionProvider] Returning location: ${javaUri.fsPath}:${methodPosition.line}:${targetColumn}`);
        return new vscode.Location(javaUri, javaPosition);
    }
}
