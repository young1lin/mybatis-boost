/**
 * Debug adapter tracker factory for intercepting console output
 */

import * as vscode from 'vscode';
import { LogParser } from '../parser/LogParser';
import { ThreadSessionManager } from '../parser/ThreadSessionManager';
import { ParameterParser } from '../parser/ParameterParser';
import { SqlConverter } from '../converter/SqlConverter';
import { DatabaseDialect } from '../converter/DatabaseDialect';
import { SqlOutputChannel } from '../output/SqlOutputChannel';
import { LogType, ConvertedSql } from '../types';

/**
 * Factory for creating debug adapter trackers
 */
export class DebugTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    private sessionManager: ThreadSessionManager;
    private outputChannel: SqlOutputChannel;
    private enabled: boolean = true;

    constructor() {
        this.sessionManager = new ThreadSessionManager(5000);
        this.outputChannel = new SqlOutputChannel();
    }

    /**
     * Create debug adapter tracker for a debug session
     */
    createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        if (!this.enabled) {
            console.log('[MyBatis Console] Tracker factory disabled, skipping');
            return undefined;
        }

        console.log(`[MyBatis Console] Creating debug tracker for session: ${session.name} (type: ${session.type})`);

        return {
            onDidSendMessage: (message: any) => {
                this.handleMessage(message);
            }
        };
    }

    /**
     * Handle debug adapter protocol message
     */
    private handleMessage(message: any): void {
        // Check if it's an output event
        if (message.type !== 'event' || message.event !== 'output') {
            return;
        }

        const output = message.body?.output;
        if (!output || typeof output !== 'string') {
            return;
        }

        // Log first output to verify we're receiving messages
        if (!this.hasReceivedOutput) {
            this.hasReceivedOutput = true;
            console.log('[MyBatis Console] Started receiving debug output');
        }

        // Process each line
        const lines = output.split('\n');
        for (const line of lines) {
            this.processLine(line);
        }
    }

    private hasReceivedOutput = false;

    /**
     * Process a single line of output
     */
    private processLine(line: string): void {
        if (!line || !line.trim()) {
            return;
        }

        // Log first 10 lines to help diagnose format issues
        if (this.lineCount < 10) {
            this.lineCount++;
            console.log(`[MyBatis Console] Raw line ${this.lineCount}: ${line.substring(0, 150)}`);
        }

        // Check if it's a MyBatis log line
        const isMyBatis = LogParser.isMyBatisLog(line);

        // Log detection result for first few potential MyBatis lines
        if (this.lineCount <= 10 && (line.includes('Preparing') || line.includes('Parameters') || line.includes('Total'))) {
            console.log(`[MyBatis Console] Line contains MyBatis keyword, isMyBatis=${isMyBatis}`);
        }

        if (!isMyBatis) {
            return;
        }

        // Log first MyBatis log to confirm detection
        if (!this.hasDetectedMyBatis) {
            this.hasDetectedMyBatis = true;
            console.log('[MyBatis Console] Detected MyBatis log, starting SQL conversion');
        }

        // Parse the log line
        const entry = LogParser.parse(line);
        if (!entry) {
            console.log('[MyBatis Console] Failed to parse MyBatis log');
            return;
        }

        // Update session
        const session = this.sessionManager.updateSession(entry);

        // Handle based on log type
        switch (entry.logType) {
            case LogType.Preparing:
                // Just cache, wait for parameters
                console.log(`[MyBatis Console] Cached SQL: ${session.preparing?.sql?.substring(0, 50)}...`);
                break;

            case LogType.Parameters:
                // Parse parameters and store
                const paramString = LogParser.extractParameterString(entry.content);
                if (paramString && session.parameters) {
                    session.parameters.params = ParameterParser.parse(paramString);
                    console.log(`[MyBatis Console] Cached ${session.parameters.params.length} parameters`);
                }
                break;

            case LogType.Total:
                // Convert and output if session is complete
                if (this.sessionManager.isSessionComplete(session)) {
                    console.log('[MyBatis Console] Converting and outputting SQL');
                    this.convertAndOutput(session, entry.rawLine);
                    this.sessionManager.removeSession(session.sessionId);
                }
                break;
        }
    }

    private hasDetectedMyBatis = false;
    private lineCount = 0;

    /**
     * Convert SQL and output to channel
     */
    private convertAndOutput(session: any, totalLine: string): void {
        if (!session.preparing || !session.parameters) {
            return;
        }

        const sql = session.preparing.sql;
        const params = session.parameters.params;

        // Validate parameter count
        const validation = SqlConverter.validateParameterCount(sql, params);
        if (!validation.valid) {
            this.outputChannel.showError(
                `Parameter count mismatch: expected ${validation.expected}, got ${validation.actual}`
            );
            return;
        }

        // Detect database type
        const dbType = DatabaseDialect.detectDatabase(sql);

        // Convert SQL
        const convertedSql = SqlConverter.convert(sql, params, dbType);

        // Calculate execution time
        const preparingTime = new Date(session.preparing.timestamp).getTime();
        const parametersTime = new Date(session.parameters.timestamp).getTime();
        const executionTime = Math.abs(parametersTime - preparingTime);

        // Build thread info
        let threadInfo: string | undefined;
        if (session.threadId && session.threadName) {
            threadInfo = `${session.threadId} [${session.threadName}]`;
        } else if (session.threadId) {
            threadInfo = session.threadId;
        }

        // Create result
        const result: ConvertedSql = {
            originalSql: sql,
            convertedSql,
            database: dbType,
            parameters: params,
            executionTime,
            mapper: session.mapper,
            timestamp: session.preparing.timestamp,
            threadInfo,
            preparingLine: session.preparing.rawLine,
            parametersLine: session.parameters.rawLine,
            totalLine
        };

        // Output to channel
        this.outputChannel.show(result);
    }

    /**
     * Enable/disable interception
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Check if enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Clear output channel
     */
    public clearOutput(): void {
        this.outputChannel.clear();
    }

    /**
     * Export logs to file
     */
    public async exportLogs(): Promise<void> {
        await this.outputChannel.exportLogs();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.sessionManager.dispose();
        this.outputChannel.dispose();
    }
}
