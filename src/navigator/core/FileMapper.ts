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
import {
    findProjectFileInParents,
    findOutermostProjectFileInParents,
    isPathInside
} from '../../utils/projectDetector';
import { findJavaClassFile } from '../../utils/navigationUtils';

/** A project's XML namespace index plus the time it was built (for TTL self-healing). */
interface ProjectXmlIndex {
    builtAt: number;
    byNamespace: Map<string, string[]>;
}

/**
 * FileMapper manages mappings between Java mapper interfaces and XML files
 */
export class FileMapper {
    private cache: LRUCache<string, MappingMetadata>;
    private context: vscode.ExtensionContext;
    private watchers: vscode.FileSystemWatcher[] = [];

    /**
     * Per-project XML namespace index: projectRoot -> (namespace -> xmlPaths).
     * Built lazily, only when a mapper cannot be resolved via quick paths, and
     * cached so repeated lookups within the same project never rescan.
     */
    private xmlIndexByProject = new Map<string, ProjectXmlIndex>();
    /** In-flight index builds, to de-duplicate concurrent lookups in the same project. */
    private xmlIndexPromises = new Map<string, Promise<ProjectXmlIndex>>();
    /**
     * Backstop TTL for a project's XML index. File watchers invalidate the index
     * instantly on edits, but OS watchers can miss events (network/virtual drives,
     * containers, or bulk out-of-editor edits via CLI tools like Claude Code / Codex).
     * The TTL guarantees the index self-heals within this window even when no watcher
     * event arrives, so the cache is never effectively "permanent".
     */
    private static readonly XML_INDEX_TTL_MS = 30_000;

    constructor(context: vscode.ExtensionContext, cacheSize: number = 1000) {
        this.context = context;
        this.cache = new LRUCache(cacheSize);
    }

