/**
 * Database dialect detector and formatter
 */

import { DatabaseType, Parameter } from '../types';

/**
 * Detect database type and format parameters accordingly
 */
export class DatabaseDialect {
    /**
     * Auto-detect database type from SQL syntax
     */
    public static detectDatabase(sql: string): DatabaseType {
        if (!sql) {
            return DatabaseType.Unknown;
        }

        const upperSql = sql.toUpperCase();

        // Check PostgreSQL first (before MySQL) to catch OFFSET LIMIT pattern
        if (this.isPostgreSql(sql, upperSql)) {
            return DatabaseType.PostgreSQL;
        }

        // MySQL indicators
        if (this.isMySql(sql, upperSql)) {
            return DatabaseType.MySQL;
        }

        // Oracle indicators
        if (this.isOracle(upperSql)) {
            return DatabaseType.Oracle;
        }

        // SQL Server indicators
        if (this.isSqlServer(upperSql)) {
            return DatabaseType.SQLServer;
        }

        // Default to MySQL (most common)
        return DatabaseType.MySQL;
    }

    /**
     * Check if SQL is MySQL
     */
    private static isMySql(sql: string, upperSql: string): boolean {
        // Backtick quotes (most distinctive)
        if (/`\w+`/.test(sql)) {
            return true;
        }

        // MySQL-specific keywords (excluding LIMIT as it's also in PostgreSQL)
        if (/\b(AUTO_INCREMENT|ENGINE\s*=|IFNULL)\b/.test(upperSql)) {
            return true;
        }

        // MySQL LIMIT without OFFSET (LIMIT at end or LIMIT without preceding OFFSET)
        if (/LIMIT\s+\d+\s*$/i.test(upperSql) || /LIMIT\s+\d+\s+OFFSET\s+\d+/i.test(upperSql)) {
            return true;
        }

        return false;
    }

    /**
     * Check if SQL is PostgreSQL
     */
    private static isPostgreSql(sql: string, upperSql: string): boolean {
        // PostgreSQL cast syntax (::type)
        if (/::\w+/.test(sql)) {
            return true;
        }

        // PostgreSQL-specific keywords
        if (/\b(SERIAL|BOOLEAN|RETURNING|ILIKE|GENERATE_SERIES)\b/.test(upperSql)) {
            return true;
        }

        // OFFSET before LIMIT (PostgreSQL style)
        if (/OFFSET\s+\d+\s+LIMIT\s+\d+/i.test(upperSql)) {
            return true;
        }

        return false;
    }

    /**
     * Check if SQL is Oracle
     */
    private static isOracle(upperSql: string): boolean {
        // Oracle-specific keywords
        if (/\b(ROWNUM|DUAL|SYSDATE|NVL|DECODE|MINUS|CONNECT\s+BY)\b/.test(upperSql)) {
            return true;
        }

        return false;
    }

    /**
     * Check if SQL is SQL Server
     */
    private static isSqlServer(upperSql: string): boolean {
        // SQL Server-specific keywords
        if (/\b(TOP\s+\d+|GETDATE|IDENTITY|NVARCHAR)\b/.test(upperSql)) {
            return true;
        }

        return false;
    }

    /**
     * Format parameter value based on type and database
     */
    public static formatParameter(param: Parameter, dbType: DatabaseType): string {
        const { value, type } = param;

        // NULL handling
        if (value === 'null' || value === null || value === undefined) {
            return 'NULL';
        }

        // Numeric types
        if (this.isNumericType(type)) {
            return value;
        }

        // Boolean types
        if (this.isBooleanType(type)) {
            return this.formatBoolean(value, dbType);
        }

        // Date/Time types
        if (this.isDateTimeType(type)) {
            return this.formatDateTime(value, type, dbType);
        }

        // String types (default)
        return this.formatString(value, dbType);
    }

    /**
     * Check if type is numeric
     */
    private static isNumericType(type: string): boolean {
        const numericTypes = [
            'Integer', 'Long', 'Double', 'Float', 'BigDecimal',
            'Short', 'Byte', 'int', 'long', 'double', 'float',
            'BigInteger', 'Number'
        ];
        return numericTypes.includes(type);
    }

    /**
     * Check if type is boolean
     */
    private static isBooleanType(type: string): boolean {
        return type === 'Boolean' || type === 'boolean';
    }

    /**
     * Check if type is date/time
     */
    private static isDateTimeType(type: string): boolean {
        const dateTimeTypes = [
            'Date', 'Timestamp', 'LocalDateTime', 'LocalDate',
            'LocalTime', 'OffsetDateTime', 'ZonedDateTime', 'Instant'
        ];
        return dateTimeTypes.includes(type);
    }

    /**
     * Format boolean value
     */
    private static formatBoolean(value: string, dbType: DatabaseType): string {
        const boolValue = value.toLowerCase() === 'true';

        switch (dbType) {
            case DatabaseType.PostgreSQL:
                return boolValue ? 'TRUE' : 'FALSE';
            case DatabaseType.Oracle:
            case DatabaseType.SQLServer:
                return boolValue ? '1' : '0';
            case DatabaseType.MySQL:
            default:
                return boolValue ? 'TRUE' : 'FALSE';
        }
    }

    /**
     * Format date/time value
     */
    private static formatDateTime(value: string, type: string, dbType: DatabaseType): string {
        // Already formatted value, just quote it
        switch (dbType) {
            case DatabaseType.Oracle:
                // Oracle uses TO_DATE or TO_TIMESTAMP
                if (type === 'Timestamp' || type === 'LocalDateTime') {
                    return `TO_TIMESTAMP('${value}', 'YYYY-MM-DD HH24:MI:SS.FF')`;
                } else {
                    return `TO_DATE('${value}', 'YYYY-MM-DD')`;
                }
            case DatabaseType.PostgreSQL:
                // PostgreSQL uses cast syntax
                return `'${value}'::${this.getPostgreSqlDateType(type)}`;
            case DatabaseType.MySQL:
            case DatabaseType.SQLServer:
            default:
                return `'${value}'`;
        }
    }

    /**
     * Get PostgreSQL date type for cast
     */
    private static getPostgreSqlDateType(type: string): string {
        switch (type) {
            case 'Timestamp':
            case 'LocalDateTime':
                return 'timestamp';
            case 'LocalDate':
                return 'date';
            case 'LocalTime':
                return 'time';
            default:
                return 'timestamp';
        }
    }

    /**
     * Format string value
     */
    private static formatString(value: string, dbType: DatabaseType): string {
        // Escape single quotes by doubling them (standard SQL)
        const escaped = value.replace(/'/g, "''");
        return `'${escaped}'`;
    }
}
