/**
 * SQL converter for replacing parameters in parameterized SQL
 */

import { format } from 'sql-formatter';
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
     * Format SQL for better readability using sql-formatter
     */
    public static formatSql(sql: string, dbType?: DatabaseType): string {
        if (!sql) {
            return '';
        }

        try {
            // Map DatabaseType to sql-formatter language
            const languageMap: Record<DatabaseType, string> = {
                [DatabaseType.MySQL]: 'mysql',
                [DatabaseType.PostgreSQL]: 'postgresql',
                [DatabaseType.Oracle]: 'plsql',
                [DatabaseType.SQLServer]: 'transactsql',
                [DatabaseType.Unknown]: 'sql'
            };

            const language = dbType ? languageMap[dbType] : 'sql';

            // Format with sql-formatter
            return format(sql, {
                language: language as any,
                tabWidth: 2,                        // 2 spaces indentation
                keywordCase: 'upper',               // Keywords in uppercase
                identifierCase: 'preserve',         // Keep original case for identifiers
                dataTypeCase: 'upper',              // Data types in uppercase
                functionCase: 'upper',              // Functions in uppercase
                indentStyle: 'standard',            // Standard indentation
                logicalOperatorNewline: 'before',   // AND/OR on new line before
                linesBetweenQueries: 2,             // Empty lines between queries
                denseOperators: false,              // Space around operators
                newlineBeforeSemicolon: false       // Semicolon on same line
            });
        } catch (error) {
            // Fallback to original SQL if formatting fails
            console.error('SQL formatting failed:', error);
            return sql.replace(/\s+/g, ' ').trim();
        }
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
