/**
 * MyBatis Binding Decorator
 * Shows gutter icons for Java methods and XML statements that are bound together
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileMapper } from '../navigator/core/FileMapper';
import { extractJavaMethods } from '../navigator/parsers/javaParser';
import { extractXmlStatements } from '../navigator/parsers/xmlParser';
import { normalizePath } from '../utils/fileUtils';

export class MybatisBindingDecorator {
    private decorationType: vscode.TextEditorDecorationType;
    private fileMapper: FileMapper;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext, fileMapper: FileMapper) {
        this.fileMapper = fileMapper;

        // Create decoration type with gutter icon
        const iconPath = vscode.Uri.file(
            path.join(context.extensionPath, 'images', 'icons', 'MyBatis-line.svg')
        );

        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: iconPath,
            gutterIconSize: 'contain'
        });

        // Register event listeners
        this.registerListeners();

        // Decorate all visible editors on startup
        vscode.window.visibleTextEditors.forEach(editor => {
            this.decorateEditor(editor);
        });
    }

    /**
     * Register event listeners for automatic decoration updates
     */
    private registerListeners(): void {
        // Decorate when active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.decorateEditor(editor);
                }
            })
        );

        // Decorate when document is saved (content may have changed)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(document => {
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document.uri.toString() === document.uri.toString()
                );
                if (editor) {
                    this.decorateEditor(editor);
                }
            })
        );

        // Decorate when visible editors change
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors(editors => {
                editors.forEach(editor => this.decorateEditor(editor));
            })
        );
    }

    /**
     * Decorate an editor based on file type
     */
    private async decorateEditor(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const filePath = document.uri.fsPath;

        // Only decorate Java and XML files
        if (filePath.endsWith('.java')) {
            await this.decorateJavaFile(editor);
        } else if (filePath.endsWith('.xml')) {
            await this.decorateXmlFile(editor);
        }
    }

    /**
     * Decorate Java file - show icons for methods that have XML bindings
     */
    private async decorateJavaFile(editor: vscode.TextEditor): Promise<void> {
        const filePath = editor.document.uri.fsPath;
        const decorations: vscode.DecorationOptions[] = [];

        try {
            // Check if this Java file has a mapping
            const xmlPath = await this.fileMapper.getXmlPath(filePath);
            if (!xmlPath) {
                // No XML mapping, clear decorations
                editor.setDecorations(this.decorationType, []);
                return;
            }

            // Extract Java methods from current file
            const javaMethods = await extractJavaMethods(filePath);

            // Extract XML statements from mapped XML file
            const xmlStatements = await extractXmlStatements(xmlPath);

            // Create a set of XML statement IDs for quick lookup
            const xmlStatementIds = new Set(xmlStatements.map(s => s.id));

            // Find Java methods that have corresponding XML statements
            for (const method of javaMethods) {
                if (xmlStatementIds.has(method.name)) {
                    // This method has a binding, add decoration
                    const range = new vscode.Range(
                        new vscode.Position(method.line, method.startColumn),
                        new vscode.Position(method.line, method.endColumn)
                    );

                    decorations.push({
                        range,
                        hoverMessage: `MyBatis binding: ${method.name} ↔ ${path.basename(xmlPath)}`
                    });
                }
            }

            // Apply decorations
            editor.setDecorations(this.decorationType, decorations);
            console.log(`[MybatisBindingDecorator] Decorated ${decorations.length} Java methods in ${path.basename(filePath)}`);
        } catch (error) {
            console.error('[MybatisBindingDecorator] Error decorating Java file:', error);
            editor.setDecorations(this.decorationType, []);
        }
    }

    /**
     * Decorate XML file - show icons for statements that have Java method bindings
     */
    private async decorateXmlFile(editor: vscode.TextEditor): Promise<void> {
        const filePath = editor.document.uri.fsPath;
        const decorations: vscode.DecorationOptions[] = [];

        try {
            // Check if this XML file has a mapping
            const javaPath = await this.fileMapper.getJavaPath(filePath);
            if (!javaPath) {
                // No Java mapping, clear decorations
                editor.setDecorations(this.decorationType, []);
                return;
            }

            // Extract XML statements from current file
            const xmlStatements = await extractXmlStatements(filePath);

            // Extract Java methods from mapped Java file
            const javaMethods = await extractJavaMethods(javaPath);

            // Create a set of Java method names for quick lookup
            const javaMethodNames = new Set(javaMethods.map(m => m.name));

            // Find XML statements that have corresponding Java methods
            for (const statement of xmlStatements) {
                if (javaMethodNames.has(statement.id)) {
                    // This statement has a binding, add decoration
                    const range = new vscode.Range(
                        new vscode.Position(statement.line, statement.startColumn),
                        new vscode.Position(statement.line, statement.endColumn)
                    );

                    decorations.push({
                        range,
                        hoverMessage: `MyBatis binding: ${statement.id} ↔ ${path.basename(javaPath)}`
                    });
                }
            }

            // Apply decorations
            editor.setDecorations(this.decorationType, decorations);
            console.log(`[MybatisBindingDecorator] Decorated ${decorations.length} XML statements in ${path.basename(filePath)}`);
        } catch (error) {
            console.error('[MybatisBindingDecorator] Error decorating XML file:', error);
            editor.setDecorations(this.decorationType, []);
        }
    }

    /**
     * Refresh decorations for all visible editors
     */
    public refresh(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            this.decorateEditor(editor);
        });
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
