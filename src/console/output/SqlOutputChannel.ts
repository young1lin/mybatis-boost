/**
 * Output channel for displaying converted SQL
 */

import * as vscode from 'vscode';
import { ConvertedSql, DatabaseType } from '../types';

/**
 * Manage output channel for MyBatis SQL console
 */
export class SqlOutputChannel {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('MyBatis SQL Console');
    }

    /**
     * Show converted SQL in output channel
     */
    public show(result: ConvertedSql): void {
        this.outputChannel.show(true); // Preserve focus

        const separator = '─'.repeat(80);
        const lines: string[] = [];

        // Header with timestamp
        lines.push('');
        lines.push(separator);
        lines.push(`[MyBatis SQL Console - ${result.timestamp}]`);
        lines.push(`Mapper: ${result.mapper}`);

        // Thread info if available
        if (result.threadInfo) {
            lines.push(`Thread: ${result.threadInfo}`);
        }

        lines.push('');

        // Original Preparing line
        lines.push(result.preparingLine);

        // Original Parameters line
        lines.push(result.parametersLine);

        lines.push('');

        // Converted SQL with box
        lines.push(`Converted SQL (${this.getDatabaseDisplayName(result.database)}):`);
        lines.push('┌' + '─'.repeat(78) + '┐');
        lines.push('│ ' + this.padRight(result.convertedSql, 77) + '│');
        lines.push('└' + '─'.repeat(78) + '┘');

        lines.push('');

        // Execution time if available
        if (result.executionTime !== undefined && result.executionTime >= 0) {
            lines.push(`Execution Time: ${result.executionTime}ms`);
        }

        // Total line if available
        if (result.totalLine) {
            lines.push(result.totalLine);
        }

        lines.push(separator);
        lines.push('');

        this.outputChannel.appendLine(lines.join('\n'));
    }

    /**
     * Show error message
     */
    public showError(message: string): void {
        this.outputChannel.appendLine(`[ERROR] ${message}`);
    }

    /**
     * Show info message
     */
    public showInfo(message: string): void {
        this.outputChannel.appendLine(`[INFO] ${message}`);
    }

    /**
     * Clear output channel
     */
    public clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Dispose output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }

    /**
     * Get database display name
     */
    private getDatabaseDisplayName(dbType: DatabaseType): string {
        switch (dbType) {
            case DatabaseType.MySQL:
                return 'MySQL';
            case DatabaseType.PostgreSQL:
                return 'PostgreSQL';
            case DatabaseType.Oracle:
                return 'Oracle';
            case DatabaseType.SQLServer:
                return 'SQL Server';
            default:
                return 'Unknown';
        }
    }

    /**
     * Pad string to right with spaces
     */
    private padRight(str: string, length: number): string {
        if (str.length >= length) {
            // Truncate if too long
            return str.substring(0, length - 3) + '...';
        }
        return str + ' '.repeat(length - str.length);
    }
}
