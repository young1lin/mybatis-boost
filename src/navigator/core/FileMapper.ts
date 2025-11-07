/**
 * Core FileMapper class for managing Java-XML mappings
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { MappingMetadata } from '../../types';
import { extractJavaNamespace, isMyBatisMapper } from '../parsers/javaParser';
import { extractXmlNamespace } from '../parsers/xmlParser';
import { getFileModTime, normalizePath } from '../../utils/fileUtils';

/**
 * Simple LRU Cache implementation
 */
class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        // Remove if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value as K;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

/**
 * FileMapper manages mappings between Java mapper interfaces and XML files
 */
export class FileMapper {
    private cache: LRUCache<string, MappingMetadata>;
    private context: vscode.ExtensionContext;
    private watchers: vscode.FileSystemWatcher[] = [];
    private fileChangeTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly FILE_CHANGE_DEBOUNCE_DELAY = 300; // 300ms debounce for file changes

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
            '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**'
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

        // Priority 1: Search all XML files
        const xmlFiles = await vscode.workspace.findFiles(
            '**/*.xml',
            '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**'
        );

        // Try to find by namespace match
        for (const xmlUri of xmlFiles) {
            const xmlPath = xmlUri.fsPath;
            if (await this.verifyXmlFile(xmlPath, namespace)) {
                return xmlPath;
            }
        }

        return null;
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

        // Resources mirror structure
        const resourcesPath = javaPath.replace(/[\/\\]java[\/\\]/, '/resources/');
        paths.push(resourcesPath.replace('.java', '.xml'));
        paths.push(path.join(path.dirname(resourcesPath), 'mapper', xmlFileName));

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

        // Search Java files for matching namespace
        const javaFiles = await vscode.workspace.findFiles(
            '**/*.java',
            '**/{ node_modules,target,.git,.vscode,.idea,.settings,build,dist,out,bin}/**'
        );

        for (const javaUri of javaFiles) {
            const javaPath = javaUri.fsPath;
            const javaNamespace = await extractJavaNamespace(javaPath);

            if (javaNamespace === namespace) {
                // Build and cache mapping
                await this.buildMappingForJavaFile(javaPath);
                return javaPath;
            }
        }

        return null;
    }

    /**
     * Setup file watchers for automatic cache updates
     */
    private setupFileWatchers(): void {
        // Watch Java files
        const javaWatcher = vscode.workspace.createFileSystemWatcher('**/*.java');
        javaWatcher.onDidChange(uri => this.debouncedHandleFileChange(uri.fsPath));
        javaWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));
        this.watchers.push(javaWatcher);

        // Watch XML files
        const xmlWatcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
        xmlWatcher.onDidChange(uri => this.debouncedHandleFileChange(uri.fsPath));
        xmlWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));
        this.watchers.push(xmlWatcher);
    }

    /**
     * Debounced file change handler to avoid performance issues during rapid file changes
     */
    private debouncedHandleFileChange(filePath: string): void {
        const normalizedPath = normalizePath(filePath);

        // Clear existing timer for this file
        const existingTimer = this.fileChangeTimers.get(normalizedPath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.fileChangeTimers.delete(normalizedPath);
            this.handleFileChange(filePath);
        }, this.FILE_CHANGE_DEBOUNCE_DELAY);

        this.fileChangeTimers.set(normalizedPath, timer);
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
     * Clear all cached mappings
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clear all pending file change timers
        this.fileChangeTimers.forEach(timer => clearTimeout(timer));
        this.fileChangeTimers.clear();

        this.watchers.forEach(watcher => watcher.dispose());
        this.cache.clear();
    }
}
