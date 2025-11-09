/**
 * MCP Manager for handling MCP server registration
 * Supports both VS Code Language Model Tools and Cursor MCP Extension API
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    ParseSqlAndGenerateTool,
    ExportGeneratedFilesTool,
    QueryGenerationHistoryTool,
    ParseAndExportTool
} from './index';

/**
 * Detect if running in Cursor IDE
 */
function isCursorIDE(): boolean {
    // Cursor IDE has specific environment markers
    // Check for cursor namespace or specific Cursor identifiers
    const hasCursorAPI = typeof (vscode as any).cursor !== 'undefined';
    const appName = vscode.env.appName.toLowerCase();
    const isCursor = appName.includes('cursor') || hasCursorAPI;

    return isCursor;
}

/**
 * MCP Manager class
 */
export class MCPManager {
    private context: vscode.ExtensionContext;
    private isRegistered: boolean = false;
    private isCursor: boolean = false;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.isCursor = isCursorIDE();
    }

    /**
     * Register MCP server based on IDE and configuration
     */
    async register(): Promise<void> {
        // Check configuration
        const config = vscode.workspace.getConfiguration('mybatis-boost');
        const mcpEnabled = config.get<boolean>('mcp.enable', true);

        if (!mcpEnabled) {
            console.log('[MyBatis Boost] MCP is disabled by configuration');
            return;
        }

        if (this.isCursor) {
            await this.registerCursorMCP();
        } else {
            await this.registerVSCodeTools();
        }

        this.isRegistered = true;
        console.log(`[MyBatis Boost] MCP registered successfully (IDE: ${this.isCursor ? 'Cursor' : 'VS Code'})`);
    }

    /**
     * Unregister MCP server
     */
    async unregister(): Promise<void> {
        if (!this.isRegistered) {
            return;
        }

        if (this.isCursor) {
            await this.unregisterCursorMCP();
        } else {
            await this.unregisterVSCodeTools();
        }

        this.isRegistered = false;
        console.log('[MyBatis Boost] MCP unregistered successfully');
    }

    /**
     * Register Cursor MCP using Extension API
     */
    private async registerCursorMCP(): Promise<void> {
        try {
            const cursorAPI = (vscode as any).cursor;
            if (!cursorAPI || !cursorAPI.mcp) {
                console.warn('[MyBatis Boost] Cursor MCP API not available');
                return;
            }

            // Get server path
            const serverPath = path.join(this.context.extensionPath, 'dist', 'mcp', 'stdio', 'server.js');

            // Load generator configuration
            const generatorConfig = vscode.workspace.getConfiguration('mybatis-boost.generator');
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

            // Build environment variables from configuration
            const env: Record<string, string> = {
                'MYBATIS_BASE_PACKAGE': generatorConfig.get<string>('basePackage', 'com.example.mybatis'),
                'MYBATIS_AUTHOR': generatorConfig.get<string>('author', 'MyBatis Boost'),
                'MYBATIS_OUTPUT_DIR': workspaceFolder,
                'MYBATIS_USE_LOMBOK': String(generatorConfig.get<boolean>('useLombok', true)),
                'MYBATIS_USE_SWAGGER': String(generatorConfig.get<boolean>('useSwagger', false)),
                'MYBATIS_USE_SWAGGER_V3': String(generatorConfig.get<boolean>('useSwaggerV3', false)),
                'MYBATIS_USE_MYBATIS_PLUS': String(generatorConfig.get<boolean>('useMyBatisPlus', false)),
                'MYBATIS_ENTITY_SUFFIX': generatorConfig.get<string>('entitySuffix', 'PO'),
                'MYBATIS_MAPPER_SUFFIX': generatorConfig.get<string>('mapperSuffix', 'Mapper'),
                'MYBATIS_SERVICE_SUFFIX': generatorConfig.get<string>('serviceSuffix', 'Service'),
                'MYBATIS_DATETIME': generatorConfig.get<string>('datetime', 'LocalDateTime')
            };

            // Register MCP server with Cursor API
            cursorAPI.mcp.registerServer({
                name: 'mybatis-boost',
                server: {
                    command: 'node',
                    args: [serverPath],
                    env: env
                }
            });

            console.log('[MyBatis Boost] Cursor MCP server registered via Extension API');
        } catch (error) {
            console.error('[MyBatis Boost] Failed to register Cursor MCP:', error);
            throw error;
        }
    }

    /**
     * Unregister Cursor MCP
     */
    private async unregisterCursorMCP(): Promise<void> {
        try {
            const cursorAPI = (vscode as any).cursor;
            if (cursorAPI && cursorAPI.mcp) {
                cursorAPI.mcp.unregisterServer('mybatis-boost');
                console.log('[MyBatis Boost] Cursor MCP server unregistered');
            }
        } catch (error) {
            console.error('[MyBatis Boost] Failed to unregister Cursor MCP:', error);
        }
    }

    /**
     * Register VS Code Language Model Tools
     */
    private async registerVSCodeTools(): Promise<void> {
        try {
            this.disposables.push(
                vscode.lm.registerTool('mybatis_parse_sql_and_generate', new ParseSqlAndGenerateTool(this.context)),
                vscode.lm.registerTool('mybatis_export_generated_files', new ExportGeneratedFilesTool(this.context)),
                vscode.lm.registerTool('mybatis_query_generation_history', new QueryGenerationHistoryTool(this.context)),
                vscode.lm.registerTool('mybatis_parse_and_export', new ParseAndExportTool(this.context))
            );
            console.log('[MyBatis Boost] VS Code Language Model Tools registered (4 tools)');
        } catch (error) {
            console.error('[MyBatis Boost] Failed to register VS Code Language Model Tools:', error);
            throw error;
        }
    }

    /**
     * Unregister VS Code Language Model Tools
     */
    private async unregisterVSCodeTools(): Promise<void> {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        console.log('[MyBatis Boost] VS Code Language Model Tools unregistered');
    }

    /**
     * Get current registration status
     */
    getStatus(): { registered: boolean; isCursor: boolean; enabled: boolean } {
        const config = vscode.workspace.getConfiguration('mybatis-boost');
        const enabled = config.get<boolean>('mcp.enable', true);

        return {
            registered: this.isRegistered,
            isCursor: this.isCursor,
            enabled: enabled
        };
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.unregister();
    }
}
