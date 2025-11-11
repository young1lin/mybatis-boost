/**
 * Output channel for displaying converted SQL
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConvertedSql, DatabaseType } from '../types';

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
        this.outputChannel.show(true); // Preserve focus

        const lines: string[] = [];

        // Timestamp
        lines.push(`[${result.timestamp}]`);

        // Mapper (if available)
        if (result.mapper) {
            lines.push(`Mapper: ${result.mapper}`);
        }

        // Converted SQL (no length limit)
        lines.push(`SQL: ${result.convertedSql}`);

        // Execution time (if available)
        if (result.executionTime !== undefined && result.executionTime >= 0) {
            lines.push(`Time: ${result.executionTime}ms`);
        }

        lines.push(''); // Empty line separator

        const output = lines.join('\n');
        this.outputChannel.appendLine(output);

        // Save to history for export
        this.logHistory.push(output);
    }

    /**
     * Show error message
     */
    public showError(message: string): void {
        const output = `[ERROR] ${message}`;
        this.outputChannel.appendLine(output);
        this.logHistory.push(output);
    }

    /**
     * Show info message
     */
    public showInfo(message: string): void {
        const output = `[INFO] ${message}`;
        this.outputChannel.appendLine(output);
        this.logHistory.push(output);
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
