/**
 * MyBatis Console Interceptor Types
 */

/**
 * Database type enum
 */
export enum DatabaseType {
    MySQL = 'mysql',
    PostgreSQL = 'postgresql',
    Oracle = 'oracle',
    SQLServer = 'sqlserver',
    Unknown = 'unknown'
}

/**
 * MyBatis log type
 */
export enum LogType {
    Preparing = 'preparing',
    Parameters = 'parameters',
    Total = 'total',
    Updates = 'updates',  // For INSERT/UPDATE/DELETE operations
    Unknown = 'unknown'
}

/**
 * Parameter type and value
 */
export interface Parameter {
    value: string;
    type: string;
}

/**
 * Parsed log entry
 */
export interface LogEntry {
    timestamp: string;
    threadId?: string;
    threadName?: string;
    mapper: string;
    logType: LogType;
    content: string;
    rawLine: string;
}

/**
 * SQL session for tracking multi-line MyBatis logs
 */
export interface SqlSession {
    sessionId: string;
    threadId?: string;
    threadName?: string;
    mapper: string;
    preparing?: {
        sql: string;
        timestamp: string;
        rawLine: string;
    };
    parameters?: {
        params: Parameter[];
        timestamp: string;
        rawLine: string;
    };
    startTime: number;
}

/**
 * Converted SQL result
 */
export interface ConvertedSql {
    originalSql: string;
    convertedSql: string;
    database: DatabaseType;
    parameters: Parameter[];
    executionTime?: number;
    mapper: string;
    timestamp: string;
    threadInfo?: string;
    preparingLine: string;
    parametersLine: string;
    totalLine?: string;
}

/**
 * Console configuration
 */
export interface ConsoleConfig {
    enabled: boolean;
    autoDetectDatabase: boolean;
    defaultDatabase: DatabaseType;
    showExecutionTime: boolean;
    sessionTimeout: number;
    formatSql: boolean;
}

/**
 * SQL record for WebView display
 * Simplified version of ConvertedSql for table rendering
 */
export interface SqlRecord {
    id: number;                    // Auto-increment ID for display
    mapper: string;                // Mapper interface name
    executionTime?: number;        // SQL execution time in milliseconds
    rowsAffected?: number;         // Number of rows affected (extracted from totalLine)
    sql: string;                   // Formatted SQL statement (convertedSql)
    timestamp: Date;               // Execution timestamp
    threadInfo?: string;           // Thread information
    database: DatabaseType;        // Database type (for potential future filtering)
}
