/**
 * XML file parser
 */

import { XmlStatement } from '../../types';
import { readFirstLines, readFile } from '../../utils/fileUtils';

/**
 * Remove XML comments from content
 * Removes all <!-- ... --> comment blocks while preserving line numbers
 */
function removeXmlComments(content: string): string {
    // Remove XML comments (<!-- ... -->)
    // Replace comment content with newlines to preserve line numbers
    return content.replace(/<!--[\s\S]*?-->/g, (match) => {
        // Count newlines in the comment and preserve them
        const newlineCount = (match.match(/\n/g) || []).length;
        return '\n'.repeat(newlineCount);
    });
}

/**
 * Extract namespace from XML mapper file
 * Only reads first 30 lines for performance
 */
export async function extractXmlNamespace(filePath: string): Promise<string | null> {
    const content = await readFirstLines(filePath, 30);

    // Extract namespace attribute from <mapper> tag
    const namespaceMatch = content.match(/<mapper[^>]+namespace\s*=\s*["']([^"']+)["']/);
    return namespaceMatch ? namespaceMatch[1] : null;
}

/**
 * Extract all SQL statements from XML mapper file
 */
export async function extractXmlStatements(filePath: string): Promise<XmlStatement[]> {
    const content = await readFile(filePath);
    // Remove XML comments before parsing to avoid matching commented-out statements
    const contentWithoutComments = removeXmlComments(content);
    const lines = contentWithoutComments.split('\n');
    const statements: XmlStatement[] = [];

    let currentStatement: { type: 'select' | 'insert' | 'update' | 'delete'; line: number } | null = null;
    let tagContent = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line starts a statement tag
        const tagStartMatch = line.match(/<(select|insert|update|delete)(?:\s|>|$)/);
        if (tagStartMatch) {
            currentStatement = {
                type: tagStartMatch[1] as 'select' | 'insert' | 'update' | 'delete',
                line: i
            };
            tagContent = line;
        } else if (currentStatement) {
            // Continue accumulating tag content for multi-line tags
            tagContent += ' ' + line.trim();
        }

        // Check if we've reached the end of the tag (found '>')
        if (currentStatement && tagContent.includes('>')) {
            // Extract id from accumulated tag content
            const idMatch = tagContent.match(/id\s*=\s*["']([^"']+)["']/);
            if (idMatch) {
                const id = idMatch[1];

                // Find which line contains the id attribute
                let idLine = currentStatement.line;
                let startColumn = 0;
                let endColumn = 0;

                // Search from statement start line to current line
                for (let j = currentStatement.line; j <= i; j++) {
                    const searchLine = lines[j];
                    const idAttrMatch = searchLine.match(/id\s*=\s*["']([^"']+)["']/);

                    if (idAttrMatch) {
                        idLine = j;
                        // Find where the id value starts (after the opening quote)
                        const idAttrStart = searchLine.indexOf('id');
                        const quoteAfterEquals = searchLine.indexOf('"', idAttrStart);
                        const singleQuoteAfterEquals = searchLine.indexOf("'", idAttrStart);

                        if (quoteAfterEquals >= 0 && (singleQuoteAfterEquals < 0 || quoteAfterEquals < singleQuoteAfterEquals)) {
                            startColumn = quoteAfterEquals + 1;
                        } else if (singleQuoteAfterEquals >= 0) {
                            startColumn = singleQuoteAfterEquals + 1;
                        }
                        endColumn = startColumn + id.length;
                        break;
                    }
                }

                // Extract resultType if present
                const resultTypeMatch = tagContent.match(/resultType\s*=\s*["']([^"']+)["']/);

                statements.push({
                    id,
                    type: currentStatement.type,
                    line: idLine, // Use the line where id attribute is found
                    startColumn: startColumn,
                    endColumn: endColumn,
                    resultType: resultTypeMatch ? resultTypeMatch[1] : undefined
                });
            }

            // Reset for next statement
            currentStatement = null;
            tagContent = '';
        }
    }

    return statements;
}

/**
 * Find a specific SQL statement in XML file and return its line number
 */
export async function findXmlStatementLine(filePath: string, statementId: string): Promise<number | null> {
    const statements = await extractXmlStatements(filePath);
    const statement = statements.find(s => s.id === statementId);
    return statement ? statement.line : null;
}

/**
 * Find a specific SQL statement in XML file and return its position (line and column range)
 */
export async function findXmlStatementPosition(
    filePath: string,
    statementId: string
): Promise<{ line: number; startColumn: number; endColumn: number } | null> {
    const statements = await extractXmlStatements(filePath);
    const statement = statements.find(s => s.id === statementId);
    return statement ? { line: statement.line, startColumn: statement.startColumn, endColumn: statement.endColumn } : null;
}

/**
 * Extract statement ID from cursor position
 * Searches backward from cursor to find the nearest statement tag
 */
export async function extractStatementIdFromPosition(
    filePath: string,
    lineNumber: number
): Promise<string | null> {
    const content = await readFile(filePath);
    // Remove XML comments before parsing
    const contentWithoutComments = removeXmlComments(content);
    const lines = contentWithoutComments.split('\n');

    // Search backward from cursor position to find statement tag start
    for (let i = lineNumber; i >= 0 && i >= lineNumber - 20; i--) {
        const line = lines[i];
        const tagStartMatch = line.match(/<(select|insert|update|delete)(?:\s|>|$)/);

        if (tagStartMatch) {
            // Found a statement tag, now accumulate content until we find the closing '>'
            let tagContent = line;
            for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                tagContent += ' ' + lines[j].trim();
                if (lines[j].includes('>')) {
                    break;
                }
            }

            // Extract id from accumulated tag content
            const idMatch = tagContent.match(/id\s*=\s*["']([^"']+)["']/);
            if (idMatch) {
                return idMatch[1];
            }
        }
    }

    return null;
}

/**
 * Find the position of the <mapper> tag in XML file
 * Returns the position for navigation purposes
 */
export async function findXmlMapperPosition(filePath: string): Promise<{ line: number; column: number } | null> {
    try {
        const content = await readFile(filePath);
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match <mapper> tag with namespace
            if (/<mapper[^>]*namespace/.test(line)) {
                const mapperMatch = line.match(/<mapper/);
                if (mapperMatch && mapperMatch.index !== undefined) {
                    return { line: i, column: mapperMatch.index + 1 };
                }
                return { line: i, column: 0 };
            }
        }
    } catch (error) {
        console.error('[xmlParser] Error finding mapper position:', error);
    }

    return null;
}
