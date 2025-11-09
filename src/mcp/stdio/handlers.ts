/**
 * MCP request handlers for stdio server
 */

import { GeneratorService, GeneratorServiceConfig } from '../core/GeneratorService';
import { FileExportService, ExportFile } from '../core/FileExportService';
import { HistoryService, FileSystemHistoryStorage } from '../core/HistoryService';

/**
 * MCP tool definition
 */
interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

/**
 * Configuration loaded from environment or defaults
 */
interface ServerConfig {
    basePackage: string;
    author: string;
    outputDir: string;
    useLombok: boolean;
    useSwagger: boolean;
    useSwaggerV3: boolean;
    useMyBatisPlus: boolean;
    entitySuffix: string;
    mapperSuffix: string;
    serviceSuffix: string;
    datetime: 'Date' | 'LocalDateTime' | 'Instant';
}

/**
 * Request handler for MCP protocol
 */
export class MCPRequestHandler {
    private config: ServerConfig;
    private historyStorage: FileSystemHistoryStorage;

    constructor() {
        this.config = this.loadConfiguration();
        this.historyStorage = new FileSystemHistoryStorage();
    }

    /**
     * Load configuration from environment variables or use defaults
     */
    private loadConfiguration(): ServerConfig {
        return {
            basePackage: process.env.MYBATIS_BASE_PACKAGE || 'com.example.mybatis',
            author: process.env.MYBATIS_AUTHOR || 'MyBatis Boost',
            outputDir: process.env.MYBATIS_OUTPUT_DIR || process.cwd(),
            useLombok: process.env.MYBATIS_USE_LOMBOK !== 'false',
            useSwagger: process.env.MYBATIS_USE_SWAGGER === 'true',
            useSwaggerV3: process.env.MYBATIS_USE_SWAGGER_V3 === 'true',
            useMyBatisPlus: process.env.MYBATIS_USE_MYBATIS_PLUS === 'true',
            entitySuffix: process.env.MYBATIS_ENTITY_SUFFIX || 'PO',
            mapperSuffix: process.env.MYBATIS_MAPPER_SUFFIX || 'Mapper',
            serviceSuffix: process.env.MYBATIS_SERVICE_SUFFIX || 'Service',
            datetime: (process.env.MYBATIS_DATETIME as any) || 'LocalDateTime'
        };
    }

