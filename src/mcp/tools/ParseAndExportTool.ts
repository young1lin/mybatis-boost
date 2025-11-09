/**
 * Tool: Parse SQL and immediately export (combined operation)
 * VS Code Language Model Tool implementation
 */

import * as vscode from 'vscode';
import { GeneratorService, GeneratorServiceConfig } from '../core/GeneratorService';
import { FileExportService, ExportFile } from '../core/FileExportService';
import { HistoryService, HistoryStorageBackend, HistoryRecord } from '../core/HistoryService';

interface ParseAndExportInput {
    ddl: string;
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
 * Tool for parsing SQL and immediately exporting files (combined operation)
 */
export class ParseAndExportTool implements vscode.LanguageModelTool<ParseAndExportInput> {

    private context: vscode.ExtensionContext;
    private historyStorage: VSCodeHistoryStorage;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.historyStorage = new VSCodeHistoryStorage(context);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ParseAndExportInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {

        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        const { ddl } = options.input;

        // Load configuration
        const config = this.loadConfiguration();

        // Step 1: Parse and generate
        const generateResult = GeneratorService.parseSqlAndGenerate(ddl, config);

        if (!generateResult.success || !generateResult.results) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({
                    success: false,
                    error: generateResult.error
                }, null, 2))
            ]);
        }

        // Step 2: Export files
        const exportResult = await FileExportService.exportFiles(generateResult.results as ExportFile[]);

        if (exportResult.success) {
            // Save to history
            await HistoryService.saveHistoryRecord(this.historyStorage, ddl, generateResult.results);

            // Show success notification
            vscode.window.showInformationMessage(
                `Successfully parsed and exported ${generateResult.results.length} files via Language Model Tool`
            );
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
                ...exportResult,
                message: exportResult.success
                    ? `Successfully parsed and exported ${generateResult.results.length} files`
                    : exportResult.error
            }, null, 2))
        ]);
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfiguration(): GeneratorServiceConfig {
        const config = vscode.workspace.getConfiguration('mybatis-boost.generator');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const outputDir = workspaceFolders && workspaceFolders.length > 0
            ? workspaceFolders[0].uri.fsPath
            : '';

        return {
            basePackage: config.get<string>('basePackage', 'com.example.mybatis'),
            author: config.get<string>('author', 'MyBatis Boost'),
            outputDir: outputDir,
            useLombok: config.get<boolean>('useLombok', true),
            useSwagger: config.get<boolean>('useSwagger', false),
            useSwaggerV3: config.get<boolean>('useSwaggerV3', false),
            useMyBatisPlus: config.get<boolean>('useMyBatisPlus', false),
            entitySuffix: config.get<string>('entitySuffix', 'PO'),
            mapperSuffix: config.get<string>('mapperSuffix', 'Mapper'),
            serviceSuffix: config.get<string>('serviceSuffix', 'Service'),
            datetime: config.get<'Date' | 'LocalDateTime' | 'Instant'>('datetime', 'LocalDateTime')
        };
    }
}
