/**
 * CodeLens provider for navigating from Java to XML
 * Provides clickable links above Mapper interfaces and methods
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { extractXmlStatements } from '../parsers/xmlParser';

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
                const interfaceName = interfaceMatch[1];
                const range = new vscode.Range(i, 0, i, line.length);

                // Create CodeLens for interface
                codeLenses.push(new vscode.CodeLens(range, {
                    title: '↗ Go to MyBatis XML Mapper',
                    command: 'mybatis-boost.goToXmlMapper',
                    arguments: [document.uri, xmlPath]
                }));
                continue;
            }

            // Match method declarations
            // Need to handle:
            // 1. Simple types: User selectById(Long id);
            // 2. Generic types: List<User> listAllByIds(List<Long> ids);
            // 3. Multi-line: User selectByIdAndName(
            //                    @Param("id") Long id);

            // Match pattern: any word (including after >) followed by method name and (
            // This handles both "User methodName(" and "List<User> methodName("
            const methodMatch = line.match(/>\s+(\w+)\s*\(|^\s*(\w+)\s+(\w+)\s*\(/);

            if (methodMatch) {
                // Extract method name from either capture group
                const methodName = methodMatch[1] || methodMatch[3];

                if (!methodName) {
                    continue;
                }

                // Skip if this line contains class or interface keywords
                if (line.includes('class ') || line.includes('interface ')) {
                    continue;
                }

                // Check if the method has MyBatis SQL annotations (@Select, @Insert, @Update, @Delete)
                // Look back only for annotations directly above this method (stop at code or empty lines)
                let hasSqlAnnotation = false;
                for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
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
                    // This means we've reached a different method/code block
                    break;
                }

                // Skip methods with SQL annotations (they don't need XML)
                if (hasSqlAnnotation) {
                    continue;
                }

                // Look ahead to find the end of the method signature
                let endLine = i;
                let foundEnd = line.includes(';') || line.includes(')');

                if (!foundEnd) {
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        if (lines[j].includes(';') || lines[j].includes('}')) {
                            endLine = j;
                            foundEnd = true;
                            break;
                        }
                    }
                }

                if (foundEnd) {
                    // Only show CodeLens if the statement exists in XML
                    if (!statementIds.has(methodName)) {
                        continue;
                    }

                    const range = new vscode.Range(i, 0, i, line.length);

                    // Create CodeLens for method
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: '↗ Go to MyBatis XML Statement',
                        command: 'mybatis-boost.goToXmlStatement',
                        arguments: [document.uri, xmlPath, methodName]
                    }));
                }
            }
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
