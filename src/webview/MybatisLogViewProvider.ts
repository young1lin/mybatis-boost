/**
 * MyBatis Log WebView Provider
 * Displays SQL execution logs in a panel with filtering and search capabilities
 */

import * as vscode from 'vscode';
import { SqlRecord, ConvertedSql, DatabaseType } from '../console/types';
import { SqlConverter } from '../console/converter/SqlConverter';

export class MybatisLogViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mybatis-boost.logView';

    private _view?: vscode.WebviewView;
    private _records: SqlRecord[] = [];
    private _nextId = 1;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    /**
     * Resolve webview view (called when view becomes visible)
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlContent();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'ready':
                    // WebView is ready, send existing records
                    this._updateView();
                    break;
                case 'filter':
                    this._filterRecords(data.keyword);
                    break;
                case 'clear':
                    this._records = [];
                    this._nextId = 1;
                    this._updateView();
                    break;
            }
        });
    }

    /**
     * Add new SQL record from ConvertedSql
     */
    public addRecord(convertedSql: ConvertedSql): void {
        const record = this._convertToSqlRecord(convertedSql);
        this._records.push(record);

        // Enforce history limit (get from configuration)
        const config = vscode.workspace.getConfiguration('mybatis-boost.console');
        const historyLimit = config.get<number>('historyLimit', 5000);

        if (this._records.length > historyLimit) {
            const excessCount = this._records.length - historyLimit;
            this._records.splice(0, excessCount);
        }

        this._updateView();
    }

    /**
     * Clear all records
     */
    public clear(): void {
        this._records = [];
        this._nextId = 1;
        this._updateView();
    }

    /**
     * Convert ConvertedSql to SqlRecord with formatted display
     */
    private _convertToSqlRecord(convertedSql: ConvertedSql): SqlRecord {
        // Format SQL with comments (same as original OutputChannel format)
        const formattedSql = this._formatSqlWithComments(convertedSql);

        return {
            id: this._nextId++,
            mapper: convertedSql.mapper,
            executionTime: convertedSql.executionTime,
            rowsAffected: this._extractRowsAffected(convertedSql.totalLine),
            sql: formattedSql,  // Use formatted SQL with comments
            timestamp: new Date(convertedSql.timestamp),
            threadInfo: convertedSql.threadInfo,
            database: convertedSql.database
        };
    }

    /**
     * Format SQL with comments (same as original OutputChannel format)
     */
    private _formatSqlWithComments(result: ConvertedSql): string {
        const lines: string[] = [];

        // Mapper info as SQL comment
        if (result.mapper) {
            lines.push(`-- Mapper: ${result.mapper}`);
        }

        // Thread info as SQL comment (extract thread name only)
        if (result.threadInfo) {
            const threadName = this._extractThreadName(result.threadInfo);
            lines.push(`-- Thread: [${threadName}]`);
        }

        // Execution time as SQL comment
        if (result.executionTime !== undefined && result.executionTime >= 0) {
            lines.push(`-- Execution Time: ${result.executionTime}ms`);
        }

        // Rows affected as SQL comment
        if (result.totalLine) {
            const rowsAffected = this._extractRowsAffected(result.totalLine);
            if (rowsAffected !== null && rowsAffected !== undefined) {
                lines.push(`-- Rows Affected: ${rowsAffected}`);
            }
        }

        // Empty line separator
        lines.push('');

        // Format SQL with proper indentation and line breaks
        const config = vscode.workspace.getConfiguration('mybatis-boost.console');
        const shouldFormat = config.get<boolean>('formatSql', true);

        const formattedSql = shouldFormat
            ? SqlConverter.formatSql(result.convertedSql, result.database)
            : result.convertedSql;

        lines.push(formattedSql);

        return lines.join('\n');
    }

    /**
     * Extract thread name from thread info string
     */
    private _extractThreadName(threadInfo: string): string {
        const bracketMatch = threadInfo.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
            return bracketMatch[1];
        }
        const cleanName = threadInfo.replace(/^\d+\s*/, '').trim();
        return cleanName || threadInfo;
    }

    /**
     * Extract rows affected from total line
     * Input formats: "Total: 5" or "Updates: 1"
     * Returns number of rows or undefined
     */
    private _extractRowsAffected(totalLine: string | undefined): number | undefined {
        if (!totalLine) {
            return undefined;
        }

        const match = totalLine.match(/(?:Total|Updates):\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : undefined;
    }

    /**
     * Update webview with current records
     */
    private _updateView(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                records: this._records
            });
        }
    }

    /**
     * Filter records by keyword (searches mapper and SQL content)
     */
    private _filterRecords(keyword: string): void {
        const lowerKeyword = keyword.toLowerCase();
        const filtered = this._records.filter(r =>
            r.mapper.toLowerCase().includes(lowerKeyword) ||
            r.sql.toLowerCase().includes(lowerKeyword)
        );

        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                records: filtered
            });
        }
    }

    /**
     * Get HTML content for webview
     */
    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .toolbar {
            padding: 10px;
            display: flex;
            gap: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            background: var(--vscode-editor-background);
            z-index: 100;
        }

        .toolbar input {
            flex: 1;
            padding: 5px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            outline: none;
        }

        .toolbar input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .toolbar button {
            padding: 5px 15px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
        }

        .toolbar button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .toolbar .clear-all-btn {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .toolbar .clear-all-btn:hover {
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
            opacity: 0.9;
        }

        .records-container {
            overflow: auto;
            height: calc(100vh - 45px);
            padding: 10px;
        }

        .record-item {
            margin-bottom: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            background: var(--vscode-editor-background);
            position: relative;
        }

        .record-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .record-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 10px;
            background: var(--vscode-input-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .record-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .record-id {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
        }

        .record-time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
        }

        .copy-button {
            padding: 2px 8px;
            font-size: 11px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 50px;
        }

        .copy-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .sql-content {
            padding: 10px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-word;
            user-select: text;
            cursor: text;
        }

        .time-slow {
            color: var(--vscode-errorForeground);
        }

        .empty {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: 10px;
            opacity: 0.5;
        }

        /* Floating auto-scroll button */
        .auto-scroll-btn {
            position: fixed;
            right: 20px;
            bottom: 20px;
            width: 48px;
            height: 48px;
            border-radius: 24px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            z-index: 1000;
        }

        .auto-scroll-btn:hover {
            background: var(--vscode-button-hoverBackground);
            transform: scale(1.1);
        }

        .auto-scroll-btn.paused {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .auto-scroll-btn.paused:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <input
            type="text"
            id="filter"
            placeholder="Filter by mapper or SQL..."
            autocomplete="off"
        >
        <button class="clear-all-btn" onclick="clearAll()">🗑️ Clear All Records</button>
    </div>
    <div class="records-container" id="records">
        <div class="empty">
            <div class="empty-icon">📊</div>
            <div>No SQL records yet</div>
            <div style="font-size: 12px; margin-top: 5px;">Start debugging to capture MyBatis SQL logs</div>
        </div>
    </div>

    <!-- Floating auto-scroll button -->
    <button
        id="autoScrollBtn"
        class="auto-scroll-btn"
        title="Auto-scroll to latest (ON)"
        onclick="toggleAutoScroll()"
    >⬇</button>

    <script>
        const vscode = acquireVsCodeApi();
        let allRecords = [];
        let autoScroll = true;  // Default: auto-scroll enabled
        let copyTimers = new Map();  // Track copy button timers for each record

        // Filter input handler
        document.getElementById('filter').addEventListener('input', (e) => {
            const keyword = e.target.value;
            vscode.postMessage({ type: 'filter', keyword: keyword });
        });

        // Clear button handler (removed confirm to fix the issue)
        function clearAll() {
            vscode.postMessage({ type: 'clear' });
            document.getElementById('filter').value = '';
        }

        // Toggle auto-scroll
        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            const btn = document.getElementById('autoScrollBtn');

            if (autoScroll) {
                btn.classList.remove('paused');
                btn.textContent = '⬇';
                btn.title = 'Auto-scroll to latest (ON)';
                // Immediately scroll to bottom when re-enabled
                scrollToBottom();
            } else {
                btn.classList.add('paused');
                btn.textContent = '⏸';
                btn.title = 'Auto-scroll paused (OFF)';
            }
        }

        // Scroll to bottom of records container
        function scrollToBottom() {
            const container = document.getElementById('records');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }

        // Format timestamp to readable string
        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const ms = String(date.getMilliseconds()).padStart(3, '0');
            return \`\${hours}:\${minutes}:\${seconds}.\${ms}\`;
        }

        // Copy SQL to clipboard
        function copySql(recordId, event) {
            const record = allRecords.find(r => r.id === recordId);
            if (!record) {
                return;
            }

            const btn = event.target;

            // Copy to clipboard
            navigator.clipboard.writeText(record.sql).then(() => {
                // Clear existing timer for this record if any
                if (copyTimers.has(recordId)) {
                    clearTimeout(copyTimers.get(recordId));
                }

                // Update button text to show success
                btn.textContent = 'Copied';

                // Set new timer to restore original text after 2 seconds
                const timer = setTimeout(() => {
                    btn.textContent = 'Copy';
                    copyTimers.delete(recordId);
                }, 2000);

                // Store timer reference
                copyTimers.set(recordId, timer);
            }).catch(err => {
                console.error('Failed to copy:', err);
                btn.textContent = 'Failed';
                setTimeout(() => {
                    btn.textContent = 'Copy';
                }, 1000);
            });
        }

        // Render records to card layout
        function renderRecords(records) {
            const container = document.getElementById('records');

            if (records.length === 0) {
                container.innerHTML = \`
                    <div class="empty">
                        <div class="empty-icon">📊</div>
                        <div>No SQL records</div>
                        <div style="font-size: 12px; margin-top: 5px;">
                            \${allRecords.length > 0 ? 'No matching records found' : 'Start debugging to capture MyBatis SQL logs'}
                        </div>
                    </div>
                \`;
                return;
            }

            container.innerHTML = records.map(r => {
                // Apply slow query highlighting to the entire SQL content
                const timeClass = (r.executionTime !== undefined && r.executionTime > 100) ? 'time-slow' : '';
                const formattedTime = formatTimestamp(r.timestamp);

                return \`
                    <div class="record-item">
                        <div class="record-header">
                            <div class="record-info">
                                <span class="record-id">#\${r.id}</span>
                                <span class="record-time">\${formattedTime}</span>
                            </div>
                            <button class="copy-button" onclick="copySql(\${r.id}, event)">Copy</button>
                        </div>
                        <div class="sql-content \${timeClass}">\${escapeHtml(r.sql)}</div>
                    </div>
                \`;
            }).join('');

            // Auto-scroll to bottom if enabled
            if (autoScroll) {
                // Use setTimeout to ensure DOM is updated
                setTimeout(() => scrollToBottom(), 0);
            }
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                allRecords = message.records;
                renderRecords(message.records);
            }
        });

        // Notify extension that webview is ready
        // This allows extension to restore existing records when webview is recreated
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}
