/**
 * Parameter parser for extracting parameter references from XML SQL statements
 */

import { ParameterReference, XmlStatement } from '../../types';
import { readFile } from '../../utils/fileUtils';

/**
 * Extract all parameter references from an XML statement
 * Supports both #{param} and ${param} syntax
 *
 * @param filePath - Path to XML file
 * @param statement - XML statement metadata
 * @returns Array of parameter references with positions
 */
export async function extractParameterReferences(
    filePath: string,
    statement: XmlStatement
): Promise<ParameterReference[]> {
    const content = await readFile(filePath);
    const lines = content.split('\n');

    const parameters: ParameterReference[] = [];

    // Find the statement in the file
    let inStatement = false;
    let braceLevel = 0;
    let statementStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if we're entering the statement
        if (!inStatement) {
            const statementTagRegex = new RegExp(
                `<${statement.type}[^>]*\\bid\\s*=\\s*["']${escapeRegex(statement.id)}["']`
            );
            if (statementTagRegex.test(line)) {
                inStatement = true;
                statementStartLine = i;
            }
        }

        if (inStatement) {
            // Track opening tags
            const openTags = (line.match(new RegExp(`<${statement.type}(?:\\s|>)`, 'g')) || []).length;
            braceLevel += openTags;

            // Track closing tags
            const closeTags = (line.match(new RegExp(`</${statement.type}>`, 'g')) || []).length;
            braceLevel -= closeTags;

            // Extract parameters from this line
            const lineParams = extractParametersFromLine(line, i);
            parameters.push(...lineParams);

            // Check if we've exited the statement
            if (braceLevel === 0 && i > statementStartLine) {
                break;
            }
        }
    }

    return parameters;
}

/**
 * Extract parameter references from a single line
 * Parameters are extracted in the order they appear (left to right)
 *
 * @param line - Line content
 * @param lineNumber - Line number (0-indexed)
 * @returns Array of parameter references found in this line, ordered by position
 */
function extractParametersFromLine(line: string, lineNumber: number): ParameterReference[] {
    const parameters: ParameterReference[] = [];

    // Match both #{param} and ${param}
    const combinedRegex = /(#\{([^}]+)\})|(\$\{([^}]+)\})/g;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(line)) !== null) {
        const isPrepared = match[1] !== undefined; // #{param}
        const isSubstitution = match[3] !== undefined; // ${param}

        const fullMatch = isPrepared ? match[1] : match[3]; // e.g., "#{name}" or "${name}"
        const paramName = isPrepared ? match[2].trim() : match[4].trim(); // e.g., "name"
        const startColumn = match.index;
        const endColumn = match.index + fullMatch.length;

        // Handle property paths (e.g., user.name -> user)
        // For now, we only validate the root property
        const rootParam = paramName.split('.')[0];

        parameters.push({
            name: rootParam,
            line: lineNumber,
            startColumn: startColumn,
            endColumn: endColumn,
            type: isPrepared ? 'prepared' : 'substitution'
        });
    }

    return parameters;
}

/**
 * Extract parameter type and parameter map from an XML statement tag
 *
 * @param filePath - Path to XML file
 * @param statement - XML statement metadata
 * @returns Object containing parameterType and parameterMap
 */
export async function extractStatementParameterInfo(
    filePath: string,
    statement: XmlStatement
): Promise<{ parameterType?: string; parameterMap?: string }> {
    const content = await readFile(filePath);
    const lines = content.split('\n');

    // Find the statement tag and extract attributes
    let statementTag = '';
    let foundStatement = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line contains the statement start
        const statementTagRegex = new RegExp(
            `<${statement.type}[^>]*\\bid\\s*=\\s*["']${escapeRegex(statement.id)}["']`
        );

        if (statementTagRegex.test(line)) {
            foundStatement = true;
            statementTag = line;
        } else if (foundStatement) {
            // Continue accumulating tag content for multi-line tags
            statementTag += ' ' + line.trim();
        }

        // Stop when we find the closing >
        if (foundStatement && line.includes('>')) {
            break;
        }
    }

    const result: { parameterType?: string; parameterMap?: string } = {};

    // Extract parameterType
    const parameterTypeMatch = statementTag.match(/parameterType\s*=\s*["']([^"']+)["']/);
    if (parameterTypeMatch) {
        result.parameterType = parameterTypeMatch[1];
    }

    // Extract parameterMap
    const parameterMapMatch = statementTag.match(/parameterMap\s*=\s*["']([^"']+)["']/);
    if (parameterMapMatch) {
        result.parameterMap = parameterMapMatch[1];
    }

    return result;
}

/**
 * Check if cursor position is within a parameter reference
 *
 * @param line - Line content
 * @param column - Column position (0-indexed)
 * @returns Parameter reference info if cursor is within a parameter, null otherwise
 */
export function getParameterAtPosition(
    line: string,
    column: number
): { name: string; startColumn: number; endColumn: number; type: 'prepared' | 'substitution' } | null {
    // Check prepared statement parameters #{param}
    const preparedRegex = /#\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = preparedRegex.exec(line)) !== null) {
        const startColumn = match.index;
        const endColumn = match.index + match[0].length;

        if (column >= startColumn && column <= endColumn) {
            const paramName = match[1].trim();
            const rootParam = paramName.split('.')[0];

            return {
                name: rootParam,
                startColumn: startColumn,
                endColumn: endColumn,
                type: 'prepared'
            };
        }
    }

    // Check string substitution parameters ${param}
    const substitutionRegex = /\$\{([^}]+)\}/g;

    while ((match = substitutionRegex.exec(line)) !== null) {
        const startColumn = match.index;
        const endColumn = match.index + match[0].length;

        if (column >= startColumn && column <= endColumn) {
            const paramName = match[1].trim();
            const rootParam = paramName.split('.')[0];

            return {
                name: rootParam,
                startColumn: startColumn,
                endColumn: endColumn,
                type: 'substitution'
            };
        }
    }

    return null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
