/**
 * Dynamic SQL Highlighter
 * Highlights SQL keywords inside MyBatis dynamic SQL tags
 */

import * as vscode from 'vscode';
import { readFile } from '../utils/fileUtils';

/**
 * SQL keywords to highlight (case-insensitive)
 */
const SQL_KEYWORDS = [
    'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN',
    'WHERE', 'SET', 'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'INTO',
    'AS', 'DISTINCT', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'ASC', 'DESC', 'UNION', 'ALL', 'ANY', 'SOME', 'FOR'
];

/**
 * MyBatis dynamic SQL tags to process
 */
const DYNAMIC_SQL_TAGS = [
    'if', 'where', 'set', 'foreach', 'choose', 'when', 'otherwise', 'trim'
];

/**
 * MyBatis SQL statement tags to process
 */
const SQL_STATEMENT_TAGS = [
    'select', 'insert', 'update', 'delete', 'sql'
];

/**
 * Highlighter for SQL keywords in dynamic SQL tags
 */
export class DynamicSqlHighlighter {
    private decorationType: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // Get color from configuration (default: IDEA style orange)
        const config = vscode.workspace.getConfiguration('mybatis-boost');
        const keywordColor = config.get<string>('dynamicSqlKeywordColor') || '#CC7832';

        // Create decoration type with configured color
        this.decorationType = vscode.window.createTextEditorDecorationType({
            color: keywordColor,
            fontWeight: 'bold'
        });

        // Register event listeners
        this.registerListeners();

        // Highlight all visible editors on startup
        vscode.window.visibleTextEditors.forEach(editor => {
            this.highlightEditor(editor);
        });
    }

    /**
     * Register event listeners for automatic highlighting updates
     */
    private registerListeners(): void {
        // Highlight when active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.highlightEditor(editor);
                }
            })
        );

        // Highlight when document content changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document.uri.toString() === event.document.uri.toString()
                );
                if (editor) {
                    this.highlightEditor(editor);
                }
            })
        );

        // Highlight when visible editors change
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors(editors => {
                editors.forEach(editor => this.highlightEditor(editor));
            })
        );

        // Re-create decoration type when configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('mybatis-boost.dynamicSqlKeywordColor')) {
                    // Dispose old decoration type
                    this.decorationType.dispose();

                    // Get new color from configuration
                    const config = vscode.workspace.getConfiguration('mybatis-boost');
                    const keywordColor = config.get<string>('dynamicSqlKeywordColor') || '#CC7832';

                    // Create new decoration type with updated color
                    this.decorationType = vscode.window.createTextEditorDecorationType({
                        color: keywordColor,
                        fontWeight: 'bold'
                    });

                    // Refresh all visible editors
                    this.refresh();
                }
            })
        );
    }

    /**
     * Highlight SQL keywords in editor if it's a MyBatis Mapper XML
     */
    private async highlightEditor(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;

        // Only process XML files
        if (!document.fileName.endsWith('.xml')) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        // Verify this is a MyBatis Mapper XML
        if (!await this.isMybatisMapperXml(document)) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        // Find and highlight SQL keywords in dynamic tags
        const decorations = this.findSqlKeywords(document);
        editor.setDecorations(this.decorationType, decorations);
    }

    /**
     * Check if document is a MyBatis Mapper XML file
     */
    private async isMybatisMapperXml(document: vscode.TextDocument): Promise<boolean> {
        try {
            const content = document.getText();
            // Check for <mapper> root tag with namespace attribute
            return /<mapper[^>]+namespace\s*=\s*["'][^"']+["']/.test(content);
        } catch (error) {
            return false;
        }
    }

    /**
     * Find SQL keywords inside dynamic SQL tags and statement tags
     * Made public for testing purposes
     */
    public findSqlKeywords(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();

        // Process both SQL statement tags and dynamic SQL tags
        const allTags = [...SQL_STATEMENT_TAGS, ...DYNAMIC_SQL_TAGS];
        const tagPattern = allTags.join('|');
        const tagRegex = new RegExp(`<(${tagPattern})([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');

        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            const tagName = match[1];
            const attributes = match[2];
            const content = match[3];
            const contentStart = match.index + match[0].indexOf('>') + 1;

            // Skip OGNL expressions in attributes (test="...")
            // Only process the tag content between opening and closing tags

            // Find SQL keywords in content
            const keywordDecorations = this.findKeywordsInContent(
                content,
                contentStart,
                document
            );

            decorations.push(...keywordDecorations);
        }

        return decorations;
    }

    /**
     * Find SQL keywords in content and return decoration options
     * Made public for testing purposes
     */
    public findKeywordsInContent(
        content: string,
        startOffset: number,
        document: vscode.TextDocument
    ): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];

        // Create regex pattern for SQL keywords (word boundaries)
        for (const keyword of SQL_KEYWORDS) {
            const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
            let match;

            while ((match = keywordRegex.exec(content)) !== null) {
                const matchStart = startOffset + match.index;
                const matchEnd = matchStart + match[0].length;

                // Convert offset to position
                const startPos = document.positionAt(matchStart);
                const endPos = document.positionAt(matchEnd);

                // Skip if inside OGNL expression markers (#{...} or ${...})
                if (this.isInsideOgnlExpression(content, match.index)) {
                    continue;
                }

                // Skip if inside XML tag attributes (e.g., test="category != null")
                if (this.isInsideXmlTag(content, match.index)) {
                    continue;
                }

                decorations.push({
                    range: new vscode.Range(startPos, endPos)
                });
            }
        }

        return decorations;
    }

    /**
     * Check if position is inside OGNL expression (#{...} or ${...})
     * Made public for testing purposes
     */
    public isInsideOgnlExpression(content: string, position: number): boolean {
        // Find all OGNL expressions before this position
        const beforeContent = content.substring(0, position);

        // Count opening and closing braces
        let inExpression = false;
        let i = 0;

        while (i < beforeContent.length) {
            // Check for #{ or ${
            if ((beforeContent[i] === '#' || beforeContent[i] === '$') &&
                i + 1 < beforeContent.length && beforeContent[i + 1] === '{') {
                inExpression = true;
                i += 2;
                continue;
            }

            // Check for closing }
            if (beforeContent[i] === '}' && inExpression) {
                inExpression = false;
            }

            i++;
        }

        return inExpression;
    }

    /**
     * Check if position is inside XML tag (including attributes)
     * Made public for testing purposes
     */
    public isInsideXmlTag(content: string, position: number): boolean {
        // Find the content before this position
        const beforeContent = content.substring(0, position);

        // Find the last < and > before this position
        const lastOpenBracket = beforeContent.lastIndexOf('<');
        const lastCloseBracket = beforeContent.lastIndexOf('>');

        // If the last < is after the last >, we're inside a tag (including attributes)
        return lastOpenBracket > lastCloseBracket;
    }

    /**
     * Refresh highlighting for all visible editors
     */
    public refresh(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            this.highlightEditor(editor);
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
