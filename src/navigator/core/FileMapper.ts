/**
 * Core FileMapper class for managing Java-XML mappings
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { MappingMetadata } from '../../types';
import { extractJavaNamespace, isMyBatisMapper } from '../parsers/javaParser';
import { extractXmlNamespace } from '../parsers/xmlParser';
import { getFileModTime, normalizePath, WORKSPACE_EXCLUDE_PATTERN } from '../../utils/fileUtils';
import { LRUCache } from '../../utils/LRUCache';

/**
 * FileMapper manages mappings between Java mapper interfaces and XML files
 */
export class FileMapper {
    private cache: LRUCache<string, MappingMetadata>;
    private context: vscode.ExtensionContext;
    private watchers: vscode.FileSystemWatcher[] = [];

    constructor(context: vscode.ExtensionContext, cacheSize: number = 1000) {
        this.context = context;
        this.cache = new LRUCache(cacheSize);
    }

    /**
     * Initialize the mapper by scanning workspace
     */
    async initialize(): Promise<void> {
        console.log('[MyBatis Boost] Initializing FileMapper...');

        // Setup file watchers
        this.setupFileWatchers();

        // Perform initial scan
        await this.scanWorkspace();

        console.log('[MyBatis Boost] FileMapper initialized');
    }

    /**
     * Scan workspace for Java mapper files
     */
    private async scanWorkspace(): Promise<void> {
        const javaFiles = await vscode.workspace.findFiles(
            '**/*.java',
            WORKSPACE_EXCLUDE_PATTERN
        );

        console.log(`[MyBatis Boost] Found ${javaFiles.length} Java files, checking for mappers...`);

        let mapperCount = 0;
        for (const javaUri of javaFiles) {
            const javaPath = javaUri.fsPath;

            // Check if it's a MyBatis mapper
            if (await isMyBatisMapper(javaPath)) {
                await this.buildMappingForJavaFile(javaPath);
                mapperCount++;
            }
        }

        console.log(`[MyBatis Boost] Built mappings for ${mapperCount} mapper interfaces`);
    }

    /**
     * Build mapping for a specific Java mapper file
     */
    private async buildMappingForJavaFile(javaPath: string): Promise<void> {
        try {
            // Extract namespace
            const namespace = await extractJavaNamespace(javaPath);
            if (!namespace) {
                return;
            }

            // Find corresponding XML file
            const xmlPath = await this.findXmlFile(javaPath, namespace);
            if (!xmlPath) {
                return;
            }

            // Get modification times
            const javaModTime = await getFileModTime(javaPath);
            const xmlModTime = await getFileModTime(xmlPath);

            // Store in cache
            const mapping: MappingMetadata = {
                javaPath,
                xmlPath,
                javaModTime,
                xmlModTime,
                namespace
            };

            this.cache.set(normalizePath(javaPath), mapping);
            this.cache.set(normalizePath(xmlPath), mapping);

        } catch (error) {
            console.error(`[MyBatis Boost] Error building mapping for ${javaPath}:`, error);
        }
    }

    /**
     * Find XML file corresponding to a Java mapper
     */
    private async findXmlFile(javaPath: string, namespace: string): Promise<string | null> {
        const javaFileName = path.basename(javaPath, '.java');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return null;
        }

        // Priority 0: Quick path - common MyBatis structures
        const quickPaths = this.getQuickPaths(javaPath, javaFileName);
        for (const xmlPath of quickPaths) {
            if (await this.verifyXmlFile(xmlPath, namespace)) {
                return xmlPath;
            }
        }

        // Priority 1: Search all XML files, prefer same module (longest common prefix)
        const xmlFiles = await vscode.workspace.findFiles(
            '**/*.xml',
            WORKSPACE_EXCLUDE_PATTERN
        );

        const javaPathNormalized = javaPath.replace(/\\/g, '/');
        let bestXmlPath: string | null = null;
        let bestPrefixLen = -1;

        for (const xmlUri of xmlFiles) {
            const xmlPath = xmlUri.fsPath;
            if (await this.verifyXmlFile(xmlPath, namespace)) {
                const prefixLen = this.getCommonPrefixLength(javaPathNormalized, xmlPath);
                if (prefixLen > bestPrefixLen) {
                    bestPrefixLen = prefixLen;
                    bestXmlPath = xmlPath;
                }
            }
        }

