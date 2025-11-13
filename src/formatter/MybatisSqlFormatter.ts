/**
 * MyBatis SQL Formatter
 * Formats SQL content inside MyBatis statement tags while preserving dynamic SQL tags
 *
 * Strategy: CST-based formatting for proper nested tag indentation
 * 1. Parse SQL and dynamic tags into CST (Concrete Syntax Tree)
 * 2. Format SQL nodes using sql-formatter
 * 3. Render CST back to text with proper indentation
 */

import { format, FormatOptionsWithLanguage, SqlLanguage } from 'sql-formatter';

/**
 * Formatter configuration options
 */
export interface FormatterOptions {
    /** SQL dialect (mysql, postgresql, oracle, tsql, etc.) */
    language?: string;
    /** Keyword case: 'upper' | 'lower' | 'preserve' */
    keywordCase?: 'upper' | 'lower' | 'preserve';
    /** Indentation width (default: 2 spaces for IDEA style) */
    tabWidth?: number;
    /** Indentation style */
    indentStyle?: 'standard' | 'tabularLeft' | 'tabularRight';
    /** Dense operators (no spaces around operators) */
    denseOperators?: boolean;
}

/**
 * CST Node Types
 */
interface CSTNode {
    type: 'root' | 'tag' | 'sql' | 'param';
    start: number;
    end: number;
}

interface RootNode extends CSTNode {
    type: 'root';
    children: CSTNode[];
}

interface TagNode extends CSTNode {
    type: 'tag';
    tagName: string;
    attributes: Map<string, string>;
    selfClosing: boolean;
    children: CSTNode[];
}

interface SqlNode extends CSTNode {
    type: 'sql';
    content: string;
}

interface ParamNode extends CSTNode {
    type: 'param';
    paramType: '#' | '$';
    expression: string;
}

/**
 * CST Parser for MyBatis SQL
 */
class MybatisSqlParser {
    private input: string = '';
    private position: number = 0;
    private length: number = 0;
    private dynamicTags: string[];

    constructor(dynamicTags: string[]) {
        this.dynamicTags = dynamicTags;
    }

    public parse(input: string): RootNode {
        this.input = input;
        this.position = 0;
        this.length = input.length;

        const children = this.parseNodes();

        return {
            type: 'root',
            start: 0,
            end: this.length,
            children
        };
    }

    private parseNodes(): CSTNode[] {
        const nodes: CSTNode[] = [];

        while (this.position < this.length) {
            const char = this.input[this.position];

            if (char === '<') {
                if (this.peek(1) === '/') {
                    break; // Closing tag
                }

                const tag = this.parseTag();
                if (tag) {
                    nodes.push(tag);
                } else {
                    const text = this.parseText();
                    if (text) nodes.push(text);
                }
            } else if (char === '#' || char === '$') {
                const param = this.parseParam();
                if (param) {
                    nodes.push(param);
                } else {
                    const text = this.parseText();
                    if (text) nodes.push(text);
                }
            } else {
                const text = this.parseText();
                if (text) nodes.push(text);
            }
        }

        return nodes;
    }

    private parseTag(): TagNode | null {
        const start = this.position;

        if (this.input[this.position] !== '<') {
            return null;
        }

        this.position++; // Skip '<'

        const tagName = this.parseTagName();
        if (!tagName || !this.dynamicTags.includes(tagName.toLowerCase())) {
            this.position = start;
            return null;
        }

        const attributes = this.parseAttributes();

        this.skipWhitespace();

        // Self-closing tag
        if (this.peek() === '/' && this.peek(1) === '>') {
            this.position += 2;
            return {
                type: 'tag',
                tagName,
                attributes,
                selfClosing: true,
                children: [],
                start,
                end: this.position
            };
        }

        // Opening tag
        if (this.peek() === '>') {
            this.position++;

            const children = this.parseNodes();

            // Closing tag
            this.skipWhitespace();
            if (this.peek() === '<' && this.peek(1) === '/') {
                this.position += 2;
                const closingTagName = this.parseTagName();

                if (closingTagName.toLowerCase() !== tagName.toLowerCase()) {
                    throw new Error(`Mismatched closing tag: expected </${tagName}>, got </${closingTagName}>`);
                }

                this.skipWhitespace();
                if (this.peek() === '>') {
                    this.position++;
                }
            }

            return {
                type: 'tag',
                tagName,
                attributes,
                selfClosing: false,
                children,
                start,
                end: this.position
            };
        }

        this.position = start;
        return null;
    }

