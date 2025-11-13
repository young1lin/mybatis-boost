/**
 * Output channel for displaying converted SQL
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConvertedSql, DatabaseType } from '../types';
import { SqlConverter } from '../converter/SqlConverter';

/**
 * Manage output channel for MyBatis SQL console
 */
export class SqlOutputChannel {
    private outputChannel: vscode.OutputChannel;
    private logHistory: string[] = [];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('MyBatis SQL Console');
    }

    /**
     * Show converted SQL in output channel
     */
    public show(result: ConvertedSql): void {
        // Get formatSql configuration
        const config = vscode.workspace.getConfiguration('mybatis-boost.console');
        const shouldFormat = config.get<boolean>('formatSql', true);

        const lines: string[] = [];

        // Mapper info as SQL comment
        if (result.mapper) {
            lines.push(`-- Mapper: ${result.mapper}`);
        }

        // Thread info as SQL comment (extract thread name only)
        if (result.threadInfo) {
            const threadName = this.extractThreadName(result.threadInfo);
            lines.push(`-- Thread: [${threadName}]`);
        }

        // Execution time as SQL comment
        if (result.executionTime !== undefined && result.executionTime >= 0) {
            lines.push(`-- Execution Time: ${result.executionTime}ms`);
        }

        // Rows affected as SQL comment (extract from totalLine)
        if (result.totalLine) {
            const rowsAffected = this.extractRowsAffected(result.totalLine);
            if (rowsAffected !== null) {
                lines.push(`-- Rows Affected: ${rowsAffected}`);
            }
        }

        // Empty line separator between metadata and SQL
        lines.push('');

        // Format SQL if enabled
        const displaySql = shouldFormat
            ? SqlConverter.formatSql(result.convertedSql, result.database)
            : result.convertedSql;

        // Converted SQL without "SQL:" label
        lines.push(displaySql);

        // Visual separator
        lines.push('');
        lines.push('─'.repeat(80));
        lines.push('');

        const output = lines.join('\n');
        this.outputChannel.appendLine(output);

        // Save to history for export (with size limit)
        this.addToHistory(output);
    }

    /**
     * Extract thread name from thread info string
     * Input formats: "166244 [main]" or "[main]" or "166244"
     * Output: thread name only (e.g., "main")
     */
    private extractThreadName(threadInfo: string): string {
        // Match thread name in brackets: [name]
        const bracketMatch = threadInfo.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
            return bracketMatch[1];
        }

        // If no brackets found, remove leading numbers and whitespace
        const cleanName = threadInfo.replace(/^\d+\s*/, '').trim();
        return cleanName || threadInfo;
    }

    /**
     * Extract rows affected from total line
     * Input formats: "Total: 5" or "Updates: 1"
     * Output: number of rows affected or null if not found
     */
    private extractRowsAffected(totalLine: string): number | null {
        // Match "Total: N" or "Updates: N"
        const match = totalLine.match(/(?:Total|Updates):\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Add entry to history with size limit enforcement
     * Removes oldest entries if history exceeds configured limit
     */
    private addToHistory(entry: string): void {
        const config = vscode.workspace.getConfiguration('mybatis-boost.console');
        const historyLimit = config.get<number>('historyLimit', 5000);

        this.logHistory.push(entry);

        // Remove oldest entries if exceeds limit
        if (this.logHistory.length > historyLimit) {
            const excessCount = this.logHistory.length - historyLimit;
            this.logHistory.splice(0, excessCount);
        }
    }

    /**
     * Show error message
     */
    public showError(message: string): void {
        const output = `[ERROR] ${message}`;
        this.outputChannel.appendLine(output);
        this.addToHistory(output);
    }

    /**
     * Show info message
     */
    public showInfo(message: string): void {
        const output = `[INFO] ${message}`;
        this.outputChannel.appendLine(output);
        this.addToHistory(output);
    }

    /**
     * Clear output channel
     */
    public clear(): void {
        this.outputChannel.clear();
        this.logHistory = [];
    }

    /**
     * Export logs to file
     */
    public async exportLogs(): Promise<void> {
        if (this.logHistory.length === 0) {
            vscode.window.showWarningMessage('No logs to export');
            return;
        }

        // Prompt user to select export location
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(this.getDefaultExportPath(), `mybatis-sql-${this.getTimestamp()}.log`)),
            filters: {
                'Log Files': ['log'],
                'Text Files': ['txt'],
                'All Files': ['*']
            }
        });

        if (!uri) {
            return; // User cancelled
        }

        try {
            // Write logs to file
            const content = this.logHistory.join('\n');
            await fs.promises.writeFile(uri.fsPath, content, 'utf-8');

            vscode.window.showInformationMessage(`Logs exported to ${uri.fsPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export logs: ${error}`);
        }
    }

    /**
     * Get default export path
     */
    private getDefaultExportPath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return process.env.HOME || process.env.USERPROFILE || '/tmp';
    }

    /**
     * Get current timestamp for filename
     */
    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    }

    /**
     * Dispose output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
        this.logHistory = [];
    }
}
