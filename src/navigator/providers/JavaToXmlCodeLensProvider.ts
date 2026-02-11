/**
 * CodeLens provider for navigating from Java to XML
 * Provides clickable links above Mapper interfaces and methods
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { extractXmlStatements } from '../parsers/xmlParser';
import { extractJavaMethodsFromContent } from '../parsers/javaParser';

/**
 * Provides CodeLens for:
 * 1. Java mapper interfaces: "↗ Go to MyBatis XML Mapper"
 * 2. Java mapper methods: "↗ Go to MyBatis XML Statement"
 */
export class JavaToXmlCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private fileMapper: FileMapper) { }

    /**
     * Refresh CodeLens display
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        // Check if this Java file has corresponding XML
        const javaPath = document.uri.fsPath;
        const xmlPath = await this.fileMapper.getXmlPath(javaPath);

        if (!xmlPath) {
            return codeLenses;
        }

        // Extract all statement IDs from XML to check if methods exist
        const xmlStatements = await extractXmlStatements(xmlPath);
        const statementIds = new Set(xmlStatements.map(s => s.id));

        const text = document.getText();
        const lines = text.split('\n');

        // Find interface declaration
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match interface declaration (e.g., "public interface UserMapper")
            const interfaceMatch = line.match(/(?:public\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                const range = new vscode.Range(i, 0, i, line.length);

                // Create CodeLens for interface
                codeLenses.push(new vscode.CodeLens(range, {
                    title: 'jumpToXml',
                    command: 'mybatis-boost.jumpToXml',
                    arguments: [document.uri, xmlPath]
                }));
                break;
            }
        }

        // Extract methods using tree-sitter AST parser (with regex fallback)
        const methods = await extractJavaMethodsFromContent(text);

        for (const method of methods) {
            // Only show CodeLens if the statement exists in XML
            if (!statementIds.has(method.name)) {
                continue;
            }

            // Check if the method has MyBatis SQL annotations (@Select, @Insert, @Update, @Delete)
            let hasSqlAnnotation = false;

            // Check the method line itself (same-line annotation case)
            if (/@(Select|Insert|Update|Delete)\s*\(/.test(lines[method.line] || '')) {
                hasSqlAnnotation = true;
            }

            // Look back for annotations directly above this method
            if (!hasSqlAnnotation) {
                for (let j = method.line - 1; j >= Math.max(0, method.line - 10); j--) {
                    const prevLine = lines[j].trim();

                    // Empty line or comment line - continue searching
                    if (prevLine === '' || prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.startsWith('*')) {
                        continue;
                    }

                    // Found SQL annotation - mark and stop
                    if (/@(Select|Insert|Update|Delete)\s*\(/.test(prevLine)) {
                        hasSqlAnnotation = true;
                        break;
                    }

                    // Found other annotation (like @Param, @Nonnull) - continue searching
                    if (prevLine.startsWith('@')) {
                        continue;
                    }

                    // Found other code (method, field, etc.) - stop searching
                    break;
                }
            }

            // Skip methods with SQL annotations (they don't need XML)
            if (hasSqlAnnotation) {
                continue;
            }

            const line = lines[method.line] || '';
            const range = new vscode.Range(method.line, 0, method.line, line.length);

            // Create CodeLens for method
            codeLenses.push(new vscode.CodeLens(range, {
                title: 'jumpToXml',
                command: 'mybatis-boost.jumpToXml',
                arguments: [document.uri, xmlPath, method.name]
            }));
        }

        return codeLenses;
    }

    /**
     * Resolve CodeLens - not needed for our implementation
     */
    resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.CodeLens {
        return codeLens;
    }
}