        return bestXmlPath;
    }

    /**
     * Get quick path candidates for XML file
     */
    private getQuickPaths(javaPath: string, javaFileName: string): string[] {
        const paths: string[] = [];
        const javaDir = path.dirname(javaPath);
        const xmlFileName = `${javaFileName}.xml`;

        // Same directory
        paths.push(path.join(javaDir, xmlFileName));

        // mapper subdirectory
        paths.push(path.join(javaDir, 'mapper', xmlFileName));

        // Resources mirror structure (with package path)
        const resourcesPath = javaPath.replace(/[\/\\]java[\/\\]/, '/resources/');
        paths.push(resourcesPath.replace('.java', '.xml'));
        paths.push(path.join(path.dirname(resourcesPath), 'mapper', xmlFileName));

        // Resources root (without package structure)
        const normalizedJavaPath = javaPath.replace(/\\/g, '/');
        const srcMainMatch = normalizedJavaPath.match(/^(.*\/src\/main\/)java\//);
        if (srcMainMatch) {
            const resourcesRoot = srcMainMatch[1] + 'resources';
            paths.push(path.join(resourcesRoot, xmlFileName));
            paths.push(path.join(resourcesRoot, 'mapper', xmlFileName));
            paths.push(path.join(resourcesRoot, 'mappers', xmlFileName));
            paths.push(path.join(resourcesRoot, 'mybatis', xmlFileName));
        }

        return paths;
    }

    /**
     * Verify XML file has matching namespace
     */
    private async verifyXmlFile(xmlPath: string, expectedNamespace: string): Promise<boolean> {
        try {
            const fs = require('fs');

            // Skip invalid paths (e.g., .git files)
            if (xmlPath.includes('.git') || !xmlPath.endsWith('.xml')) {
                return false;
            }

            if (!fs.existsSync(xmlPath)) {
                return false;
            }

            const xmlNamespace = await extractXmlNamespace(xmlPath);
            return xmlNamespace === expectedNamespace;
        } catch (error) {
            // Silently ignore errors for invalid files
            return false;
        }
    }

    /**
     * Get XML path for a Java file
     */
    async getXmlPath(javaPath: string): Promise<string | null> {
        const normalizedPath = normalizePath(javaPath);
        const mapping = this.cache.get(normalizedPath);

        if (mapping) {
            // Check if cache is still valid
            const currentModTime = await getFileModTime(javaPath);
            if (currentModTime === mapping.javaModTime) {
                return mapping.xmlPath;
            }

            // Cache is stale, rebuild
            this.cache.delete(normalizedPath);
        }

        // Build mapping on-demand
        await this.buildMappingForJavaFile(javaPath);
        const newMapping = this.cache.get(normalizedPath);
        return newMapping?.xmlPath || null;
    }

    /**
     * Get Java path for an XML file
     */
    async getJavaPath(xmlPath: string): Promise<string | null> {
        const normalizedPath = normalizePath(xmlPath);
        const mapping = this.cache.get(normalizedPath);

        if (mapping) {
            // Check if cache is still valid
            const currentModTime = await getFileModTime(xmlPath);
            if (currentModTime === mapping.xmlModTime) {
                return mapping.javaPath;
            }

            // Cache is stale
            this.cache.delete(normalizedPath);
        }

        // Need to search for corresponding Java file
        const namespace = await extractXmlNamespace(xmlPath);
        if (!namespace) {
            return null;
        }

        // Search Java files for matching namespace, prefer same module
        const javaFiles = await vscode.workspace.findFiles(
            '**/*.java',
            WORKSPACE_EXCLUDE_PATTERN
        );

        const xmlPathNormalized = xmlPath.replace(/\\/g, '/');
        let bestJavaPath: string | null = null;
        let bestPrefixLen = -1;

        for (const javaUri of javaFiles) {
            const javaPath = javaUri.fsPath;
            const javaNamespace = await extractJavaNamespace(javaPath);

            if (javaNamespace === namespace) {
                const prefixLen = this.getCommonPrefixLength(xmlPathNormalized, javaPath);
                if (prefixLen > bestPrefixLen) {
                    bestPrefixLen = prefixLen;
                    bestJavaPath = javaPath;
                }
            }
        }

        if (bestJavaPath) {
            await this.buildMappingForJavaFile(bestJavaPath);
        }
        return bestJavaPath;
    }

    /**
     * Setup file watchers for automatic cache updates
     */
    private setupFileWatchers(): void {
        // Watch Java files
        const javaWatcher = vscode.workspace.createFileSystemWatcher('**/*.java');
        javaWatcher.onDidChange(uri => this.handleFileChange(uri.fsPath));
        javaWatcher.onDidCreate(uri => this.handleJavaFileCreate(uri.fsPath));
        javaWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));
        this.watchers.push(javaWatcher);

        // Watch XML files
        const xmlWatcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
        xmlWatcher.onDidChange(uri => this.handleFileChange(uri.fsPath));
        xmlWatcher.onDidCreate(uri => this.handleXmlFileCreate(uri.fsPath));
        xmlWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));
        this.watchers.push(xmlWatcher);
    }

    /**
     * Handle new Java file creation
     */
    private async handleJavaFileCreate(filePath: string): Promise<void> {
        try {
            if (await isMyBatisMapper(filePath)) {
                await this.buildMappingForJavaFile(filePath);
                console.log(`[MyBatis Boost] New mapper detected: ${filePath}`);
            }
        } catch (error) {
            console.error(`[MyBatis Boost] Error handling new Java file:`, error);
        }
    }

    /**
     * Handle new XML file creation
     */
    private async handleXmlFileCreate(filePath: string): Promise<void> {
        try {
            const namespace = await extractXmlNamespace(filePath);
            if (!namespace) {
                return;
            }

            // Search for corresponding Java mapper, prefer same module
            const javaFiles = await vscode.workspace.findFiles(
                '**/*.java',
                WORKSPACE_EXCLUDE_PATTERN
            );

            const xmlPathNormalized = filePath.replace(/\\/g, '/');
            let bestJavaPath: string | null = null;
            let bestPrefixLen = -1;

            for (const javaUri of javaFiles) {
                const javaPath = javaUri.fsPath;
                const javaNamespace = await extractJavaNamespace(javaPath);
                if (javaNamespace === namespace) {
                    const prefixLen = this.getCommonPrefixLength(xmlPathNormalized, javaPath);
                    if (prefixLen > bestPrefixLen) {
                        bestPrefixLen = prefixLen;
                        bestJavaPath = javaPath;
                    }
                }
            }

            if (bestJavaPath) {
                await this.buildMappingForJavaFile(bestJavaPath);
                console.log(`[MyBatis Boost] New XML mapped to ${bestJavaPath}`);
            }
        } catch (error) {
            console.error(`[MyBatis Boost] Error handling new XML file:`, error);
        }
    }

    /**
     * Handle file change event
     */
    private handleFileChange(filePath: string): void {
        const normalizedPath = normalizePath(filePath);

        // Get the mapping before deleting it
        const mapping = this.cache.get(normalizedPath);

        // Delete the cache entry for this file
        this.cache.delete(normalizedPath);

        // If we had a mapping, also delete the paired file's cache entry
        if (mapping) {
            if (filePath.endsWith('.java')) {
                // Java file changed - delete XML cache entry
                this.cache.delete(normalizePath(mapping.xmlPath));
            } else if (filePath.endsWith('.xml')) {
                // XML file changed - delete Java cache entry
                this.cache.delete(normalizePath(mapping.javaPath));
            }
        }

        // Rebuild mapping if it's a Java file
        if (filePath.endsWith('.java')) {
            this.buildMappingForJavaFile(filePath);
        } else if (filePath.endsWith('.xml')) {
            // For XML file changes, we need to find the corresponding Java file and rebuild
            if (mapping && mapping.javaPath) {
                this.buildMappingForJavaFile(mapping.javaPath);
            }
        }
    }

    /**
     * Handle file delete event
     */
    private handleFileDelete(filePath: string): void {
        const normalizedPath = normalizePath(filePath);

        // Get the mapping before deleting it
        const mapping = this.cache.get(normalizedPath);

        // Delete the cache entry for this file
        this.cache.delete(normalizedPath);

        // If we had a mapping, also delete the paired file's cache entry
        if (mapping) {
            if (filePath.endsWith('.java')) {
                // Java file deleted - delete XML cache entry
                this.cache.delete(normalizePath(mapping.xmlPath));
            } else if (filePath.endsWith('.xml')) {
                // XML file deleted - delete Java cache entry
                this.cache.delete(normalizePath(mapping.javaPath));
            }
        }
    }

    /**
     * Get the length of the common directory-level prefix between two paths.
     * Used to prefer files in the same module over files in other modules.
     */
    getCommonPrefixLength(path1: string, path2: string): number {
        const a = path1.replace(/\\/g, '/');
        const b = path2.replace(/\\/g, '/');
        let lastSep = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] !== b[i]) { break; }
            if (a[i] === '/') { lastSep = i; }
        }
        return lastSep;
    }

    /**
     * Clear all cached mappings
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.cache.clear();
    }
}
