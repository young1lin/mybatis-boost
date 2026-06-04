/**
 * Core FileMapper class for managing Java-XML mappings
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MappingMetadata } from '../../types';
import { extractJavaNamespace } from '../parsers/javaParser';
import { extractXmlNamespace } from '../parsers/xmlParser';
import { getFileModTime, normalizePath, WORKSPACE_EXCLUDE_PATTERN } from '../../utils/fileUtils';
import { LRUCache } from '../../utils/LRUCache';
import { findProjectFileInParents } from '../../utils/projectDetector';

interface ModuleIndex {
    root: string;
    javaByNamespace: Map<string, string[]>;
    xmlByNamespace: Map<string, string[]>;
}

/**
 * FileMapper manages mappings between Java mapper interfaces and XML files
 */
export class FileMapper {
    private cache: LRUCache<string, MappingMetadata>;
    private moduleIndexes = new Map<string, ModuleIndex>();
    private moduleIndexPromises = new Map<string, Promise<ModuleIndex>>();
    private moduleWatchers = new Map<string, vscode.FileSystemWatcher[]>();

    constructor(_context: vscode.ExtensionContext, cacheSize: number = 1000) {
        this.cache = new LRUCache(cacheSize);
    }

    /**
     * Lightweight initialization used during extension activation.
     * Module indexes and watchers are created lazily when a file is used.
     */
    initializeLazy(): void {
        console.log('[MyBatis Boost] FileMapper lazy initialization ready');
    }

    /**
     * Initialize the mapper by scanning the whole workspace.
     * Kept for explicit refresh flows and backwards-compatible tests.
     */
    async initialize(): Promise<void> {
        console.log('[MyBatis Boost] Initializing FileMapper...');
        this.initializeLazy();
        await this.refreshWorkspace();
        console.log('[MyBatis Boost] FileMapper initialized');
    }

    /**
     * Refresh all workspace mappings. This is intentionally explicit and is not
     * called from extension activation.
     */
    async refreshWorkspace(): Promise<void> {
        this.clearCache();
        this.moduleIndexes.clear();
        this.moduleIndexPromises.clear();

        const [javaFiles, xmlFiles] = await Promise.all([
            vscode.workspace.findFiles(
                '**/*.java',
                WORKSPACE_EXCLUDE_PATTERN
            ),
            vscode.workspace.findFiles(
                '**/*.xml',
                WORKSPACE_EXCLUDE_PATTERN
            )
        ]);

        const moduleFiles = new Map<string, { javaFiles: vscode.Uri[]; xmlFiles: vscode.Uri[] }>();

        for (const javaUri of javaFiles) {
            const moduleRoot = this.getModuleRootForFile(javaUri.fsPath);
            const entry = this.getOrCreateModuleFileGroup(moduleFiles, moduleRoot);
            entry.javaFiles.push(javaUri);
        }

        for (const xmlUri of xmlFiles) {
            const moduleRoot = this.getModuleRootForFile(xmlUri.fsPath);
            const entry = this.getOrCreateModuleFileGroup(moduleFiles, moduleRoot);
            entry.xmlFiles.push(xmlUri);
        }

        console.log(`[MyBatis Boost] Refreshing mappings for ${moduleFiles.size} module(s)`);

        for (const [moduleRoot, files] of moduleFiles) {
            const index = await this.buildModuleIndexFromFiles(moduleRoot, files.javaFiles, files.xmlFiles);
            this.setModuleIndex(index);
        }
    }

    /**
     * Refresh mappings for the module that contains the provided file.
     */
    async refreshModuleForFile(filePath: string): Promise<void> {
        const moduleRoot = this.getModuleRootForFile(filePath);
        await this.refreshModule(moduleRoot);
    }

    /**
     * Refresh mappings for a module root.
     */
    async refreshModule(moduleRoot: string): Promise<void> {
        const moduleKey = normalizePath(moduleRoot);
        this.cache.clear();
        this.moduleIndexes.delete(moduleKey);
        this.moduleIndexPromises.delete(moduleKey);
        const index = await this.buildModuleIndex(moduleRoot);
        this.setModuleIndex(index);
    }

    /**
     * Scan one module and build namespace indexes.
     */
    private async buildModuleIndex(moduleRoot: string): Promise<ModuleIndex> {
        const [javaFiles, xmlFiles] = await Promise.all([
            vscode.workspace.findFiles(
                new vscode.RelativePattern(moduleRoot, '**/*.java'),
                WORKSPACE_EXCLUDE_PATTERN
            ),
            vscode.workspace.findFiles(
                new vscode.RelativePattern(moduleRoot, '**/*.xml'),
                WORKSPACE_EXCLUDE_PATTERN
            )
        ]);

        return this.buildModuleIndexFromFiles(moduleRoot, javaFiles, xmlFiles);
    }

