/**
 * Definition provider for navigating from Java to XML
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { findXmlStatementPosition } from '../parsers/xmlParser';
import { extractJavaMethodsFromContent } from '../parsers/javaParser';
import { mapCursorProportionally } from '../../utils/navigationUtils';

/**
 * Provides go-to-definition for:
 * 1. Java mapper methods to jump to XML statements
 * 2. Java interface name to jump to XML mapper tag
 */
export class JavaToXmlDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private fileMapper: FileMapper) { }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        // Get the word at cursor position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;

        // Get corresponding XML file
        const javaPath = document.uri.fsPath;
        const xmlPath = await this.fileMapper.getXmlPath(javaPath);

        if (!xmlPath) {
            return null;
        }

        // Check if this is an interface declaration
        const interfacePattern = /(?:public\s+)?interface\s+\w+/;
        if (interfacePattern.test(line) && line.includes(word)) {
            return this.navigateToXmlMapper(xmlPath, document, position);
        }

        // Check if word is a method name using tree-sitter AST parser (with regex fallback)
        const methods = await extractJavaMethodsFromContent(document.getText());
        const method = methods.find(m => m.name === word);
        if (method) {
            return this.navigateToXmlStatement(xmlPath, word, document, position);
        }

        return null;
    }

    /**
     * Navigate to XML mapper tag (namespace)
     * Finds and returns the location of the <mapper> tag in the corresponding XML file
     */
    private async navigateToXmlMapper(
        xmlPath: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | null> {
        const fs = require('fs');
        try {
            const content = await fs.promises.readFile(xmlPath, 'utf-8');
            const lines = content.split('\n');

            let xmlLocation: vscode.Location | null = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Match <mapper> tag
                if (/<mapper[^>]*namespace/.test(line)) {
                    const xmlUri = vscode.Uri.file(xmlPath);

                    // Find the exact position of the <mapper> opening tag
                    const mapperMatch = line.match(/<mapper/);
                    if (mapperMatch && mapperMatch.index !== undefined) {
                        const column = mapperMatch.index + 1; // Position after '<'
                        console.log(`[JavaToXmlDefinitionProvider] Found mapper tag at line ${i}, column ${column}`);
                        xmlLocation = new vscode.Location(xmlUri, new vscode.Position(i, column));
                    } else {
                        // Fallback to line start
                        const xmlPosition = new vscode.Position(i, 0);
                        xmlLocation = new vscode.Location(xmlUri, xmlPosition);
                    }
                    break;
                }
            }

            // If not found, use first line
            if (!xmlLocation) {
                const xmlUri = vscode.Uri.file(xmlPath);
                xmlLocation = new vscode.Location(xmlUri, new vscode.Position(0, 0));
            }
            return xmlLocation;
        } catch (error) {
            console.error('[JavaToXmlDefinitionProvider] Error finding XML mapper:', error);
            return null;
        }
    }

    /**
     * Navigate to XML statement from Java method
     * Finds the XML statement (select/insert/update/delete) with matching id attribute
     * Maps cursor position proportionally from Java method name to XML id for precise positioning
     */
    private async navigateToXmlStatement(
        xmlPath: string,
        methodName: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | null> {

        // Find statement position in XML file
        const statementPosition = await findXmlStatementPosition(xmlPath, methodName);
        if (!statementPosition) {
            return null;
        }

        // Find the Java method position to calculate cursor offset
        const { findJavaMethodPosition } = await import('../parsers/javaParser.js');
        const javaMethodPosition = await findJavaMethodPosition(document.uri.fsPath, methodName);

        let targetColumn = statementPosition.startColumn;

        if (javaMethodPosition) {
            // Calculate cursor offset within the method name in Java
            const cursorColumn = position.character;

            // If cursor is within the method name range, map it proportionally
            if (cursorColumn >= javaMethodPosition.startColumn && cursorColumn <= javaMethodPosition.endColumn) {
                const offsetInJava = cursorColumn - javaMethodPosition.startColumn;
                const javaNameLength = javaMethodPosition.endColumn - javaMethodPosition.startColumn;
                const xmlNameLength = statementPosition.endColumn - statementPosition.startColumn;

                if (javaNameLength > 0) {
                    targetColumn = mapCursorProportionally(offsetInJava, javaNameLength, statementPosition.startColumn, xmlNameLength);
                }
            }
        }

        // Create XML location
        const xmlUri = vscode.Uri.file(xmlPath);
        const xmlPosition = new vscode.Position(statementPosition.line, targetColumn);
        const xmlLocation = new vscode.Location(xmlUri, xmlPosition);
        return xmlLocation;
    }
}
