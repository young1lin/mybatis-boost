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
            return undefined;
        }

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

        // Process each line
        const lines = output.split('\n');
        for (const line of lines) {
            this.processLine(line);
        }
    }

    /**
     * Process a single line of output
     */
    private processLine(line: string): void {
        if (!line || !line.trim()) {
            return;
        }

        // Check if it's a MyBatis log line
        if (!LogParser.isMyBatisLog(line)) {
            return;
        }

        // Parse the log line
        const entry = LogParser.parse(line);
        if (!entry) {
            return;
        }

        // Update session
        const session = this.sessionManager.updateSession(entry);

        // Handle based on log type
        switch (entry.logType) {
            case LogType.Preparing:
                // Just cache, wait for parameters
                break;

            case LogType.Parameters:
                // Parse parameters and store
                const paramString = LogParser.extractParameterString(entry.content);
                if (paramString && session.parameters) {
                    session.parameters.params = ParameterParser.parse(paramString);
                }
                break;

            case LogType.Total:
                // Convert and output if session is complete
                if (this.sessionManager.isSessionComplete(session)) {
                    this.convertAndOutput(session, entry.rawLine);
                    this.sessionManager.removeSession(session.sessionId);
                }
                break;
        }
    }

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
     * Dispose resources
     */
    public dispose(): void {
        this.sessionManager.dispose();
        this.outputChannel.dispose();
    }
}
