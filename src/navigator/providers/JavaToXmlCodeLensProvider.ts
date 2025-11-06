/**
 * CodeLens provider for navigating from Java to XML
 * Provides clickable links above Mapper interfaces and methods
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';

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
            }

            // Match method declarations
            // Handle both single-line and multi-line methods:
            // User selectById(Long id);
            // User selectByIdAndName(
            //     @Param("id") Long id);
            const methodMatch = line.match(/(\w+)\s+(\w+)\s*\(/);
            if (methodMatch) {
                const methodName = methodMatch[2];

                // Verify this is a method (not a constructor or other constructs)
                if (!line.includes('class ') && !line.includes('interface ')) {
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
