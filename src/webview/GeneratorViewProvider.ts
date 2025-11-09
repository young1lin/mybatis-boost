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
            console.log('[GeneratorViewProvider] Received message:', data.type);
            switch (data.type) {
                case 'generate':
                    console.log('[GeneratorViewProvider] Handling generate request');
                    await this._handleGenerate(data.ddl);
                    break;
                case 'loadHistory':
                    console.log('[GeneratorViewProvider] Handling loadHistory request');
                    await this._handleLoadHistory();
                    break;
                case 'clearHistory':
                    console.log('[GeneratorViewProvider] Handling clearHistory request');
                    await this._handleClearHistory();
                    break;
                default:
                    console.log('[GeneratorViewProvider] Unknown message type:', data.type);
            }
        });
    }

    /**
     * Handle DDL generation request
     */
    private async _handleGenerate(ddl: string) {
        try {
            // Parse DDL
            const parseResult = parseDDLWithConfig(ddl);

            if (!parseResult.success || !parseResult.data) {
                this._view?.webview.postMessage({
                    type: 'generateResult',
                    success: false,
                    error: parseResult.error?.message || 'Failed to parse DDL'
                });
                return;
            }

            // Get workspace folder for output directory
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._view?.webview.postMessage({
                    type: 'generateResult',
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

            // Generate code
            const generator = new CodeGenerator(config, parseResult.data);

            // Get template directory path (handles both dev and production environments)
            // In production, templates are copied to dist/generator/template
            const templateDir = path.join(__dirname, 'generator', 'template');

            const results = [
                generator.generateEntity(path.join(templateDir, 'entity.ejs')),
                generator.generateMapper(path.join(templateDir, 'mapper.ejs')),
                generator.generateMapperXml(path.join(templateDir, 'mapper-xml.ejs')),
                generator.generateService(path.join(templateDir, 'service.ejs'))
            ];

            // Save history record
            await this._saveHistoryRecord(ddl, results);

            // Send results back to webview
            this._view?.webview.postMessage({
                type: 'generateResult',
                success: true,
                results: results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    type: r.type
                }))
            });

            // Show success message
            vscode.window.showInformationMessage(`Successfully generated ${results.length} files`);

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'generateResult',
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
        console.log('[GeneratorViewProvider] _handleClearHistory called');
        console.log('[GeneratorViewProvider] Current history before clear:', this._getHistory());

        await this._context.globalState.update(HISTORY_STORAGE_KEY, []);
        console.log('[GeneratorViewProvider] GlobalState updated to empty array');

        console.log('[GeneratorViewProvider] History after clear:', this._getHistory());

        // Notify webview that history was cleared
        this._view?.webview.postMessage({
            type: 'historyCleared'
        });
        console.log('[GeneratorViewProvider] Sent historyCleared message to webview');

        // Show success message to user
        vscode.window.showInformationMessage('History cleared successfully');
        console.log('[GeneratorViewProvider] Showed success notification');
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