    private parseTagName(): string {
        this.skipWhitespace();
        const start = this.position;

        while (this.position < this.length) {
            const char = this.input[this.position];
            if (/[a-zA-Z0-9_-]/.test(char)) {
                this.position++;
            } else {
                break;
            }
        }

        return this.input.substring(start, this.position);
    }

    private parseAttributes(): Map<string, string> {
        const attributes = new Map<string, string>();

        while (this.position < this.length) {
            this.skipWhitespace();

            const char = this.peek();
            if (char === '>' || char === '/') {
                break;
            }

            // Parse attribute name
            const nameStart = this.position;
            while (this.position < this.length && /[a-zA-Z0-9_-]/.test(this.input[this.position])) {
                this.position++;
            }
            const name = this.input.substring(nameStart, this.position);

            if (!name) break;

            this.skipWhitespace();

            if (this.peek() !== '=') break;
            this.position++;

            this.skipWhitespace();

            const quote = this.peek();
            if (quote !== '"' && quote !== "'") break;
            this.position++;

            const valueStart = this.position;
            while (this.position < this.length && this.input[this.position] !== quote) {
                this.position++;
            }
            const value = this.input.substring(valueStart, this.position);

            if (this.peek() === quote) {
                this.position++;
            }

            attributes.set(name, value);
        }

        return attributes;
    }

    private parseParam(): ParamNode | null {
        const start = this.position;
        const paramType = this.input[this.position] as '#' | '$';

        if ((paramType !== '#' && paramType !== '$') || this.peek(1) !== '{') {
            return null;
        }

        this.position += 2; // Skip '#{' or '${'

        let depth = 1;
        const exprStart = this.position;

        while (this.position < this.length && depth > 0) {
            const char = this.input[this.position];
            if (char === '{') depth++;
            else if (char === '}') depth--;
            this.position++;
        }

        const expression = this.input.substring(exprStart, this.position - 1);

        return {
            type: 'param',
            paramType,
            expression,
            start,
            end: this.position
        };
    }

    private parseText(): SqlNode | null {
        const start = this.position;
        let content = '';

        while (this.position < this.length) {
            const char = this.input[this.position];

            if (char === '<') {
                if (this.peek(1) === '/') break; // Closing tag
                // Check if it's a valid tag
                const savedPos = this.position;
                this.position++;
                const tagName = this.parseTagName();
                this.position = savedPos;
                if (this.dynamicTags.includes(tagName.toLowerCase())) break;
            }

            if ((char === '#' || char === '$') && this.peek(1) === '{') {
                break; // Parameter
            }

            content += char;
            this.position++;
        }

        if (content.length === 0) return null;

        return {
            type: 'sql',
            content,
            start,
            end: this.position
        };
    }

    private peek(offset: number = 0): string {
        const pos = this.position + offset;
        return pos < this.length ? this.input[pos] : '';
    }

    private skipWhitespace(): void {
        while (this.position < this.length && /\s/.test(this.input[this.position])) {
            this.position++;
        }
    }
}

/**
 * CST Formatter
 */
class MybatisCstFormatter {
    /**
     * Format CST to string
     */
    public format(root: RootNode, options: FormatOptionsWithLanguage): string {
        return this.formatNode(root, 0, options);
    }

    private formatNode(node: CSTNode, depth: number, options: FormatOptionsWithLanguage): string {
        switch (node.type) {
            case 'root':
                return this.formatRoot(node as RootNode, depth, options);
            case 'tag':
                return this.formatTag(node as TagNode, depth, options);
            case 'sql':
                return this.formatSql(node as SqlNode, depth, options);
            case 'param':
                return this.formatParam(node as ParamNode);
            default:
                return '';
        }
    }

