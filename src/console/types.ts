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