    /**
     * Handle initialize request
     */
    async handleInitialize(params: any): Promise<any> {
        return {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'mybatis-boost-mcp-server',
                version: '0.1.0'
            }
        };
    }

    /**
     * Handle tools/list request
     */
    async handleToolsList(): Promise<{ tools: MCPTool[] }> {
        return {
            tools: [
                {
                    name: 'mybatis_parse_sql_and_generate',
                    description: 'Parse DDL SQL statement and generate MyBatis Java code and XML mapping files. Returns generated code content without writing to disk.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            ddl: {
                                type: 'string',
                                description: 'DDL SQL statement (CREATE TABLE) to parse'
                            }
                        },
                        required: ['ddl']
                    }
                },
                {
                    name: 'mybatis_export_generated_files',
                    description: 'Export previously generated MyBatis code to file system. Writes files to appropriate directories and saves to history.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            ddl: {
                                type: 'string',
                                description: 'Original DDL SQL statement (for history tracking)'
                            },
                            results: {
                                type: 'array',
                                description: 'Array of generated results from parse_sql_and_generate',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        outputPath: { type: 'string' },
                                        content: { type: 'string' },
                                        type: { type: 'string' }
                                    }
                                }
                            }
                        },
                        required: ['ddl', 'results']
                    }
                },
                {
                    name: 'mybatis_query_generation_history',
                    description: 'Query the history of generated MyBatis code. Returns list of past generations with SQL, timestamp, and file previews.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Maximum number of history records to return (default: 10, max: 30)'
                            }
                        }
                    }
                },
                {
                    name: 'mybatis_parse_and_export',
                    description: 'Parse DDL SQL and immediately export generated files to disk. Combines parse_sql_and_generate and export_generated_files in one operation.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            ddl: {
                                type: 'string',
                                description: 'DDL SQL statement (CREATE TABLE) to parse and export'
                            }
                        },
                        required: ['ddl']
                    }
                }
            ]
        };
    }

    /**
     * Handle tools/call request
     */
    async handleToolCall(params: { name: string; arguments?: any }): Promise<any> {
        const { name, arguments: args } = params;

        switch (name) {
            case 'mybatis_parse_sql_and_generate':
                return await this.handleParseSqlAndGenerate(args);

            case 'mybatis_export_generated_files':
                return await this.handleExportGeneratedFiles(args);

            case 'mybatis_query_generation_history':
                return await this.handleQueryHistory(args);

            case 'mybatis_parse_and_export':
                return await this.handleParseAndExport(args);

            default: {
                const error = new Error(`Unknown tool: ${name}`);
                (error as any).code = -32602;
                throw error;
            }
        }
    }

    /**
     * Handle parse SQL and generate tool
     */
    private async handleParseSqlAndGenerate(args: { ddl: string }): Promise<any> {
        const { ddl } = args;

        const generatorConfig: GeneratorServiceConfig = {
            basePackage: this.config.basePackage,
            author: this.config.author,
            outputDir: this.config.outputDir,
            useLombok: this.config.useLombok,
            useSwagger: this.config.useSwagger,
            useSwaggerV3: this.config.useSwaggerV3,
            useMyBatisPlus: this.config.useMyBatisPlus,
            entitySuffix: this.config.entitySuffix,
            mapperSuffix: this.config.mapperSuffix,
            serviceSuffix: this.config.serviceSuffix,
            datetime: this.config.datetime
        };

        const result = GeneratorService.parseSqlAndGenerate(ddl, generatorConfig);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }]
        };
    }

    /**
     * Handle export generated files tool
     */
    private async handleExportGeneratedFiles(args: { ddl: string; results: ExportFile[] }): Promise<any> {
        const { ddl, results } = args;

        const exportResult = await FileExportService.exportFiles(results);

        if (exportResult.success) {
            // Save to history
            await HistoryService.saveHistoryRecord(this.historyStorage, ddl, results);
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    ...exportResult,
                    message: exportResult.success
                        ? `Successfully exported ${results.length} files`
                        : exportResult.error
                }, null, 2)
            }]
        };
    }

    /**
     * Handle query history tool
     */
    private async handleQueryHistory(args: { limit?: number }): Promise<any> {
        const limit = args?.limit || 10;
        const result = HistoryService.queryHistory(this.historyStorage, limit);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }]
        };
    }

    /**
     * Handle parse and export tool (combined operation)
     */
    private async handleParseAndExport(args: { ddl: string }): Promise<any> {
        const { ddl } = args;

        // Step 1: Parse and generate
        const generatorConfig: GeneratorServiceConfig = {
            basePackage: this.config.basePackage,
            author: this.config.author,
            outputDir: this.config.outputDir,
            useLombok: this.config.useLombok,
            useSwagger: this.config.useSwagger,
            useSwaggerV3: this.config.useSwaggerV3,
            useMyBatisPlus: this.config.useMyBatisPlus,
            entitySuffix: this.config.entitySuffix,
            mapperSuffix: this.config.mapperSuffix,
            serviceSuffix: this.config.serviceSuffix,
            datetime: this.config.datetime
        };

        const generateResult = GeneratorService.parseSqlAndGenerate(ddl, generatorConfig);

        if (!generateResult.success || !generateResult.results) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: generateResult.error
                    }, null, 2)
                }]
            };
        }

        // Step 2: Export files
        const exportResult = await FileExportService.exportFiles(generateResult.results as ExportFile[]);

        if (exportResult.success) {
            // Save to history
            await HistoryService.saveHistoryRecord(this.historyStorage, ddl, generateResult.results);
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    ...exportResult,
                    message: exportResult.success
                        ? `Successfully parsed and exported ${generateResult.results.length} files`
                        : exportResult.error
                }, null, 2)
            }]
        };
    }
}
