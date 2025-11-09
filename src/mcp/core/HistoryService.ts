/**
 * History service for storing and querying generation history
 * Supports multiple storage backends (GlobalState, file system, etc.)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * History record structure
 */
export interface HistoryRecord {
    timestamp: number;
    ddl: string;
    results: Array<{
        name: string;
        outputPath: string;
        content: string;
        type: 'java' | 'xml';
    }>;
}

/**
 * History query result
 */
export interface HistoryQueryResult {
    success: boolean;
    totalRecords: number;
    returnedRecords: number;
    history?: Array<{
        timestamp: number;
        timestampFormatted: string;
        ddl: string;
        filesCount: number;
        files: Array<{
            name: string;
            outputPath: string;
            type: string;
            contentPreview: string;
        }>;
    }>;
    error?: string;
}

/**
 * Storage backend interface
 */
export interface HistoryStorageBackend {
    getHistory(): HistoryRecord[];
    saveHistory(history: HistoryRecord[]): Promise<void>;
}

/**
 * File system storage backend
 */
export class FileSystemHistoryStorage implements HistoryStorageBackend {
    private historyFilePath: string;

    constructor(historyFilePath?: string) {
        // Default to user home directory
        this.historyFilePath = historyFilePath || path.join(
            os.homedir(),
            '.mybatis-boost',
            'mcp-history.json'
        );
    }

    getHistory(): HistoryRecord[] {
        try {
            if (fs.existsSync(this.historyFilePath)) {
                const data = fs.readFileSync(this.historyFilePath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to read history:', error);
        }
        return [];
    }

    async saveHistory(history: HistoryRecord[]): Promise<void> {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.historyFilePath);
            await fs.promises.mkdir(dir, { recursive: true });

            // Write history
            await fs.promises.writeFile(
                this.historyFilePath,
                JSON.stringify(history, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }
}

/**
 * History service for managing generation history
 */
export class HistoryService {
    private static readonly MAX_HISTORY_SIZE = 30;

    /**
     * Query history records
     */
    static queryHistory(
        storage: HistoryStorageBackend,
        limit: number = 10
    ): HistoryQueryResult {
        try {
            const history = storage.getHistory();
            const effectiveLimit = Math.min(limit, this.MAX_HISTORY_SIZE);
            const limitedHistory = history.slice(0, effectiveLimit);

            const historyData = limitedHistory.map(record => ({
                timestamp: record.timestamp,
                timestampFormatted: new Date(record.timestamp).toISOString(),
                ddl: record.ddl,
                filesCount: record.results.length,
                files: record.results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    type: r.type,
                    contentPreview: r.content.substring(0, 200) + '...'
                }))
            }));

            return {
                success: true,
                totalRecords: history.length,
                returnedRecords: limitedHistory.length,
                history: historyData
            };
        } catch (error) {
            return {
                success: false,
                totalRecords: 0,
                returnedRecords: 0,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Save history record
     */
    static async saveHistoryRecord(
        storage: HistoryStorageBackend,
        ddl: string,
        results: Array<{
            name: string;
            outputPath: string;
            content: string;
            type: 'java' | 'xml';
        }>
    ): Promise<void> {
        let history = storage.getHistory();

        // Add new record
        history.unshift({
            timestamp: Date.now(),
            ddl,
            results
        });

        // Keep only latest MAX_HISTORY_SIZE records
        if (history.length > this.MAX_HISTORY_SIZE) {
            history = history.slice(0, this.MAX_HISTORY_SIZE);
        }

        await storage.saveHistory(history);
    }
}
