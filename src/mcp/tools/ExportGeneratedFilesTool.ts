/**
 * Tool: Export generated files to disk
 * VS Code Language Model Tool implementation
 */

import * as vscode from 'vscode';
import { FileExportService, ExportFile } from '../core/FileExportService';
import { HistoryService, HistoryStorageBackend, HistoryRecord } from '../core/HistoryService';

interface ExportFilesInput {
    ddl: string;
    results: ExportFile[];
}

/**
 * VS Code GlobalState history storage backend
 */
class VSCodeHistoryStorage implements HistoryStorageBackend {
    private static readonly STORAGE_KEY = 'mybatis-boost.mcp.history';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    getHistory(): HistoryRecord[] {
        return this.context.globalState.get<HistoryRecord[]>(VSCodeHistoryStorage.STORAGE_KEY, []);
    }

    async saveHistory(history: HistoryRecord[]): Promise<void> {
        await this.context.globalState.update(VSCodeHistoryStorage.STORAGE_KEY, history);
    }
}

/**
 * Tool for exporting generated files to disk
 */
export class ExportGeneratedFilesTool implements vscode.LanguageModelTool<ExportFilesInput> {

    private context: vscode.ExtensionContext;
    private historyStorage: VSCodeHistoryStorage;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.historyStorage = new VSCodeHistoryStorage(context);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ExportFilesInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {

        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        const { ddl, results } = options.input;

        // Export files using service
        const exportResult = await FileExportService.exportFiles(results);

        if (exportResult.success) {
            // Save to history
            await HistoryService.saveHistoryRecord(this.historyStorage, ddl, results);

            // Show success notification
            vscode.window.showInformationMessage(
                `Successfully exported ${results.length} files via Language Model Tool`
            );
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
                ...exportResult,
                message: exportResult.success
                    ? `Successfully exported ${results.length} files`
                    : exportResult.error
            }, null, 2))
        ]);
    }
}
