/**
 * Tool: Query generation history
 * VS Code Language Model Tool implementation
 */

import * as vscode from 'vscode';
import { HistoryService, HistoryStorageBackend, HistoryRecord } from '../core/HistoryService';

interface QueryHistoryInput {
    limit?: number;
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
 * Tool for querying generation history
 */
export class QueryGenerationHistoryTool implements vscode.LanguageModelTool<QueryHistoryInput> {

    private context: vscode.ExtensionContext;
    private historyStorage: VSCodeHistoryStorage;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.historyStorage = new VSCodeHistoryStorage(context);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<QueryHistoryInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {

        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        const limit = options.input.limit || 10;

        // Query history using service
        const result = HistoryService.queryHistory(this.historyStorage, limit);

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2))
        ]);
    }
}
