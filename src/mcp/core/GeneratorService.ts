/**
 * Core generation service for MyBatis code generation
 * This service is used by both VS Code Language Model Tools and stdio MCP server
 */

import * as path from 'path';
import { parseDDL } from '../../generator/parser/ddlParser';
import { CodeGenerator, GeneratorConfig } from '../../generator/template/templateGenerator';
import { GenerateReuslt, ParseOptions } from '../../generator/type';

/**
 * Configuration for generator service
 */
export interface GeneratorServiceConfig {
    basePackage: string;
    author: string;
    outputDir: string;
    useLombok?: boolean;
    useSwagger?: boolean;
    useSwaggerV3?: boolean;
    useMyBatisPlus?: boolean;
    entitySuffix?: string;
    mapperSuffix?: string;
    serviceSuffix?: string;
    datetime?: 'Date' | 'LocalDateTime' | 'Instant';
}

/**
 * Result of generation operation
 */
export interface GenerationResult {
    success: boolean;
    results?: Array<{
        name: string;
        outputPath: string;
        content: string;
        type: 'java' | 'xml';
    }>;
    error?: string;
}

/**
 * Core service for MyBatis code generation
 */
export class GeneratorService {

    /**
     * Parse SQL DDL and generate MyBatis code
     */
    static parseSqlAndGenerate(
        ddl: string,
        config: GeneratorServiceConfig
    ): GenerationResult {
        try {
            // Parse DDL with options
            const parseOptions: ParseOptions = {
                dateTimeType: config.datetime || 'LocalDateTime'
            };

            const parseResult = parseDDL(ddl, parseOptions);

            if (!parseResult.success || !parseResult.data) {
                return {
                    success: false,
                    error: parseResult.error?.message || 'Failed to parse DDL'
                };
            }

            // Create generator config
            const generatorConfig: GeneratorConfig = {
                basePackage: config.basePackage,
                author: config.author,
                outputDir: config.outputDir,
                useLombok: config.useLombok ?? true,
                useSwagger: config.useSwagger ?? false,
                useSwaggerV3: config.useSwaggerV3 ?? false,
                useMyBatisPlus: config.useMyBatisPlus ?? false,
                entitySuffix: config.entitySuffix || 'PO',
                mapperSuffix: config.mapperSuffix || 'Mapper',
                serviceSuffix: config.serviceSuffix || 'Service'
            };

            // Generate code
            const generator = new CodeGenerator(generatorConfig, parseResult.data);

            // Get template directory - need to handle different execution contexts
            const templateDir = this.getTemplateDirectory();

            const results = [
                generator.generateEntity(path.join(templateDir, 'entity.ejs')),
                generator.generateMapper(path.join(templateDir, 'mapper.ejs')),
                generator.generateMapperXml(path.join(templateDir, 'mapper-xml.ejs')),
                generator.generateService(path.join(templateDir, 'service.ejs'))
            ];

            return {
                success: true,
                results: results.map(r => ({
                    name: r.name,
                    outputPath: r.outputPath,
                    content: r.content,
                    type: r.type
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Get template directory path
     */
    private static getTemplateDirectory(): string {
        // Try different paths depending on execution context
        const possiblePaths = [
            path.join(__dirname, '..', '..', 'generator', 'template'),
            path.join(__dirname, '../../generator/template'),
            path.join(process.cwd(), 'dist', 'generator', 'template'),
            path.join(process.cwd(), 'src', 'generator', 'template')
        ];

        const fs = require('fs');
        for (const templatePath of possiblePaths) {
            if (fs.existsSync(templatePath)) {
                return templatePath;
            }
        }

        // Default fallback
        return path.join(__dirname, '..', '..', 'generator', 'template');
    }
}