    private async buildModuleIndexFromFiles(
        moduleRoot: string,
        javaFiles: vscode.Uri[],
        xmlFiles: vscode.Uri[]
    ): Promise<ModuleIndex> {
        const index: ModuleIndex = {
            root: moduleRoot,
            javaByNamespace: new Map(),
            xmlByNamespace: new Map()
        };

        for (const javaUri of javaFiles) {
            const namespace = await extractJavaNamespace(javaUri.fsPath);
            if (namespace) {
                this.addToNamespaceIndex(index.javaByNamespace, namespace, javaUri.fsPath);
            }
        }

        for (const xmlUri of xmlFiles) {
            const namespace = await extractXmlNamespace(xmlUri.fsPath);
            if (namespace) {
                this.addToNamespaceIndex(index.xmlByNamespace, namespace, xmlUri.fsPath);
            }
        }

        await this.populateMappingCache(index);
        console.log(
            `[MyBatis Boost] Indexed module ${moduleRoot}: ` +
            `${javaFiles.length} Java file(s), ${xmlFiles.length} XML file(s)`
        );

        return index;
    }

    private getOrCreateModuleFileGroup(
        moduleFiles: Map<string, { javaFiles: vscode.Uri[]; xmlFiles: vscode.Uri[] }>,
        moduleRoot: string
    ): { javaFiles: vscode.Uri[]; xmlFiles: vscode.Uri[] } {
        const existing = moduleFiles.get(moduleRoot);
        if (existing) {
            return existing;
        }

        const entry = { javaFiles: [] as vscode.Uri[], xmlFiles: [] as vscode.Uri[] };
        moduleFiles.set(moduleRoot, entry);
        return entry;
    }

    private addToNamespaceIndex(index: Map<string, string[]>, namespace: string, filePath: string): void {
        const list = index.get(namespace) ?? [];
        list.push(filePath);
        index.set(namespace, list);
    }

    private setModuleIndex(index: ModuleIndex): void {
        const moduleKey = normalizePath(index.root);
        this.moduleIndexes.set(moduleKey, index);
        this.ensureModuleWatchers(index.root);
    }

    private async populateMappingCache(index: ModuleIndex): Promise<void> {
        for (const [namespace, javaPaths] of index.javaByNamespace) {
            const xmlPaths = index.xmlByNamespace.get(namespace);
            if (!xmlPaths) {
                continue;
            }

            for (const javaPath of javaPaths) {
                const xmlPath = this.findBestPath(javaPath, xmlPaths);
                if (xmlPath) {
                    await this.cacheMapping(javaPath, xmlPath, namespace);
                }
            }
        }
    }

    /**
     * Resolve the module root for a file.
     */
    getModuleRootForFile(filePath: string): string {
        const startDirectory = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
            ? filePath
            : path.dirname(filePath);
        const projectFile = findProjectFileInParents(startDirectory);
        if (projectFile) {
            return path.dirname(projectFile);
        }

        return this.getWorkspaceFolderForFile(filePath) ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? startDirectory;
    }

    private getWorkspaceFolderForFile(filePath: string): string | undefined {
        const normalizedFile = normalizePath(filePath);
        const folders = vscode.workspace.workspaceFolders ?? [];

        return folders
            .map(folder => folder.uri.fsPath)
            .filter(folderPath => {
                const normalizedFolder = normalizePath(folderPath);
                return normalizedFile === normalizedFolder || normalizedFile.startsWith(`${normalizedFolder}/`);
            })
            .sort((a, b) => b.length - a.length)[0];
    }

    private async ensureModuleIndexForFile(filePath: string): Promise<ModuleIndex> {
        return this.ensureModuleIndex(this.getModuleRootForFile(filePath));
    }

    private async ensureModuleIndex(moduleRoot: string): Promise<ModuleIndex> {
        const moduleKey = normalizePath(moduleRoot);
        const existing = this.moduleIndexes.get(moduleKey);
        if (existing) {
            return existing;
        }

        const existingPromise = this.moduleIndexPromises.get(moduleKey);
        if (existingPromise) {
            return existingPromise;
        }

        const promise = this.buildModuleIndex(moduleRoot)
            .then(index => {
                this.setModuleIndex(index);
                return index;
            })
            .finally(() => {
                this.moduleIndexPromises.delete(moduleKey);
            });

        this.moduleIndexPromises.set(moduleKey, promise);
        return promise;
    }

