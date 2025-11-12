/**
 * MyBatis XML Formatting Provider
 * Provides document formatting for MyBatis Mapper XML files
 * Triggered by Alt+Shift+F (or Cmd+Shift+F on Mac) in VS Code
 */

import * as vscode from 'vscode';
import { MybatisSqlFormatter, FormatterOptions } from './MybatisSqlFormatter';

/**
 * Information about a MyBatis statement tag
 */
interface StatementTagInfo {
    /** Tag type (select, insert, update, delete) */
    type: 'select' | 'insert' | 'update' | 'delete';
    /** Start position of the tag content (after opening tag) */
    contentStart: vscode.Position;
    /** End position of the tag content (before closing tag) */
    contentEnd: vscode.Position;
    /** Original SQL content */
    content: string;
    /** Base indentation of the statement tag */
    baseIndent: string;
}

/**
 * MyBatis XML Formatting Provider
 * Formats SQL content inside MyBatis statement tags (<select>, <insert>, <update>, <delete>)
 * while preserving XML structure, dynamic tags, and CDATA blocks
 */
export class MybatisXmlFormattingProvider implements vscode.DocumentFormattingEditProvider {
    private readonly formatter: MybatisSqlFormatter;

    /**
     * Statement tag types that should be formatted
     */
    private readonly STATEMENT_TAGS = ['select', 'insert', 'update', 'delete'];

    constructor() {
        this.formatter = new MybatisSqlFormatter();
    }

    /**
     * Provide formatting edits for the document
     * Called when user triggers format document (Alt+Shift+F)
     *
     * @param document - The document to format
     * @param options - Formatting options from VS Code
     * @param token - Cancellation token
     * @returns Array of text edits to apply
     */
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        // Check if this is a MyBatis mapper XML file
        if (!this.isMybatisMapperXml(document)) {
            return [];
        }

        // Extract all statement tags and format their content
        const edits = this.formatStatementTags(document, options);

