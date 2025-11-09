/**
 * File export service for writing generated files to disk
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * File to be exported
 */
export interface ExportFile {
    name: string;
    outputPath: string;
    content: string;
    type: 'java' | 'xml';
}

/**
 * Result of export operation
 */
export interface ExportResult {
    success: boolean;
    exportedFiles?: string[];
    error?: string;
}

/**
 * Service for exporting generated files to disk
 */
export class FileExportService {

    /**
     * Export files to disk
     */
    static async exportFiles(files: ExportFile[]): Promise<ExportResult> {
        if (!files || !Array.isArray(files)) {
            return {
                success: false,
                error: 'Invalid files format: expected an array'
            };
        }

        const exportedFiles: string[] = [];

        try {
            for (const file of files) {
                // Ensure directory exists
                const dir = path.dirname(file.outputPath);
                await fs.promises.mkdir(dir, { recursive: true });

                // Write file
                await fs.promises.writeFile(file.outputPath, file.content, 'utf-8');
                exportedFiles.push(file.outputPath);
            }

            return {
                success: true,
                exportedFiles
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}
