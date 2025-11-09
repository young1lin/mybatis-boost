/**
 * Tool: Parse SQL and generate MyBatis code
 * VS Code Language Model Tool implementation
 */

import * as vscode from 'vscode';
import { GeneratorService, GeneratorServiceConfig } from '../core/GeneratorService';

interface ParseSqlInput {
    ddl: string;
}

/**
 * Tool for parsing SQL DDL and generating MyBatis code
 */
export class ParseSqlAndGenerateTool implements vscode.LanguageModelTool<ParseSqlInput> {

    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ParseSqlInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {

        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        const { ddl } = options.input;

        // Load configuration
        const config = this.loadConfiguration();

        // Use GeneratorService to parse and generate
        const result = GeneratorService.parseSqlAndGenerate(ddl, config);

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2))
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
