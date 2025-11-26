/**
 * Main console interceptor for MyBatis SQL logs
 */

import * as vscode from 'vscode';
import { DebugTrackerFactory } from './DebugTrackerFactory';
import { ConsoleConfig, DatabaseType } from '../types';
import type { MybatisLogViewProvider } from '../../webview/MybatisLogViewProvider';

/**
 * Console interceptor entry point
 */
export class ConsoleInterceptor {
    private trackerFactory: DebugTrackerFactory;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.trackerFactory = new DebugTrackerFactory();
    }

    /**
     * Set log view provider for displaying SQL records
     */
    public setLogViewProvider(provider: MybatisLogViewProvider): void {
        this.trackerFactory.setLogViewProvider(provider);
    }

    /**
     * Activate console interceptor
     */
    public activate(context: vscode.ExtensionContext): void {
        console.log('[MyBatis Console] Activating console interceptor...');

        // Get configuration
        const config = this.getConfig();
        console.log(`[MyBatis Console] Configuration: enabled=${config.enabled}, autoDetect=${config.autoDetectDatabase}, default=${config.defaultDatabase}`);

        if (!config.enabled) {
            console.log('[MyBatis Console] Console interceptor is disabled in settings');
            return;
        }

        // Register debug adapter tracker factory for Java
        const trackerDisposable = vscode.debug.registerDebugAdapterTrackerFactory('java', this.trackerFactory);
        this.disposables.push(trackerDisposable);
        console.log('[MyBatis Console] Registered debug adapter tracker factory for Java');

        // Register commands
        this.registerCommands(context);
        console.log('[MyBatis Console] Registered console commands');

        // Listen to configuration changes
        const configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('mybatis-boost.console')) {
                this.handleConfigChange();
            }
        });
        this.disposables.push(configDisposable);

        console.log('[MyBatis Console] Console interceptor activation complete');
    }

    /**
     * Register console-related commands
     */
    private registerCommands(context: vscode.ExtensionContext): void {
        // Command: Clear SQL output
        const clearCommand = vscode.commands.registerCommand(
            'mybatis-boost.clearSqlOutput',
            () => {
                this.trackerFactory.clearOutput();
                vscode.window.showInformationMessage('MyBatis SQL output cleared');
            }
        );
        this.disposables.push(clearCommand);

        // Command: Toggle SQL console
        const toggleCommand = vscode.commands.registerCommand(
            'mybatis-boost.toggleSqlConsole',
            () => {
                const currentState = this.trackerFactory.isEnabled();
                this.trackerFactory.setEnabled(!currentState);
                const newState = !currentState ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`MyBatis SQL console ${newState}`);
            }
        );
        this.disposables.push(toggleCommand);

        // Command: Export SQL logs
        const exportCommand = vscode.commands.registerCommand(
            'mybatis-boost.exportSqlLogs',
            async () => {
                await this.trackerFactory.exportLogs();
            }
        );
        this.disposables.push(exportCommand);
    }

    /**
     * Handle configuration changes
     */
    private handleConfigChange(): void {
        const config = this.getConfig();
        this.trackerFactory.setEnabled(config.enabled);
    }

    /**
     * Get console configuration
     */
    private getConfig(): ConsoleConfig {
        const config = vscode.workspace.getConfiguration('mybatis-boost.console');

        return {
            enabled: config.get<boolean>('enabled', true),
            autoDetectDatabase: config.get<boolean>('autoDetectDatabase', true),
            defaultDatabase: this.parseDatabase(config.get<string>('defaultDatabase', 'mysql')),
            showExecutionTime: config.get<boolean>('showExecutionTime', true),
            sessionTimeout: config.get<number>('sessionTimeout', 5000),
            formatSql: config.get<boolean>('formatSql', true)
        };
    }

    /**
     * Parse database type from string
     */
    private parseDatabase(dbString: string): DatabaseType {
        switch (dbString.toLowerCase()) {
            case 'mysql':
                return DatabaseType.MySQL;
            case 'postgresql':
                return DatabaseType.PostgreSQL;
            case 'oracle':
                return DatabaseType.Oracle;
            case 'sqlserver':
                return DatabaseType.SQLServer;
            default:
                return DatabaseType.MySQL;
        }
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.trackerFactory.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