    private formatRoot(node: RootNode, depth: number, options: FormatOptionsWithLanguage): string {
        return node.children
            .map(child => this.formatNode(child, depth, options))
            .join('');
    }

    private formatTag(node: TagNode, depth: number, options: FormatOptionsWithLanguage): string {
        const indent = this.getIndent(depth, options.tabWidth || 4);
        const tagName = node.tagName;

        // Format attributes
        const attrs = Array.from(node.attributes.entries())
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
        const attrString = attrs ? ' ' + attrs : '';

        if (node.selfClosing) {
            return `\n${indent}<${tagName}${attrString}/>`;
        }

        // Format children with increased depth
        const childrenFormatted = node.children
            .map(child => this.formatNode(child, depth + 1, options))
            .join('');

        // Check if children contain only inline content (no nested tags)
        const hasNestedTags = node.children.some(child => child.type === 'tag');

        if (hasNestedTags) {
            // Multi-line format with nested tags - preserve all formatting including leading newlines
            return `\n${indent}<${tagName}${attrString}>${childrenFormatted}\n${indent}</${tagName}>`;
        } else {
            // Format for content without nested tags
            const trimmedChildren = childrenFormatted.trim();
            if (trimmedChildren.length < 80) {
                // Short inline content
                return `\n${indent}<${tagName}${attrString}>\n${this.getIndent(depth + 1, options.tabWidth || 4)}${trimmedChildren}\n${indent}</${tagName}>`;
            } else {
                // Long content
                return `\n${indent}<${tagName}${attrString}>${childrenFormatted}\n${indent}</${tagName}>`;
            }
        }
    }

    private formatSql(node: SqlNode, depth: number, options: FormatOptionsWithLanguage): string {
        const indent = this.getIndent(depth, options.tabWidth || 4);
        const sql = node.content.trim();

        if (!sql) return '';

        try {
            // Format SQL using sql-formatter
            const formatted = format(sql, options);

            // Add indentation to each line
            const lines = formatted.split('\n');
            const indentedLines = lines.map((line, index) => {
                if (index === 0) {
                    return `\n${indent}${line}`;
                }
                return `${indent}${line}`;
            });

            return indentedLines.join('\n');
        } catch (error) {
            // If formatting fails, just indent the original content
            return `\n${indent}${sql}`;
        }
    }

    private formatParam(node: ParamNode): string {
        return `${node.paramType}{${node.expression}}`;
    }

    private getIndent(depth: number, tabWidth: number): string {
        return ' '.repeat(depth * tabWidth);
    }
}

/**
 * MyBatis SQL Formatter
 * Handles SQL formatting with dynamic tag preservation using CST
 */
export class MybatisSqlFormatter {
    /**
     * MyBatis dynamic SQL tags that need to be preserved during formatting
     */
    private readonly DYNAMIC_TAGS = [
        'if', 'choose', 'when', 'otherwise', 'foreach',
        'where', 'set', 'trim', 'bind', 'include', 'property'
    ];

    /**
     * Default formatter options matching IDEA's default SQL formatting style
     */
    private readonly DEFAULT_OPTIONS: FormatOptionsWithLanguage = {
        language: 'mysql',
        keywordCase: 'upper',
        tabWidth: 4,
        indentStyle: 'standard',
        logicalOperatorNewline: 'before',
        denseOperators: false,
        newlineBeforeSemicolon: false,
        linesBetweenQueries: 1
    };

    /**
     * CST Parser and Formatter
     */
    private parser: MybatisSqlParser;
    private cstFormatter: MybatisCstFormatter;

    constructor() {
        this.parser = new MybatisSqlParser(this.DYNAMIC_TAGS);
        this.cstFormatter = new MybatisCstFormatter();
    }