    /**
     * Initialize the mapper.
     *
     * NOTE: This intentionally does NOT scan the workspace. With many Spring Boot
     * projects open, an upfront `findFiles('**\/*.java')` + per-mapper XML scan made
     * activation take up to ~120s (see issue #46). Mappings are now resolved on demand
     * (per file, per project) and cached. Activation only wires up the file watchers.
     */
    async initialize(): Promise<void> {
        console.log('[MyBatis Boost] Initializing FileMapper (lazy, per-project)...');

        // Idempotent: dispose any existing watchers before wiring up new ones, so
        // re-initialization (e.g. from the Refresh Mappings / Clear Cache commands)
        // does not leak watchers or double-fire change handlers.
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers.length = 0;

        // Setup file watchers only - no upfront workspace scan.
        this.setupFileWatchers();

        console.log('[MyBatis Boost] FileMapper initialized (mappings resolved on demand)');
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

        // Priority 1: Look up the namespace in the lazy, per-project XML index.
        // The index is built once per project and reused (with a TTL backstop), so
        // this avoids the O(mappers x xmlFiles) full-workspace rescan that previously
        // ran per mapper.
        const projectRoot = this.getProjectRoot(javaPath);
        const index = await this.getProjectXmlIndex(projectRoot);
        const candidates = index.byNamespace.get(namespace);
        if (!candidates || candidates.length === 0) {
            return null;
        }

        // Prefer same-module candidates (longest common prefix), but re-verify the
        // chosen file still exists and matches the namespace before returning it: the
        // cached index can lag a moved/deleted/renamed file if its watcher event was
        // missed (e.g. bulk CLI edits). Verification keeps results correct regardless.
        const javaPathNormalized = javaPath.replace(/\\/g, '/');
        const ordered = [...candidates].sort(
            (a, b) => this.getCommonPrefixLength(javaPathNormalized, b)
                - this.getCommonPrefixLength(javaPathNormalized, a)
        );
        for (const candidate of ordered) {
            if (await this.verifyXmlFile(candidate, namespace)) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Resolve the project root that owns a file.
     *
     * Uses the OUTERMOST build file (pom.xml / build.gradle / build.gradle.kts)
     * between the file and its workspace folder — i.e. the aggregate root of a
     * multi-module project — so mapper XML living in a sibling module of the same
     * project is still visible to the index (the pre-#46 full-workspace scan
     * supported that layout). The walk never leaves the workspace folder, so
     * independent services sharing one workspace folder (the issue #46 setup)
     * each keep their own root and are never scanned together.
     *
     * Files outside any workspace folder fall back to the nearest build file,
     * then the first workspace folder.
     */
    private getProjectRoot(filePath: string): string {
        const startDir = path.dirname(filePath);
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        const folderPath = folder?.uri.fsPath;

        if (folderPath && isPathInside(startDir, folderPath)) {
            const outermost = findOutermostProjectFileInParents(startDir, folderPath);
            if (outermost) {
                return path.dirname(outermost);
            }
            // No build file at all between the file and its workspace folder:
            // scope to the workspace folder itself.
            return folderPath;
        }

        const projectFile = findProjectFileInParents(startDir);
        if (projectFile) {
            return path.dirname(projectFile);
        }

        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? startDir;
    }

    /**
     * Get (and lazily build + cache) the namespace -> xmlPaths index for a project.
     * Concurrent callers share a single in-flight build.
     */
    private async getProjectXmlIndex(projectRoot: string): Promise<ProjectXmlIndex> {
        const cached = this.xmlIndexByProject.get(projectRoot);
        if (cached && Date.now() - cached.builtAt < FileMapper.XML_INDEX_TTL_MS) {
            return cached;
        }
        // Expired (or absent): drop the stale snapshot and rebuild below.
        if (cached) {
            this.xmlIndexByProject.delete(projectRoot);
        }

        const inflight = this.xmlIndexPromises.get(projectRoot);
        if (inflight) {
            return inflight;
        }

        const promise = this.buildProjectXmlIndex(projectRoot);
        this.xmlIndexPromises.set(projectRoot, promise);
        try {
            const index = await promise;
            this.xmlIndexByProject.set(projectRoot, index);
            return index;
        } finally {
            this.xmlIndexPromises.delete(projectRoot);
        }
    }

    /**
     * Scan a single project's XML files once and group their paths by namespace.
     * Scoped to the project root via RelativePattern so other projects are untouched.
     */
    private async buildProjectXmlIndex(projectRoot: string): Promise<ProjectXmlIndex> {
        const byNamespace = new Map<string, string[]>();
        const xmlFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(projectRoot, '**/*.xml'),
            WORKSPACE_EXCLUDE_PATTERN
        );

        for (const xmlUri of xmlFiles) {
            const xmlPath = xmlUri.fsPath;
            const xmlNamespace = await extractXmlNamespace(xmlPath);
            if (!xmlNamespace) {
                continue;
            }
            const existing = byNamespace.get(xmlNamespace);
            if (existing) {
                existing.push(xmlPath);
            } else {
                byNamespace.set(xmlNamespace, [xmlPath]);
            }
        }

        console.log(`[MyBatis Boost] Indexed ${xmlFiles.length} XML files in project ${projectRoot}`);
        return { builtAt: Date.now(), byNamespace };
    }

    /**
     * Drop the cached XML index (and any in-flight build) for the project owning a file.
     */
    private invalidateXmlIndexForFile(filePath: string): void {
        const projectRoot = this.getProjectRoot(filePath);
        this.xmlIndexByProject.delete(projectRoot);
        this.xmlIndexPromises.delete(projectRoot);
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

        // The namespace IS the fully-qualified Java interface name, so resolve it
        // directly via a bounded package-path search, scoped to the same project
        // first and falling back to the workspace. No full '**/*.java' scan.
        const projectRoot = this.getProjectRoot(xmlPath);
        let javaUri = await findJavaClassFile(namespace, projectRoot);
        if (!javaUri) {
            javaUri = await findJavaClassFile(namespace);
        }

        if (javaUri) {
            await this.buildMappingForJavaFile(javaUri.fsPath);
            return javaUri.fsPath;
        }
        return null;
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
            // A new XML file must be picked up by the project's namespace index.
            this.invalidateXmlIndexForFile(filePath);

            const namespace = await extractXmlNamespace(filePath);
            if (!namespace) {
                return;
            }

            // The namespace is the Java interface FQN; resolve it with a bounded,
            // project-scoped search instead of scanning every '**/*.java' file.
            const projectRoot = this.getProjectRoot(filePath);
            let javaUri = await findJavaClassFile(namespace, projectRoot);
            if (!javaUri) {
                javaUri = await findJavaClassFile(namespace);
            }

            if (javaUri) {
                await this.buildMappingForJavaFile(javaUri.fsPath);
                console.log(`[MyBatis Boost] New XML mapped to ${javaUri.fsPath}`);
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
            // An XML edit may change its namespace, so drop the project's cached index.
            this.invalidateXmlIndexForFile(filePath);
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

        // A deleted XML file must be dropped from the project's namespace index.
        if (filePath.endsWith('.xml')) {
            this.invalidateXmlIndexForFile(filePath);
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
     * Clear all cached mappings (and the per-project XML indexes), forcing a fresh
     * lazy rebuild on the next lookup.
     */
    clearCache(): void {
        this.cache.clear();
        this.xmlIndexByProject.clear();
        this.xmlIndexPromises.clear();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.cache.clear();
        this.xmlIndexByProject.clear();
        this.xmlIndexPromises.clear();
    }
}
