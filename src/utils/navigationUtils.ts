/**
 * Shared navigation utilities for definition providers
 * Deduplicates cursor mapping, XML attribute matching, and attribute value location logic
 */

import * as vscode from 'vscode';
import { escapeRegex } from './stringUtils';
import { WORKSPACE_EXCLUDE_PATTERN } from './fileUtils';

/**
 * Information about a matched XML attribute value at the cursor position
 */
export interface CursorMatchInfo {
    value: string;        // The matched attribute value
    startColumn: number;  // Start column of the value in the line
    endColumn: number;    // End column of the value in the line
    cursorOffset: number; // Cursor offset relative to startColumn
}

/**
 * Map cursor position proportionally from source range to target range.
 * Used to maintain relative cursor position when jumping between corresponding tokens.
 *
 * @returns The mapped column position in the target range
 */
export function mapCursorProportionally(
    cursorOffset: number, sourceLength: number,
    targetStartColumn: number, targetLength: number
): number {
    if (sourceLength <= 0) {
        return targetStartColumn;
    }
    const relativePosition = cursorOffset / sourceLength;
    const mappedOffset = Math.floor(relativePosition * targetLength);
    return targetStartColumn + Math.min(mappedOffset, targetLength);
}

/**
 * Match an XML attribute value at the cursor position using a regex with one capture group.
 * The regex must have the global flag and exactly one capture group for the value.
 *
 * @param line - The line text to search
 * @param cursorPos - The cursor column position
 * @param regex - A global regex with one capture group (e.g., /refid\s*=\s*["']([^"']+)["']/g)
 * @returns Match info if cursor is within a value, null otherwise
 */
export function matchXmlAttributeAtCursor(
    line: string, cursorPos: number, regex: RegExp
): CursorMatchInfo | null {
    let match;
    while ((match = regex.exec(line)) !== null) {
        const value = match[1];
        const matchStart = match.index;
        const valueStart = matchStart + match[0].indexOf(value);
        const valueEnd = valueStart + value.length;

        if (cursorPos >= valueStart && cursorPos <= valueEnd) {
            return {
                value,
                startColumn: valueStart,
                endColumn: valueEnd,
                cursorOffset: cursorPos - valueStart
            };
        }
    }
    return null;
}

/**
 * Find an attribute value's location in a target line and map cursor position proportionally.
 * Handles the common pattern of: find attribute → locate opening quote → map cursor.
 *
 * @param line - The target line text
 * @param lineNumber - The target line number
 * @param uri - The document URI
 * @param attrName - The attribute name to search for (e.g., 'id', 'refid', 'resultMap')
 * @param attrValue - The expected attribute value
 * @param sourceMatchInfo - The source cursor match info for proportional mapping
 * @returns A Location if the attribute value is found, null otherwise
 */
export function findAttributeValueLocation(
    line: string, lineNumber: number, uri: vscode.Uri,
    attrName: string, attrValue: string, sourceMatchInfo: CursorMatchInfo
): vscode.Location | null {
    const attrRegex = new RegExp(`${escapeRegex(attrName)}\\s*=\\s*["']${escapeRegex(attrValue)}["']`);
    const attrMatch = line.match(attrRegex);
    if (!attrMatch) {
        return null;
    }

    const attrStart = line.indexOf(attrMatch[0]);
    // Find the opening quote
    const quotePos = line.indexOf('"', attrStart) !== -1
        ? line.indexOf('"', attrStart)
        : line.indexOf("'", attrStart);

    if (quotePos < 0) {
        return null;
    }

    const targetStartColumn = quotePos + 1;
    const targetLength = attrValue.length;
    const sourceLength = sourceMatchInfo.endColumn - sourceMatchInfo.startColumn;

    const targetColumn = mapCursorProportionally(
        sourceMatchInfo.cursorOffset, sourceLength,
        targetStartColumn, targetLength
    );

    return new vscode.Location(uri, new vscode.Position(lineNumber, targetColumn));
}

/**
 * Find a Java class file by fully-qualified class name in the workspace.
 *
 * @param className - Fully-qualified class name (e.g., "com.example.User")
 * @returns The URI of the found file, or null
 */
export async function findJavaClassFile(className: string): Promise<vscode.Uri | null> {
    const pathPattern = className.replace(/\./g, '/') + '.java';
    const searchPattern = `**/${pathPattern}`;

    const files = await vscode.workspace.findFiles(
        searchPattern,
        WORKSPACE_EXCLUDE_PATTERN,
        1
    );

    return files.length > 0 ? files[0] : null;
}
