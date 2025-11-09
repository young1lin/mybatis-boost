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
                case 'generate':
                    await this._handleGenerate(data.ddl);
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
        await this._context.globalState.update(HISTORY_STORAGE_KEY, []);
        this._view?.webview.postMessage({
            type: 'historyCleared'
        });
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

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyBatis Generator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header img {
            width: 32px;
            height: 32px;
        }

        .header h2 {
            font-size: 16px;
            font-weight: 600;
        }

        .button-group {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }

        button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .history-section {
            margin-bottom: 16px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            display: none;
        }

        .history-section.visible {
            display: block;
        }

        .history-item {
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .history-item:last-child {
            border-bottom: none;
        }

        .history-header {
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .history-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .history-info {
            flex: 1;
            min-width: 0;
        }

        .history-time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }

        .history-ddl {
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: var(--vscode-editor-font-family);
        }

        .history-count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .history-toggle {
            font-size: 18px;
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
            user-select: none;
        }

        .history-content {
            display: none;
            padding: 8px 12px;
            background-color: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            max-height: 300px;
            overflow-y: auto;
        }

        .history-content.visible {
            display: block;
        }

        .file-item {
            margin-bottom: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .file-item:last-child {
            margin-bottom: 0;
        }

        .file-header {
            padding: 6px 8px;
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            font-size: 12px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
        }

        .file-type {
            font-size: 10px;
            padding: 2px 6px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 2px;
        }

        .file-content {
            padding: 8px;
            background-color: var(--vscode-editor-background);
            max-height: 200px;
            overflow-y: auto;
        }

        .file-content pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .input-section {
            margin-bottom: 16px;
        }

        .input-section label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
        }

        textarea {
            width: 100%;
            min-height: 200px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            resize: vertical;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .generate-button {
            width: 100%;
            padding: 8px;
            justify-content: center;
            margin-bottom: 16px;
        }

        .result-section {
            padding: 12px;
            border-radius: 4px;
            margin-top: 16px;
            display: none;
        }

        .result-section.visible {
            display: block;
        }

        .result-success {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .result-error {
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }

        .result-title {
            font-weight: 600;
            margin-bottom: 8px;
        }

        .result-files {
            list-style: none;
            padding-left: 0;
        }

        .result-files li {
            padding: 4px 0;
            font-size: 12px;
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${iconUri}" alt="MyBatis">
        <h2>MyBatis Generator</h2>
    </div>

    <div class="button-group">
        <button id="newBtn" class="secondary">➕ New</button>
        <button id="historyBtn" class="secondary">🕐 History</button>
    </div>

    <div id="historySection" class="history-section">
        <div id="historyList"></div>
    </div>

    <div class="input-section">
        <label for="ddlInput">CREATE TABLE Statement (DDL)</label>
        <textarea id="ddlInput" placeholder="Paste your CREATE TABLE statement here...

Example:
CREATE TABLE user_info (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"></textarea>
    </div>

    <button id="generateBtn" class="generate-button">🚀 Generate</button>

    <div id="resultSection" class="result-section">
        <div class="result-title" id="resultTitle"></div>
        <div id="resultMessage"></div>
        <ul id="resultFiles" class="result-files"></ul>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const newBtn = document.getElementById('newBtn');
        const historyBtn = document.getElementById('historyBtn');
        const historySection = document.getElementById('historySection');
        const historyList = document.getElementById('historyList');
        const ddlInput = document.getElementById('ddlInput');
        const generateBtn = document.getElementById('generateBtn');
        const resultSection = document.getElementById('resultSection');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        const resultFiles = document.getElementById('resultFiles');

        let historyVisible = false;

        // New button - clear input and start new session
        newBtn.addEventListener('click', () => {
            ddlInput.value = '';
            resultSection.classList.remove('visible');
            ddlInput.focus();
        });

        // History button - toggle history section
        historyBtn.addEventListener('click', () => {
            historyVisible = !historyVisible;
            if (historyVisible) {
                historySection.classList.add('visible');
                vscode.postMessage({ type: 'loadHistory' });
            } else {
                historySection.classList.remove('visible');
            }
        });

        // Generate button - trigger code generation
        generateBtn.addEventListener('click', () => {
            const ddl = ddlInput.value.trim();
            if (!ddl) {
                showError('Please enter a CREATE TABLE statement');
                return;
            }

            vscode.postMessage({
                type: 'generate',
                ddl: ddl
            });

            // Show loading state
            resultSection.classList.add('visible');
            resultSection.className = 'result-section visible';
            resultTitle.textContent = 'Generating...';
            resultMessage.textContent = '';
            resultFiles.innerHTML = '';
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'generateResult':
                    if (message.success) {
                        showSuccess(message.results);
                    } else {
                        showError(message.error);
                    }
                    break;

                case 'historyLoaded':
                case 'historyUpdated':
                    renderHistory(message.history);
                    break;

                case 'historyCleared':
                    renderHistory([]);
                    break;
            }
        });

        function showSuccess(results) {
            resultSection.className = 'result-section visible result-success';
            resultTitle.textContent = '✅ Generation Successful';
            resultMessage.textContent = '';
            resultFiles.innerHTML = results.map(r =>
                '<li>📄 ' + r.name + ' → ' + r.outputPath + '</li>'
            ).join('');
        }

        function showError(error) {
            resultSection.className = 'result-section visible result-error';
            resultTitle.textContent = '❌ Generation Failed';
            resultMessage.textContent = error;
            resultFiles.innerHTML = '';
        }

        function renderHistory(history) {
            if (!history || history.length === 0) {
                historyList.innerHTML = '<div class="empty-state">No history records</div>';
                return;
            }

            historyList.innerHTML = history.map((record, index) => {
                const date = new Date(record.timestamp);
                const timeStr = date.toLocaleString();
                const ddlPreview = record.ddl.substring(0, 60);

                // Render file items
                const filesHtml = record.results.map(file => {
                    return '<div class="file-item">' +
                        '<div class="file-header">' +
                        '<span>' + escapeHtml(file.name) + '</span>' +
                        '<span class="file-type">' + file.type.toUpperCase() + '</span>' +
                        '</div>' +
                        '<div class="file-content">' +
                        '<pre>' + escapeHtml(file.content) + '</pre>' +
                        '</div>' +
                        '</div>';
                }).join('');

                return '<div class="history-item" data-index="' + index + '">' +
                    '<div class="history-header" data-ddl="' + escapeHtml(record.ddl) + '">' +
                    '<div class="history-info">' +
                    '<div class="history-time">' + timeStr + '</div>' +
                    '<div class="history-ddl">' + escapeHtml(ddlPreview) + '...</div>' +
                    '<div class="history-count">' + record.resultsCount + ' files generated</div>' +
                    '</div>' +
                    '<span class="history-toggle">▶</span>' +
                    '</div>' +
                    '<div class="history-content">' + filesHtml + '</div>' +
                    '</div>';
            }).join('');

            // Add click handlers to history headers for DDL restore
            document.querySelectorAll('.history-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const toggle = header.querySelector('.history-toggle');
                    const content = header.nextElementSibling;

                    // Toggle expand/collapse
                    if (content.classList.contains('visible')) {
                        content.classList.remove('visible');
                        toggle.textContent = '▶';
                    } else {
                        // Collapse all others first
                        document.querySelectorAll('.history-content').forEach(c => c.classList.remove('visible'));
                        document.querySelectorAll('.history-toggle').forEach(t => t.textContent = '▶');

                        // Expand this one
                        content.classList.add('visible');
                        toggle.textContent = '▼';
                    }
                });

                // Double-click to restore DDL
                header.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    const ddl = header.getAttribute('data-ddl');
                    ddlInput.value = ddl;
                    historySection.classList.remove('visible');
                    historyVisible = false;
                });
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Load history on startup
        vscode.postMessage({ type: 'loadHistory' });
    </script>
</body>
</html>`;
    }
}