    /**
     * Get XML path for a Java file
     */
    async getXmlPath(javaPath: string): Promise<string | null> {
        const normalizedPath = normalizePath(javaPath);
        const mapping = this.cache.get(normalizedPath);

        if (mapping && await this.isJavaMappingFresh(javaPath, mapping)) {
            return mapping.xmlPath;
        }

        this.cache.delete(normalizedPath);
        await this.ensureModuleIndexForFile(javaPath);
        const newMapping = this.cache.get(normalizedPath);
        if (newMapping && await this.isJavaMappingFresh(javaPath, newMapping)) {
            return newMapping.xmlPath;
        }

        return null;
    }

    /**
     * Get Java path for an XML file
     */
    async getJavaPath(xmlPath: string): Promise<string | null> {
        const normalizedPath = normalizePath(xmlPath);
        const mapping = this.cache.get(normalizedPath);

        if (mapping && await this.isXmlMappingFresh(xmlPath, mapping)) {
            return mapping.javaPath;
        }

        this.cache.delete(normalizedPath);

        const namespace = await extractXmlNamespace(xmlPath);
        if (!namespace) {
            return null;
        }

        const moduleIndex = await this.ensureModuleIndexForFile(xmlPath);
        const bestJavaPath = this.findBestPath(xmlPath, moduleIndex.javaByNamespace.get(namespace) ?? []);
        if (!bestJavaPath) {
            return null;
        }

        await this.cacheMapping(bestJavaPath, xmlPath, namespace);
        return bestJavaPath;
    }

    /**
     * Setup module-local file watchers for automatic cache invalidation
     */
    private ensureModuleWatchers(moduleRoot: string): void {
        const moduleKey = normalizePath(moduleRoot);
        if (this.moduleWatchers.has(moduleKey)) {
            return;
        }

        // Watch Java files
        const javaWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(moduleRoot, '**/*.java')
        );
        javaWatcher.onDidChange(uri => this.handleFileChange(uri.fsPath));
        javaWatcher.onDidCreate(uri => this.handleFileChange(uri.fsPath));
        javaWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));

        // Watch XML files
        const xmlWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(moduleRoot, '**/*.xml')
        );
        xmlWatcher.onDidChange(uri => this.handleFileChange(uri.fsPath));
        xmlWatcher.onDidCreate(uri => this.handleFileChange(uri.fsPath));
        xmlWatcher.onDidDelete(uri => this.handleFileDelete(uri.fsPath));

        this.moduleWatchers.set(moduleKey, [javaWatcher, xmlWatcher]);
    }

    /**
     * Cache a Java/XML mapping.
     */
    private async cacheMapping(javaPath: string, xmlPath: string, namespace: string): Promise<void> {
        const javaModTime = await getFileModTime(javaPath);
        const xmlModTime = await getFileModTime(xmlPath);

        const mapping: MappingMetadata = {
            javaPath,
            xmlPath,
            javaModTime,
            xmlModTime,
            namespace
        };

        this.cache.set(normalizePath(javaPath), mapping);
        this.cache.set(normalizePath(xmlPath), mapping);
    }

    /**
     * Handle file change event
     */
    private async handleFileChange(filePath: string): Promise<void> {
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

        this.invalidateModuleForFile(filePath);
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

        this.invalidateModuleForFile(filePath);
    }

    private invalidateModuleForFile(filePath: string): void {
        const moduleKey = normalizePath(this.getModuleRootForFile(filePath));
        this.moduleIndexes.delete(moduleKey);
        this.moduleIndexPromises.delete(moduleKey);
    }

    private async isJavaMappingFresh(javaPath: string, mapping: MappingMetadata): Promise<boolean> {
        const currentModTime = await getFileModTime(javaPath);
        return currentModTime === mapping.javaModTime;
    }

    private async isXmlMappingFresh(xmlPath: string, mapping: MappingMetadata): Promise<boolean> {
        const currentModTime = await getFileModTime(xmlPath);
        return currentModTime === mapping.xmlModTime;
    }

    private findBestPath(originPath: string, candidates: string[]): string | null {
        let bestPath: string | null = null;
        let bestPrefixLen = -1;

        for (const candidate of candidates) {
            const prefixLen = this.getCommonPrefixLength(originPath, candidate);
            if (prefixLen > bestPrefixLen) {
                bestPrefixLen = prefixLen;
                bestPath = candidate;
            }
        }

        return bestPath;
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
        this.moduleIndexes.clear();
        this.moduleIndexPromises.clear();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        for (const watchers of this.moduleWatchers.values()) {
            watchers.forEach(watcher => watcher.dispose());
        }
        this.moduleWatchers.clear();
        this.moduleIndexes.clear();
        this.moduleIndexPromises.clear();
        this.cache.clear();
    }
}
