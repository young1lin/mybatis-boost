/**
 * SQL converter for replacing parameters in parameterized SQL
 */

import { DatabaseType, Parameter } from '../types';
import { DatabaseDialect } from './DatabaseDialect';

/**
 * Convert parameterized SQL to executable SQL
 */
export class SqlConverter {
    /**
     * Replace parameters in SQL with actual values
     */
    public static convert(sql: string, params: Parameter[], dbType?: DatabaseType): string {
        if (!sql) {
            return '';
        }

        if (!params || params.length === 0) {
            return sql;
        }

        // Auto-detect database type if not provided
        const database = dbType || DatabaseDialect.detectDatabase(sql);

        let result = sql;
        let paramIndex = 0;

        // Replace each ? placeholder with formatted parameter
        result = result.replace(/\?/g, () => {
            if (paramIndex >= params.length) {
                // Not enough parameters, keep placeholder
                return '?';
            }

            const param = params[paramIndex++];
            return DatabaseDialect.formatParameter(param, database);
        });

        return result;
    }

    /**
     * Format SQL for better readability (optional)
     */
    public static formatSql(sql: string): string {
        if (!sql) {
            return '';
        }

        // Basic SQL formatting (can be enhanced)
        let formatted = sql;

        // Add newlines before major keywords
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY',
            'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN',
            'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
            'UNION', 'INTERSECT', 'EXCEPT'
        ];

        // Not applying aggressive formatting to preserve original structure
        // Just clean up extra spaces
        formatted = formatted.replace(/\s+/g, ' ').trim();

        return formatted;
    }

    /**
     * Validate that parameter count matches placeholder count
     */
    public static validateParameterCount(sql: string, params: Parameter[]): {
        valid: boolean;
        expected: number;
        actual: number;
    } {
        const placeholderCount = (sql.match(/\?/g) || []).length;
        const paramCount = params.length;

        return {
            valid: placeholderCount === paramCount,
            expected: placeholderCount,
            actual: paramCount
        };
    }
}
