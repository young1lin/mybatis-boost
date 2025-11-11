/**
 * Parser for MyBatis parameter strings
 */

import { Parameter } from '../types';

/**
 * Parse MyBatis parameter string into structured parameters
 */
export class ParameterParser {
    // Pattern to match individual parameters: value(Type)
    // Examples: "1(Integer)", "active(String)", "null", "2025-01-15 10:30:45(Timestamp)"
    private static readonly PARAM_PATTERN = /([^(),]+(?:\([^)]*\))?)\s*\(([^)]+)\)|null/g;

    /**
     * Parse parameter string from MyBatis log
     * Examples:
     *   "1(Integer), active(String)" -> [{value: "1", type: "Integer"}, {value: "active", type: "String"}]
     *   "MATIC(String), 0(String), 1(String)" -> [{value: "MATIC", type: "String"}, ...]
     *   "null" -> [{value: "null", type: "Unknown"}]
     */
    public static parse(paramString: string): Parameter[] {
        if (!paramString || paramString.trim() === '') {
            return [];
        }

        const params: Parameter[] = [];
        const trimmed = paramString.trim();

        // Split by comma, but handle dates and complex values
        const parts = this.splitParameters(trimmed);

        for (const part of parts) {
            const param = this.parseParameter(part);
            if (param) {
                params.push(param);
            }
        }

        return params;
    }

    /**
     * Split parameter string by commas, handling nested parentheses
     */
    private static splitParameters(paramString: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < paramString.length; i++) {
            const char = paramString[i];

            if (char === '(') {
                depth++;
                current += char;
            } else if (char === ')') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        return parts;
    }

    /**
     * Parse a single parameter part
     */
    private static parseParameter(part: string): Parameter | null {
        const trimmed = part.trim();

        // Handle null
        if (trimmed.toLowerCase() === 'null') {
            return { value: 'null', type: 'Unknown' };
        }

        // Match pattern: value(Type)
        const match = trimmed.match(/^(.+?)\(([^)]+)\)$/);
        if (match) {
            const value = match[1].trim();
            const type = match[2].trim();
            return { value, type };
        }

        // If no type specified, treat as Unknown
        return { value: trimmed, type: 'Unknown' };
    }

    /**
     * Validate parameter count matches placeholder count in SQL
     */
    public static validateParameterCount(sql: string, params: Parameter[]): boolean {
        const placeholderCount = (sql.match(/\?/g) || []).length;
        return placeholderCount === params.length;
    }
}
