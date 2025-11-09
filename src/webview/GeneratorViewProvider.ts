/**
 * MyBatis Generator WebView Provider
 * Provides a sidebar panel for generating MyBatis code from DDL statements
 */

import * as vscode from 'vscode';
import { parseDDLWithConfig } from '../generator/vscodeHelper';
import { CodeGenerator, GeneratorConfig } from '../generator/template/templateGenerator';
import { GenerateReuslt } from '../generator/type';
import * as path from 'path';
import * as fs from 'fs';

/**
 * History record structure
 * Stores DDL and generated results with full content for history tracking
 */
interface HistoryRecord {
    timestamp: number;
    ddl: string;
    results: GenerateReuslt[]; // Contains full content for each generated file
}

/**
 * Maximum number of history records to store
 */
const MAX_HISTORY_SIZE = 30;

/**
 * Storage key for history records in GlobalState
 */
const HISTORY_STORAGE_KEY = 'mybatis-boost.generator.history';

/**
 * WebView Provider for MyBatis Generator sidebar panel
 */
export class GeneratorViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'mybatis-boost.generatorView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) { }

    /**
     * Resolve WebView view when it becomes visible
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'preview':
                    await this._handlePreview(data.ddl);
                    break;
                case 'export':
                    console.log('[Export] Received data:', JSON.stringify(data, null, 2));
                    console.log('[Export] Results type:', typeof data.results);
                    console.log('[Export] Results is array:', Array.isArray(data.results));
                    await this._handleExport(data.ddl, data.results);
                    break;
                case 'loadHistory':
                    await this._handleLoadHistory();
                    break;
                case 'clearHistory':
                    await this._handleClearHistory();
                    break;
            }
        });
    }

    /**
     * Handle preview request - generate code without writing files
     */
    private async _handlePreview(ddl: string) {
        try {
            // Parse DDL
            const parseResult = parseDDLWithConfig(ddl);

            if (!parseResult.success || !parseResult.data) {
                this._view?.webview.postMessage({
                    type: 'previewResult',
                    success: false,
                    error: parseResult.error?.message || 'Failed to parse DDL'
                });
                return;
            }

            // Get workspace folder for output directory
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._view?.webview.postMessage({
                    type: 'previewResult',
                    success: false,
                    error: 'No workspace folder found'
                });
                return;
            }

            const outputDir = workspaceFolders[0].uri.fsPath;

            // Hardcoded generator configuration (MVP)
            const config: GeneratorConfig = {
                basePackage: 'com.example.mybatis',
                author: 'MyBatis Boost',
                outputDir: outputDir,
                useLombok: true,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: false,
                entitySuffix: 'PO',
                mapperSuffix: 'Mapper',
                serviceSuffix: 'Service'
            };

            // Generate code (in memory only, don't write files yet)
            const generator = new CodeGenerator(config, parseResult.data);

            // Get template directory path
            const templateDir = path.join(__dirname, 'generator', 'template');

            const results = [
                generator.generateEntity(path.join(templateDir, 'entity.ejs')),
                generator.generateMapper(path.join(templateDir, 'mapper.ejs')),
                generator.generateMapperXml(path.join(templateDir, 'mapper-xml.ejs')),
                generator.generateService(path.join(templateDir, 'service.ejs'))
            ];

            // Send preview results to webview (with full content)
            this._view?.webview.postMessage({
                type: 'previewResult',
                success: true,
                results: results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    content: r.content,
                    type: r.type
                }))
            });

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'previewResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }

    /**
     * Handle export request - write files and save to history
     */
    private async _handleExport(ddl: string, results: any) {
        try {
            // Ensure results is an array
            if (!results || !Array.isArray(results)) {
                throw new Error('Invalid results format: expected an array');
            }

            console.log('[Export] Starting file export for', results.length, 'files');

            // Write files to disk
            for (const result of results) {
                console.log('[Export] Writing file:', result.outputPath);

                // Ensure directory exists
                const dir = path.dirname(result.outputPath);
                console.log('[Export] Ensuring directory exists:', dir);
                await fs.promises.mkdir(dir, { recursive: true });

                // Write file
                await fs.promises.writeFile(result.outputPath, result.content, 'utf-8');
                console.log('[Export] Successfully wrote:', result.outputPath);
            }

            console.log('[Export] All files written successfully');

            // Save to history
            await this._saveHistoryRecord(ddl, results);

            // Send success message to webview
            this._view?.webview.postMessage({
                type: 'exportResult',
                success: true,
                results: results.map((r: GenerateReuslt) => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    type: r.type
                }))
            });

            // Show success notification
            vscode.window.showInformationMessage(`Successfully exported ${results.length} files`);

        } catch (error) {
            console.error('[Export] Error during export:', error);
            this._view?.webview.postMessage({
                type: 'exportResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }

    /**
     * Load history from GlobalState and send to webview
     */
    private async _handleLoadHistory() {
        const history = this._getHistory();
        this._view?.webview.postMessage({
            type: 'historyLoaded',
            history: history.map(record => ({
                timestamp: record.timestamp,
                ddl: record.ddl,
                resultsCount: record.results.length,
                results: record.results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    content: r.content,
                    type: r.type
                }))
            }))
        });
    }

    /**
     * Clear all history records
     */
    private async _handleClearHistory() {
        // Show confirmation dialog (VS Code native, not blocked by sandbox)
        const confirmed = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all history records? This action cannot be undone.',
            { modal: true },
            'Clear History'
        );

        if (confirmed !== 'Clear History') {
            return;
        }

        await this._context.globalState.update(HISTORY_STORAGE_KEY, []);

        // Notify webview that history was cleared
        this._view?.webview.postMessage({
            type: 'historyCleared'
        });

        // Show success message to user
        vscode.window.showInformationMessage('History cleared successfully');
    }

    /**
     * Save history record to GlobalState
     */
    private async _saveHistoryRecord(ddl: string, results: GenerateReuslt[]) {
        let history = this._getHistory();

        // Add new record
        history.unshift({
            timestamp: Date.now(),
            ddl,
            results
        });

        // Keep only latest MAX_HISTORY_SIZE records
        if (history.length > MAX_HISTORY_SIZE) {
            history = history.slice(0, MAX_HISTORY_SIZE);
        }

        await this._context.globalState.update(HISTORY_STORAGE_KEY, history);

        // Notify webview
        this._view?.webview.postMessage({
            type: 'historyUpdated',
            history: history.map(record => ({
                timestamp: record.timestamp,
                ddl: record.ddl,
                resultsCount: record.results.length,
                results: record.results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    content: r.content,
                    type: r.type
                }))
            }))
        });
    }

    /**
     * Get history records from GlobalState
     */
    private _getHistory(): HistoryRecord[] {
        return this._context.globalState.get<HistoryRecord[]>(HISTORY_STORAGE_KEY, []);
    }

    /**
     * Generate HTML content for webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get icon URI
        const iconPath = vscode.Uri.joinPath(this._extensionUri, 'images', 'icons', 'MyBatis.svg');
        const iconUri = webview.asWebviewUri(iconPath);

        // Generate nonce for CSP
        const nonce = this._getNonce();

        // Read HTML template from file
        const htmlPath = path.join(__dirname, 'webview', 'generator.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        // Replace placeholders
        html = html.replace(/{{iconUri}}/g, iconUri.toString());
        html = html.replace(/{{nonce}}/g, nonce);
        html = html.replace(/{{cspSource}}/g, webview.cspSource);

        return html;
    }

    /**
     * Generate a nonce for Content Security Policy
     */
    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
