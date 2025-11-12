/**
 * MyBatis SQL Formatter
 * Formats SQL content inside MyBatis statement tags while preserving dynamic SQL tags
 *
 * Strategy: Three-step formatting process
 * 1. Extract dynamic tags and replace with placeholders
 * 2. Format the cleaned SQL using sql-formatter library
 * 3. Restore dynamic tags from placeholders
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
 * Dynamic tag extraction result
 */
interface TagExtractionResult {
    /** SQL content with tags replaced by placeholders */
    cleanedSql: string;
    /** Map of placeholders to original tag content */
    tagMap: Map<string, string>;
}

/**
 * MyBatis SQL Formatter
 * Handles SQL formatting with dynamic tag preservation using placeholder replacement strategy
 */
export class MybatisSqlFormatter {
    /**
     * MyBatis dynamic SQL tags that need to be preserved during formatting
     */
    private readonly DYNAMIC_TAGS = [
        'if', 'choose', 'when', 'otherwise', 'foreach',
        'where', 'set', 'trim', 'bind', 'include'
    ];

    /**
     * Placeholder prefix for dynamic tags
     */
    private readonly PLACEHOLDER_PREFIX = '__MYBATIS_TAG_';

    /**
     * Default formatter options matching IDEA's default SQL formatting style
     */
    private readonly DEFAULT_OPTIONS: FormatOptionsWithLanguage = {
        language: 'mysql',
        keywordCase: 'upper',
        tabWidth: 2,
        indentStyle: 'standard',
        logicalOperatorNewline: 'before',  // AND/OR on new line before the condition
        denseOperators: false,
        newlineBeforeSemicolon: false,
        linesBetweenQueries: 1
    };

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

        // Step 1: Extract and replace dynamic tags with placeholders
        const { cleanedSql, tagMap } = this.extractDynamicTags(sqlContent);

        // Step 2: Replace MyBatis parameters with ? placeholders for better formatting
        const { sql: sqlWithPlaceholders, paramMap } = this.replaceMyBatisParams(cleanedSql);

        // Step 3: Format the cleaned SQL using sql-formatter
        const formatterOptions = this.buildFormatterOptions(options);
        let formatted: string;

        try {
            formatted = format(sqlWithPlaceholders, formatterOptions);
        } catch (error) {
            // If formatting fails, return original content
            console.error('[MyBatis SQL Formatter] Failed to format SQL:', error);
            return sqlContent;
        }

        // Step 4: Restore MyBatis parameters
        const sqlWithParams = this.restoreMyBatisParams(formatted, paramMap);

        // Step 5: Restore dynamic tags from placeholders
        const result = this.restoreDynamicTags(sqlWithParams, tagMap);