        return edits;
    }

    /**
     * Check if the document is a MyBatis mapper XML file
     * Verifies by checking for mapper namespace declaration
     *
     * @param document - Document to check
     * @returns True if this is a MyBatis mapper XML file
     */
    private isMybatisMapperXml(document: vscode.TextDocument): boolean {
        // Must be an XML file
        if (document.languageId !== 'xml') {
            return false;
        }

        const text = document.getText();

        // Check for MyBatis mapper namespace
        // Example: <mapper namespace="com.example.UserMapper">
        const mapperPattern = /<mapper\s+namespace\s*=\s*["'][^"']+["']/;

        return mapperPattern.test(text);
    }

    /**
     * Format all statement tags in the document
     * Extracts SQL content from <select>, <insert>, <update>, <delete> tags
     * and applies formatting while preserving dynamic SQL tags
     *
     * @param document - Document to format
     * @param options - Formatting options
     * @returns Array of text edits
     */
    private formatStatementTags(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();

        // Find all statement tags
        const statements = this.extractStatementTags(document);

        // Get formatter options
        const formatterOptions = this.getFormatterOptions(document, options);

        // Format each statement tag
        for (const statement of statements) {
            // Skip if content is in CDATA block
            if (this.isInCDataBlock(statement.content)) {
                continue;
            }

            // Skip if content is empty or whitespace only
            const trimmedContent = statement.content.trim();
            if (trimmedContent.length === 0) {
                continue;
            }

            // Format the SQL content
            const formatted = this.formatter.format(trimmedContent, formatterOptions);

            // Build the new content with proper indentation
            // Style: First line of SQL should be on a new line after opening tag
            const newContent = this.buildFormattedContent(formatted, statement.baseIndent, options);

            // Create text edit
            const range = new vscode.Range(statement.contentStart, statement.contentEnd);
            const edit = vscode.TextEdit.replace(range, newContent);
            edits.push(edit);
        }

        return edits;
    }

    /**
     * Extract all statement tags from the document
     * Finds <select>, <insert>, <update>, <delete> tags and their content
     *
     * @param document - Document to parse
     * @returns Array of statement tag information
     */
    private extractStatementTags(document: vscode.TextDocument): StatementTagInfo[] {
        const statements: StatementTagInfo[] = [];
        const text = document.getText();

        // Build regex pattern for statement tags
        // Matches: <select ...>content</select>
        for (const tagType of this.STATEMENT_TAGS) {
            const pattern = new RegExp(
                `<${tagType}\\s+[^>]*>([\\s\\S]*?)</${tagType}>`,
                'gi'
            );

            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const fullMatch = match[0];
                const content = match[1];
                const matchStart = match.index;

                // Calculate the position of the content (after opening tag)
                const openingTagEnd = matchStart + fullMatch.indexOf('>') + 1;
                const contentStart = document.positionAt(openingTagEnd);

                // Calculate the position of the closing tag (before </tagType>)
                const closingTagStart = matchStart + fullMatch.lastIndexOf(`</${tagType}>`);
                const contentEnd = document.positionAt(closingTagStart);

                // Get base indentation of the statement tag line
                const tagLine = document.lineAt(document.positionAt(matchStart));
                const baseIndent = tagLine.text.match(/^\s*/)?.[0] || '';

                statements.push({
                    type: tagType as any,
                    contentStart,
                    contentEnd,
                    content,
                    baseIndent
                });
            }
        }

        return statements;
    }

    /**
     * Check if content is inside a CDATA block
     * CDATA blocks should not be formatted
     *
     * @param content - Content to check
     * @returns True if content is in CDATA block
     */
    private isInCDataBlock(content: string): boolean {
        const trimmed = content.trim();
        return trimmed.startsWith('<![CDATA[') && trimmed.endsWith(']]>');
    }

    /**
     * Build formatted content with proper indentation
     * Ensures first line of SQL is on a new line after opening tag (as per requirement)
     *
     * @param formatted - Formatted SQL content
     * @param baseIndent - Base indentation of the statement tag
     * @param options - Formatting options
     * @returns Final formatted content to insert
     */
    private buildFormattedContent(
        formatted: string,
        baseIndent: string,
        options: vscode.FormattingOptions
    ): string {
        // Calculate content indentation (one level deeper than tag)
        const indentChar = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        const contentIndent = baseIndent + indentChar;

        // Split formatted content into lines
        const lines = formatted.split('\n');

        // Indent each line
        const indentedLines = lines.map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0) {
                return '';
            }
            return contentIndent + trimmedLine;
        });

        // Build final content: newline + indented SQL + newline + closing tag indent
        // Example:
        // <select id="xxx">
        //   SELECT * FROM user
        // </select>
        return '\n' + indentedLines.join('\n') + '\n' + baseIndent;
    }

    /**
     * Get formatter options from VS Code configuration
     * Reads settings from mybatis-boost.formatter.* configuration
     *
     * @param document - Document being formatted
     * @param options - VS Code formatting options
     * @returns Formatter options
     */
    private getFormatterOptions(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): FormatterOptions {
        const config = vscode.workspace.getConfiguration('mybatis-boost.formatter');

        // Get user configuration or use defaults
        const keywordCase = config.get<'upper' | 'lower' | 'preserve'>('keywordCase', 'upper');
        const indentStyle = config.get<'standard' | 'tabularLeft' | 'tabularRight'>('indentStyle', 'standard');
        const denseOperators = config.get<boolean>('denseOperators', false);

        // Tab width from VS Code settings or user configuration
        const tabWidth = config.get<number>('tabWidth', options.tabSize);

        // Auto-detect SQL dialect or use configured value
        let language = config.get<string>('language', '');
        if (!language || language === 'auto') {
            // Try to detect from document content
            const text = document.getText();
            language = this.formatter.detectDialect(text);
        }

        return {
            language,
            keywordCase,
            tabWidth,
            indentStyle,
            denseOperators
        };
    }
}
