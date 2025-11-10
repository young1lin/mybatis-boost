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
 * Settings configuration structure
 * Stores user preferences for code generation
 */
interface SettingsConfig {
    basePackage: string;
    author: string;
    entitySuffix: string;
    mapperSuffix: string;
    serviceSuffix: string;
    datetime: string;
    useLombok: boolean;
    useSwagger: boolean;
    useSwaggerV3: boolean;
    useMyBatisPlus: boolean;
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
                case 'loadSettings':
                    await this._handleLoadSettings();
                    break;
                case 'saveSettings':
                    await this._handleSaveSettings({ settings: data.settings, configScope: data.configScope });
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

            // Load user settings or use defaults
            const settings = this._getSettings();
            const config: GeneratorConfig = {
                basePackage: settings.basePackage,
                author: settings.author,
                outputDir: outputDir,
                useLombok: settings.useLombok,
                useSwagger: settings.useSwagger,
                useSwaggerV3: settings.useSwaggerV3,
                useMyBatisPlus: settings.useMyBatisPlus,
                entitySuffix: settings.entitySuffix,
                mapperSuffix: settings.mapperSuffix,
                serviceSuffix: settings.serviceSuffix
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
     * Load settings from VS Code configuration and send to webview
     */
    private async _handleLoadSettings() {
        const settings = this._getSettings();
        const configScope = this._getConfigurationScope();

        this._view?.webview.postMessage({
            type: 'settingsLoaded',
            settings: settings,
            configScope: configScope
        });
    }

    /**
     * Save settings to VS Code configuration
     */
    private async _handleSaveSettings(data: { settings: SettingsConfig; configScope?: string }) {
        const { settings, configScope } = data;
        const config = vscode.workspace.getConfiguration('mybatis-boost.generator');

        // Determine configuration target
        let target: vscode.ConfigurationTarget;
        if (configScope === 'workspace') {
            // Check if workspace folder exists
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showWarningMessage(
                    'No workspace folder is open. Settings will be saved globally instead.'
                );
                target = vscode.ConfigurationTarget.Global;
            } else {
                target = vscode.ConfigurationTarget.Workspace;
            }
        } else {
            target = vscode.ConfigurationTarget.Global;
        }

        // Save each setting to VS Code configuration
        await config.update('basePackage', settings.basePackage, target);
        await config.update('author', settings.author, target);
        await config.update('entitySuffix', settings.entitySuffix, target);
        await config.update('mapperSuffix', settings.mapperSuffix, target);
        await config.update('serviceSuffix', settings.serviceSuffix, target);
        await config.update('datetime', settings.datetime, target);
        await config.update('useLombok', settings.useLombok, target);
        await config.update('useSwagger', settings.useSwagger, target);
        await config.update('useSwaggerV3', settings.useSwaggerV3, target);
        await config.update('useMyBatisPlus', settings.useMyBatisPlus, target);
    }

    /**
     * Get settings from VS Code configuration
     */
    private _getSettings(): SettingsConfig {
        const config = vscode.workspace.getConfiguration('mybatis-boost.generator');

        return {
            basePackage: config.get<string>('basePackage', 'com.example.mybatis'),
            author: config.get<string>('author', 'MyBatis Boost'),
            entitySuffix: config.get<string>('entitySuffix', 'PO'),
            mapperSuffix: config.get<string>('mapperSuffix', 'Mapper'),
            serviceSuffix: config.get<string>('serviceSuffix', 'Service'),
            datetime: config.get<string>('datetime', 'LocalDateTime'),
            useLombok: config.get<boolean>('useLombok', true),
            useSwagger: config.get<boolean>('useSwagger', false),
            useSwaggerV3: config.get<boolean>('useSwaggerV3', false),
            useMyBatisPlus: config.get<boolean>('useMyBatisPlus', false)
        };
    }

    /**
     * Detect configuration scope - check if workspace-level config exists
     * Returns 'workspace' if any workspace-level config exists, otherwise 'global'
     */
    private _getConfigurationScope(): string {
        const config = vscode.workspace.getConfiguration('mybatis-boost.generator');

        // Check if workspace folder exists
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return 'global';
        }

        // Check if any workspace-level configuration exists
        const workspaceConfig = config.inspect('basePackage');
        if (workspaceConfig?.workspaceValue !== undefined) {
            return 'workspace';
        }

        // Check other config keys as well
        const configKeys = [
            'author', 'entitySuffix', 'mapperSuffix', 'serviceSuffix',
            'datetime', 'useLombok', 'useSwagger', 'useSwaggerV3', 'useMyBatisPlus'
        ];

        for (const key of configKeys) {
            const inspection = config.inspect(key);
            if (inspection?.workspaceValue !== undefined) {
                return 'workspace';
            }
        }

        // Default to workspace if workspace exists (for new configurations)
        return 'workspace';
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