        return result;
    }

    /**
     * Extract dynamic tags and replace with placeholders
     * Uses recursive approach to handle nested tags from innermost to outermost
     *
     * @param sqlContent - Original SQL content
     * @returns Cleaned SQL and tag mapping
     */
    private extractDynamicTags(sqlContent: string): TagExtractionResult {
        const tagMap = new Map<string, string>();
        let placeholderIndex = 0;
        let cleanedSql = sqlContent;

        // Build regex pattern for all dynamic tags
        const tagPattern = this.buildTagPattern();

        // Keep replacing until no more tags found (handles nested tags)
        let hasMoreTags = true;
        while (hasMoreTags) {
            const match = cleanedSql.match(tagPattern);

            if (!match) {
                hasMoreTags = false;
                break;
            }

            const fullTag = match[0];
            const placeholder = `${this.PLACEHOLDER_PREFIX}${placeholderIndex}__`;

            // Store the mapping
            tagMap.set(placeholder, fullTag);

            // Replace the tag with placeholder
            cleanedSql = cleanedSql.replace(fullTag, placeholder);

            placeholderIndex++;
        }

        return { cleanedSql, tagMap };
    }

    /**
     * Build regex pattern to match dynamic tags
     * Matches self-closing and paired tags with content
     *
     * @returns Regex pattern for matching dynamic tags
     */
    private buildTagPattern(): RegExp {
        const tagNames = this.DYNAMIC_TAGS.join('|');

        // Match both self-closing tags and paired tags with content
        // Example: <include refid="xxx"/> or <if test="xxx">content</if>
        const pattern = `<(${tagNames})(?:\\s+[^>]*)?(?:/>|>.*?</\\1>)`;

        return new RegExp(pattern, 'is'); // 'i' for case-insensitive, 's' for dotAll mode
    }

    /**
     * Replace MyBatis parameters with ? placeholders
     * This helps sql-formatter recognize the SQL structure correctly and apply proper formatting
     *
     * @param sql - SQL content with MyBatis parameters
     * @returns SQL with ? placeholders and parameter mapping
     */
    private replaceMyBatisParams(sql: string): { sql: string; paramMap: Map<string, string> } {
        const paramMap = new Map<string, string>();
        let paramIndex = 0;
        let result = sql;

        // Replace #{param} with numbered placeholders
        result = result.replace(/#\{[^}]+\}/g, (match) => {
            const placeholder = `__PARAM_${paramIndex}__`;
            paramMap.set(placeholder, match);
            paramIndex++;
            return '?';
        });

        // Replace ${param} with numbered placeholders
        result = result.replace(/\$\{[^}]+\}/g, (match) => {
            const placeholder = `__PARAM_${paramIndex}__`;
            paramMap.set(placeholder, match);
            paramIndex++;
            return '?';
        });

        return { sql: result, paramMap };
    }

    /**
     * Restore MyBatis parameters from ? placeholders
     * Replaces ? back to original MyBatis parameters in order
     *
     * @param sql - SQL content with ? placeholders
     * @param paramMap - Map of placeholders to original parameters
     * @returns SQL with restored MyBatis parameters
     */
    private restoreMyBatisParams(sql: string, paramMap: Map<string, string>): string {
        let result = sql;
        let paramIndex = 0;

        // Replace ? with original MyBatis parameters in order
        result = result.replace(/\?/g, () => {
            const placeholder = `__PARAM_${paramIndex}__`;
            const originalParam = paramMap.get(placeholder);
            paramIndex++;
            return originalParam || '?';
        });

        return result;
    }

    /**
     * Restore dynamic tags from placeholders
     * Adds proper indentation to tag content based on Style A (extra indentation inside tags)
     *
     * @param formattedSql - Formatted SQL with placeholders
     * @param tagMap - Map of placeholders to original tag content
     * @returns SQL with restored dynamic tags
     */
    private restoreDynamicTags(formattedSql: string, tagMap: Map<string, string>): string {
        let result = formattedSql;

        // Replace each placeholder with its original tag
        for (const [placeholder, originalTag] of tagMap) {
            // Find the placeholder in the formatted SQL to get its indentation
            const lines = result.split('\n');
            let placeholderLineIndex = -1;
            let placeholderIndent = '';
            let isPlaceholderAloneOnLine = false;

            // Find the line containing the placeholder
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(placeholder)) {
                    placeholderLineIndex = i;
                    const line = lines[i];

                    // Extract the indentation before the placeholder
                    const lineBeforePlaceholder = line.substring(0, line.indexOf(placeholder));
                    placeholderIndent = lineBeforePlaceholder.match(/^\s*/)?.[0] || '';

                    // Check if placeholder is alone on the line (only whitespace before and after)
                    const lineAfterPlaceholder = line.substring(line.indexOf(placeholder) + placeholder.length);
                    isPlaceholderAloneOnLine = lineBeforePlaceholder.trim() === '' && lineAfterPlaceholder.trim() === '';

                    break;
                }
            }

            // Format the tag with proper indentation (Style A: extra indent inside tags)
            const formattedTag = this.formatDynamicTag(originalTag, placeholderIndent, isPlaceholderAloneOnLine);

            // Replace the placeholder with the formatted tag
            result = result.replace(placeholder, formattedTag);
        }

        return result;
    }

    /**
     * Format a dynamic tag with proper indentation
     * Applies Style A: content inside dynamic tags gets extra indentation
     *
     * @param tagContent - Original tag content
     * @param baseIndent - Base indentation from the placeholder position
     * @param isAloneOnLine - Whether the placeholder was alone on its line
     * @returns Formatted tag with proper indentation
     */
    private formatDynamicTag(tagContent: string, baseIndent: string, isAloneOnLine: boolean = false): string {
        // Parse the tag to extract tag name, attributes, and inner content
        const selfClosingMatch = tagContent.match(/^<(\w+)([^>]*)\/>$/);

        if (selfClosingMatch) {
            // Self-closing tag (e.g., <include refid="xxx"/>)
            // If placeholder was alone on line, don't add leading newline (already on new line)
            if (isAloneOnLine) {
                return `${baseIndent}${tagContent}`;
            }
            return `\n${baseIndent}${tagContent}`;
        }

        // Paired tag with content (e.g., <if test="xxx">AND name = #{name}</if>)
        const pairedTagMatch = tagContent.match(/^<(\w+)([^>]*)>(.*)<\/\1>$/s);

        if (!pairedTagMatch) {
            // Invalid tag format, return as-is
            return tagContent;
        }

        const tagName = pairedTagMatch[1];
        const attributes = pairedTagMatch[2];
        const innerContent = pairedTagMatch[3];

        // Calculate extra indentation for content inside the tag (2 spaces for IDEA style)
        const extraIndent = '  ';
        const contentIndent = baseIndent + extraIndent;

        // Trim and indent the inner content
        const trimmedContent = innerContent.trim();

        // Check if content is multi-line
        if (trimmedContent.includes('\n')) {
            // Multi-line content: indent each line
            const indentedLines = trimmedContent.split('\n').map(line => {
                const trimmedLine = line.trim();
                return trimmedLine ? `${contentIndent}${trimmedLine}` : '';
            });

            // If placeholder was alone on line, don't add leading newline
            if (isAloneOnLine) {
                return `${baseIndent}<${tagName}${attributes}>\n${indentedLines.join('\n')}\n${baseIndent}</${tagName}>`;
            }
            return `\n${baseIndent}<${tagName}${attributes}>\n${indentedLines.join('\n')}\n${baseIndent}</${tagName}>`;
        } else {
            // Single-line content: add on new line with indentation
            // If placeholder was alone on line, don't add leading newline
            if (isAloneOnLine) {
                return `${baseIndent}<${tagName}${attributes}>\n${contentIndent}${trimmedContent}\n${baseIndent}</${tagName}>`;
            }
            return `\n${baseIndent}<${tagName}${attributes}>\n${contentIndent}${trimmedContent}\n${baseIndent}</${tagName}>`;
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
}
