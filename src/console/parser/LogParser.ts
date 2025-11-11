/**
 * MyBatis log parser supporting multiple log formats
 *
 * Supports both strict patterns (Spring Boot 2/3, standard formats) and
 * loose pattern (any custom log format containing MyBatis keywords)
 */

import { LogEntry, LogType } from '../types';

/**
 * Parse MyBatis log line and extract information
 */
export class LogParser {
    // === STRICT PATTERNS (for fast matching common formats) ===

    // Standard format: 2025-01-15 10:30:45.123 DEBUG com.example.UserMapper.selectById - ==>  Preparing: SELECT * FROM user WHERE id = ?
    private static readonly STANDARD_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+DEBUG\s+([\w.]+)\s+-\s+(==>|<==)\s+(.+)$/;

    // Custom format with traceId and thread: [traceId:] 2025-11-11 16:51:45.067 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition : ==> Preparing: SELECT ...
    private static readonly CUSTOM_PATTERN = /^\[traceId:.*?\]\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+DEBUG\s+(\d+)\s+---\s+\[(.*?)\]\s+([\w.]+)\s*:\s+(==>|<==)\s+(.+)$/;

    // Spring Boot 3.x format: 2025-11-11T17:48:05.123+08:00 DEBUG 126048 --- [app-name] [thread-name] c.y.m.b.mapper.UserMapper.selectById : ==> Preparing: SELECT ...
    private static readonly SPRING_BOOT_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2})\s+DEBUG\s+(\d+)\s+---\s+\[([\w\s-]+)\]\s+\[([\w\s-]+)\]\s+([\w.]+)\s*:\s+(==>|<==)\s+(.+)$/;

    // === LOOSE PATTERN (for any custom log format) ===
    // Must contain MyBatis arrow (==> or <=>) and keyword (Preparing/Parameters/Total/Updates)
    // Format examples:
    //   - ==> Preparing: SELECT * FROM user
    //   - 2025/01/15 10:30:45 UserMapper ==> Preparing: SELECT ...
    //   - [DEBUG] UserMapper - ==> Preparing: SELECT ...
    //   - DEBUG | UserMapper | ==> Preparing: SELECT ...
    private static readonly LOOSE_PATTERN = /(==>|<==)\s+(Preparing:|Parameters:|Total:|Updates:)\s+(.+)$/;

    // Timestamp pattern (try to extract timestamp from various formats)
    private static readonly TIMESTAMP_PATTERNS = [
        /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:[+-]\d{2}:\d{2})?)/,  // ISO format
        /(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/,  // yyyy/MM/dd format
        /(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/  // Time only (fallback)
    ];

    // Mapper name pattern (try to extract mapper/logger name)
    private static readonly MAPPER_PATTERNS = [
        /([\w.]+)\s*[:-]\s*==/,  // mapper: ==> or mapper - ==>
        /\[\s*([\w.]+)\s*\]\s*==/,  // [mapper] ==>
        /\|\s*([\w.]+)\s*\|\s*==/,  // | mapper | ==>
        /([\w.]+)\s+==>/  // mapper ==> (direct, no separator)
    ];

    /**
     * Check if a line is a MyBatis log line
     * First tries strict patterns (fast), then falls back to loose pattern
     */
    public static isMyBatisLog(line: string): boolean {
        if (!line || typeof line !== 'string') {
            return false;
        }

        const trimmed = line.trim();

        // Try strict patterns first (faster)
        if (this.STANDARD_PATTERN.test(trimmed) ||
            this.CUSTOM_PATTERN.test(trimmed) ||
            this.SPRING_BOOT_PATTERN.test(trimmed)) {
            return true;
        }

        // Fall back to loose pattern (matches any format with MyBatis keywords)
        return this.LOOSE_PATTERN.test(trimmed);
    }

    /**
     * Parse a MyBatis log line
     * First tries strict patterns, then falls back to loose pattern
     */
    public static parse(line: string): LogEntry | null {
        if (!line || typeof line !== 'string') {
            return null;
        }

        const trimmed = line.trim();

        // Try Spring Boot format first (most specific)
        const springBootMatch = trimmed.match(this.SPRING_BOOT_PATTERN);
        if (springBootMatch) {
            return this.parseSpringBootFormat(springBootMatch, trimmed);
        }

        // Try custom format (more specific than standard)
        const customMatch = trimmed.match(this.CUSTOM_PATTERN);
        if (customMatch) {
            return this.parseCustomFormat(customMatch, trimmed);
        }

        // Try standard format
        const standardMatch = trimmed.match(this.STANDARD_PATTERN);
        if (standardMatch) {
            return this.parseStandardFormat(standardMatch, trimmed);
        }

        // Fall back to loose pattern (any custom format)
        const looseMatch = trimmed.match(this.LOOSE_PATTERN);
        if (looseMatch) {
            return this.parseLooseFormat(trimmed, looseMatch);
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
     * Parse Spring Boot 3.x format log
     */
    private static parseSpringBootFormat(match: RegExpMatchArray, rawLine: string): LogEntry {
        const [, timestamp, processId, appName, threadName, mapper, arrow, content] = match;

        return {
            timestamp,
            threadId: processId,
            threadName: threadName.trim(),
            mapper,
            logType: this.parseLogType(content),
            content: content.trim(),
            rawLine
        };
    }

    /**
     * Parse loose format log (custom log formats)
     * Tries to extract timestamp and mapper from the line, uses defaults if not found
     */
    private static parseLooseFormat(rawLine: string, looseMatch: RegExpMatchArray): LogEntry {
        const [, arrow, keyword, contentAfterKeyword] = looseMatch;
        const content = `${keyword} ${contentAfterKeyword}`.trim();

        // Try to extract timestamp
        let timestamp: string | undefined;
        for (const pattern of this.TIMESTAMP_PATTERNS) {
            const match = rawLine.match(pattern);
            if (match) {
                timestamp = match[1];
                break;
            }
        }

        // Try to extract mapper name
        let mapper: string | undefined;
        for (const pattern of this.MAPPER_PATTERNS) {
            const match = rawLine.match(pattern);
            if (match) {
                mapper = match[1];
                break;
            }
        }

        // Use defaults if not found
        if (!timestamp) {
            timestamp = new Date().toISOString();
        }
        if (!mapper) {
            mapper = 'UnknownMapper';
        }

        return {
            timestamp,
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

        if (trimmed.startsWith('Updates:')) {
            return LogType.Updates;
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

    /**
     * Extract updates count from Updates log content (for INSERT/UPDATE/DELETE)
     */
    public static extractUpdates(content: string): number | null {
        const match = content.match(/^Updates:\s*(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }
}
