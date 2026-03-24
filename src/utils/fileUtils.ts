/**
 * File utility functions
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Read first N lines from a file
 */
export async function readFirstLines(filePath: string, lineCount: number): Promise<string> {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n').slice(0, lineCount);
        return lines.join('\n');
    } catch (error) {
        return '';
    }
}

/**
 * Read entire file content
 */
export async function readFile(filePath: string): Promise<string> {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
        return '';
    }
}

/**
 * Get file modification time
 */
export async function getFileModTime(filePath: string): Promise<number> {
    try {
        const stats = await fs.promises.stat(filePath);
        return stats.mtimeMs;
    } catch (error) {
        return 0;
    }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get workspace root folders
 */
export function getWorkspaceRoot(): string | undefined {
    const vscode = require('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].uri.fsPath
        : undefined;
}

/**
 * Exclude pattern for workspace file searches (findFiles)
 * Skips common non-source directories for performance
 */
export const WORKSPACE_EXCLUDE_PATTERN =
    '**/{ node_modules,target,.git,.vscode,.claude,.idea,.settings,build,dist,out,bin}/**';

/**
 * Normalize path separators and drive letter case for consistent cache keys
 */
export function normalizePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    // Normalize Windows drive letter to lowercase (C:/ -> c:/)
    if (normalized.length >= 2 && normalized[1] === ':') {
        return normalized[0].toLowerCase() + normalized.substring(1);
    }
    return normalized;
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExt(filePath: string): string {
    const baseName = path.basename(filePath);
    const extName = path.extname(baseName);
    return baseName.substring(0, baseName.length - extName.length);
}
