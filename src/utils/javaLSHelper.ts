/**
 * Java Language Server helper functions
 * Encapsulates VS Code Java LS API calls for type resolution and field extraction
 */

import * as vscode from 'vscode';
import { JavaField } from '../types';
import { getJavaExtensionAPI } from './javaExtensionAPI';

/**
 * Check if Java Language Server is ready
 */
export async function isJavaLSReady(): Promise<boolean> {
    try {
        const api = await getJavaExtensionAPI();
        if (!api) {
            return false;
        }
        await Promise.race([
            api.serverReady(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 5000)
            )
        ]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolve a simple type name to its fully-qualified name using Java Language Server
 * Uses workspace symbol search to find matching class/interface definitions
 *
 * @returns Fully-qualified class name or null if not found / LS unavailable
 */
export async function resolveTypeViaLS(simpleTypeName: string): Promise<string | null> {
    try {
        if (!await isJavaLSReady()) {
            return null;
        }

        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            simpleTypeName
        );

        if (!symbols || symbols.length === 0) {
            return null;
        }

        // Filter for class/interface/enum symbols with exact name match
        for (const symbol of symbols) {
            if (
                (symbol.kind === vscode.SymbolKind.Class ||
                 symbol.kind === vscode.SymbolKind.Interface ||
                 symbol.kind === vscode.SymbolKind.Enum) &&
                symbol.name === simpleTypeName
            ) {
                // containerName is the package name
                if (symbol.containerName) {
                    return `${symbol.containerName}.${symbol.name}`;
                }
            }
        }

        return null;
    } catch (error) {
        console.warn('[javaLSHelper] resolveTypeViaLS failed:', error);
        return null;
    }
}

/**
 * Get class fields using Java Language Server document symbol provider
 *
 * @param classFilePath - Path to the Java file
 * @param className - When given, only the matching class symbol's fields are
 *                    returned, so other types in the same file are excluded
 * @returns Array of JavaField or null if LS unavailable
 */
export async function getClassFieldsViaLS(
    classFilePath: string,
    className?: string
): Promise<JavaField[] | null> {
    try {
        if (!await isJavaLSReady()) {
            return null;
        }

        const uri = vscode.Uri.file(classFilePath);
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            uri
        );

        if (!symbols || symbols.length === 0) {
            return null;
        }

        const fields: JavaField[] = [];

        // DocumentSymbol is hierarchical - fields are children of class symbols
        for (const symbol of symbols) {
            if (className && symbol.name !== className) {
                continue;
            }
            if (
                symbol.kind === vscode.SymbolKind.Class ||
                symbol.kind === vscode.SymbolKind.Interface
            ) {
                for (const child of symbol.children || []) {
                    if (child.kind === vscode.SymbolKind.Field) {
                        fields.push({
                            name: child.name,
                            fieldType: child.detail || 'unknown',
                            line: child.selectionRange.start.line,
                            startColumn: child.selectionRange.start.character,
                            endColumn: child.selectionRange.end.character
                        });
                    }
                }
            }
        }

        return fields.length > 0 ? fields : null;
    } catch (error) {
        console.warn('[javaLSHelper] getClassFieldsViaLS failed:', error);
        return null;
    }
}