    /**
     * Format SQL content with dynamic tag preservation
     *
     * @param sqlContent - Raw SQL content from MyBatis statement tag
     * @param options - Optional formatter configuration
     * @returns Formatted SQL content with preserved dynamic tags
     */
    public format(sqlContent: string, options?: FormatterOptions): string {
        // Return empty string if input is empty or whitespace only
        if (!sqlContent || sqlContent.trim().length === 0) {
            return sqlContent;
        }

        try {
            // Build formatter options
            const formatterOptions = this.buildFormatterOptions(options);

            // Step 1: Parse SQL content into CST
            const cst = this.parser.parse(sqlContent);

            // Step 2: Format CST to string with proper indentation
            const formatted = this.cstFormatter.format(cst, formatterOptions);

            // Step 3: Clean up formatting
            return this.cleanupFormatting(formatted);
        } catch (error) {
            // If formatting fails, return original content
            console.error('[MyBatis SQL Formatter] Failed to format SQL:', error);
            return sqlContent;
        }
    }

    /**
     * Build sql-formatter options from user configuration
     *
     * @param options - User-provided options
     * @returns Complete formatter options with defaults
     */
    private buildFormatterOptions(options?: FormatterOptions): FormatOptionsWithLanguage {
        return {
            ...this.DEFAULT_OPTIONS,
            ...(options?.language && { language: options.language as SqlLanguage }),
            ...(options?.keywordCase && { keywordCase: options.keywordCase }),
            ...(options?.tabWidth && { tabWidth: options.tabWidth }),
            ...(options?.indentStyle && { indentStyle: options.indentStyle }),
            ...(options?.denseOperators !== undefined && { denseOperators: options.denseOperators })
        };
    }

    /**
     * Clean up formatting (remove excessive blank lines, trim, etc.)
     */
    private cleanupFormatting(formatted: string): string {
        // Remove leading/trailing whitespace
        let result = formatted.trim();

        // Replace multiple consecutive blank lines with single blank line
        result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

        // Remove trailing spaces on each line
        result = result.split('\n').map(line => line.trimEnd()).join('\n');

        return result;
    }

    /**
     * Detect SQL dialect from SQL content
     * Uses syntax patterns to identify the database type
     *
     * @param sqlContent - SQL content to analyze
     * @returns Detected SQL dialect
     */
    public detectDialect(sqlContent: string): string {
        const upperContent = sqlContent.toUpperCase();

        // MySQL indicators
        if (upperContent.includes('LIMIT') || upperContent.includes('IFNULL') ||
            upperContent.includes('CONCAT') || upperContent.includes('`')) {
            return 'mysql';
        }

        // PostgreSQL indicators
        if (upperContent.includes('RETURNING') || upperContent.includes('::') ||
            upperContent.includes('ARRAY')) {
            return 'postgresql';
        }

        // Oracle indicators
        if (upperContent.includes('ROWNUM') || upperContent.includes('CONNECT BY') ||
            upperContent.includes('NVL')) {
            return 'plsql';
        }

        // SQL Server indicators
        if (upperContent.includes('TOP') || upperContent.includes('@@') ||
            upperContent.includes('IDENTITY')) {
            return 'tsql';
        }

        // Default to MySQL (most common)
        return 'mysql';
    }

    /**
     * Debug: Print CST structure for debugging
     */
    public debugPrintCst(sqlContent: string): string {
        const cst = this.parser.parse(sqlContent);
        return this.printNode(cst, 0);
    }

    private printNode(node: CSTNode, depth: number): string {
        const indent = '  '.repeat(depth);
        let result = '';

        switch (node.type) {
            case 'root':
                result += `${indent}Root\n`;
                for (const child of (node as RootNode).children) {
                    result += this.printNode(child, depth + 1);
                }
                break;
            case 'tag':
                const tag = node as TagNode;
                result += `${indent}Tag: <${tag.tagName}> (selfClosing: ${tag.selfClosing})\n`;
                if (tag.attributes.size > 0) {
                    result += `${indent}  Attributes: ${JSON.stringify(Array.from(tag.attributes.entries()))}\n`;
                }
                for (const child of tag.children) {
                    result += this.printNode(child, depth + 1);
                }
                break;
            case 'sql':
                const sql = (node as SqlNode).content.trim().substring(0, 50);
                result += `${indent}SQL: "${sql}${sql.length === 50 ? '...' : ''}"\n`;
                break;
            case 'param':
                const param = node as ParamNode;
                result += `${indent}Param: ${param.paramType}{${param.expression}}\n`;
                break;
        }

        return result;
    }
}
