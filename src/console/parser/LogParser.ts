/**
 * MyBatis log parser supporting multiple log formats
 */

import { LogEntry, LogType } from '../types';

/**
 * Parse MyBatis log line and extract information
 */
export class LogParser {
    // Standard format: 2025-01-15 10:30:45.123 DEBUG com.example.UserMapper.selectById - ==>  Preparing: SELECT * FROM user WHERE id = ?
    private static readonly STANDARD_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+DEBUG\s+([\w.]+)\s+-\s+(==>|<==)\s+(.+)$/;

    // Custom format with traceId and thread: [traceId:] 2025-11-11 16:51:45.067 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition : ==> Preparing: SELECT ...
    private static readonly CUSTOM_PATTERN = /^\[traceId:.*?\]\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+DEBUG\s+(\d+)\s+---\s+\[(.*?)\]\s+([\w.]+)\s*:\s+(==>|<==)\s+(.+)$/;

    /**
     * Check if a line is a MyBatis log line
     */
    public static isMyBatisLog(line: string): boolean {
        if (!line || typeof line !== 'string') {
            return false;
        }

        const trimmed = line.trim();
        return this.STANDARD_PATTERN.test(trimmed) || this.CUSTOM_PATTERN.test(trimmed);
    }

    /**
     * Parse a MyBatis log line
     */
    public static parse(line: string): LogEntry | null {
        if (!line || typeof line !== 'string') {
            return null;
        }

        const trimmed = line.trim();

        // Try custom format first (more specific)
        const customMatch = trimmed.match(this.CUSTOM_PATTERN);
        if (customMatch) {
            return this.parseCustomFormat(customMatch, trimmed);
        }

        // Try standard format
        const standardMatch = trimmed.match(this.STANDARD_PATTERN);
        if (standardMatch) {
            return this.parseStandardFormat(standardMatch, trimmed);
        }

        return null;
    }

    /**
     * Parse standard format log
     */
    private static parseStandardFormat(match: RegExpMatchArray, rawLine: string): LogEntry {
        const [, timestamp, mapper, arrow, content] = match;

        return {
            timestamp,
            mapper,
            logType: this.parseLogType(content),
            content: content.trim(),
            rawLine
        };
    }

    /**
     * Parse custom format log with thread info
     */
    private static parseCustomFormat(match: RegExpMatchArray, rawLine: string): LogEntry {
        const [, timestamp, threadId, threadName, mapper, arrow, content] = match;

        return {
            timestamp,
            threadId,
            threadName,
            mapper,
            logType: this.parseLogType(content),
            content: content.trim(),
            rawLine
        };
    }

    /**
     * Determine log type from content
     */
    private static parseLogType(content: string): LogType {
        const trimmed = content.trim();

        if (trimmed.startsWith('Preparing:')) {
            return LogType.Preparing;
        }

        if (trimmed.startsWith('Parameters:')) {
            return LogType.Parameters;
        }

        if (trimmed.startsWith('Total:')) {
            return LogType.Total;
        }

        return LogType.Unknown;
    }

    /**
     * Extract SQL from Preparing log content
     */
    public static extractSql(content: string): string | null {
        const match = content.match(/^Preparing:\s*(.+)$/);
        return match ? match[1].trim() : null;
    }

    /**
     * Extract parameter string from Parameters log content
     */
    public static extractParameterString(content: string): string | null {
        const match = content.match(/^Parameters:\s*(.+)$/);
        return match ? match[1].trim() : null;
    }

    /**
     * Extract total count from Total log content
     */
    public static extractTotal(content: string): number | null {
        const match = content.match(/^Total:\s*(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }
}
