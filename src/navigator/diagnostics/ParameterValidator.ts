/**
 * Parameter validator for XML SQL statements
 * Validates that parameter references in XML have corresponding definitions in Java
 */

import * as vscode from 'vscode';
import { FileMapper } from '../core/FileMapper';
import { extractParameterReferences, extractStatementParameterInfo, extractLocalVariables, extractAttributeReferences } from '../parsers/parameterParser';
import { extractXmlStatements } from '../parsers/xmlParser';
import { extractMethodParameters } from '../parsers/javaParser';
import { extractJavaFields } from '../parsers/javaFieldParser';
import { LRUCache } from '../../utils/LRUCache';
import { isBuiltInType, isCollectionType } from '../../utils/javaTypeUtils';
import { resolveFullyQualifiedType } from '../../utils/javaTypeResolver';
import { WORKSPACE_EXCLUDE_PATTERN } from '../../utils/fileUtils';
import { findJavaClassFile } from '../../utils/navigationUtils';

/**
 * Validates parameters in XML mapper files
 */
export class ParameterValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private validationTimers: Map<string, NodeJS.Timeout> = new Map();
    private fieldCache: LRUCache<string, string[]>;
    private readonly DEBOUNCE_DELAY = 500; // 500ms debounce for text changes
    private readonly FIELD_CACHE_SIZE = 200; // Cache up to 200 classes
    private enabled: boolean;

    constructor(
        private context: vscode.ExtensionContext,
        private fileMapper: FileMapper
    ) {
        // Create diagnostic collection
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('mybatis-parameters');
        this.context.subscriptions.push(this.diagnosticCollection);

        // Initialize field cache
        this.fieldCache = new LRUCache(this.FIELD_CACHE_SIZE);

        // Read initial configuration
        this.enabled = this.isValidationEnabled();

        // Listen for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('mybatis-boost.enableParameterValidation')) {
                    this.handleConfigurationChange();
                }
            })
        );

        // Validate on file open (immediate)
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (doc.languageId === 'xml') {
                    this.validateDocument(doc);
                }
            })
        );

        // Validate on file change (debounced for performance)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'xml') {
                    this.debouncedValidateDocument(event.document);
                }
            })
        );

        // Validate on file save (immediate to ensure validation is up-to-date)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.languageId === 'xml') {
                    // Cancel any pending debounced validation
                    const timer = this.validationTimers.get(doc.uri.toString());
                    if (timer) {
                        clearTimeout(timer);
                        this.validationTimers.delete(doc.uri.toString());
                    }
                    // Validate immediately on save
                    this.validateDocument(doc);
                }
            })
        );

        // Invalidate field cache when Java files change
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'java') {
                    this.invalidateFieldCache(event.document.uri.fsPath);
                }
            })
        );

        // Invalidate field cache when Java files are saved (for external changes)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.languageId === 'java') {
                    this.invalidateFieldCache(doc.uri.fsPath);
                }
            })
        );

        // Validate all open XML documents if validation is enabled
        if (this.enabled) {
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.languageId === 'xml') {
                    this.validateDocument(doc);
                }
            });
        }
    }

    /**
     * Check if parameter validation is enabled in configuration
     */
    private isValidationEnabled(): boolean {
        return vscode.workspace.getConfiguration('mybatis-boost').get<boolean>('enableParameterValidation', true);
    }

    /**
     * Handle configuration change for enableParameterValidation
     */
    private handleConfigurationChange(): void {
        const newEnabled = this.isValidationEnabled();

        if (newEnabled !== this.enabled) {
            this.enabled = newEnabled;
            console.log(`[ParameterValidator] Parameter validation ${this.enabled ? 'enabled' : 'disabled'}`);

            if (this.enabled) {
                // Re-validate all open XML documents when enabled
                vscode.workspace.textDocuments.forEach(doc => {
                    if (doc.languageId === 'xml') {
                        this.validateDocument(doc);
                    }
                });
            } else {
                // Clear all diagnostics when disabled
                this.diagnosticCollection.clear();
                // Also clear any pending validation timers
                this.validationTimers.forEach(timer => clearTimeout(timer));
                this.validationTimers.clear();
            }
        }
    }

    /**
     * Debounced validation to avoid performance issues during rapid typing
     */
    private debouncedValidateDocument(document: vscode.TextDocument): void {
        const documentUri = document.uri.toString();

        // Clear existing timer for this document
        const existingTimer = this.validationTimers.get(documentUri);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.validationTimers.delete(documentUri);
            this.validateDocument(document);
        }, this.DEBOUNCE_DELAY);

        this.validationTimers.set(documentUri, timer);
    }

    /**
     * Validate a single XML document
     */
    async validateDocument(document: vscode.TextDocument): Promise<void> {
        // Skip validation if disabled
        if (!this.enabled) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // Only validate if this is a MyBatis mapper file
            const javaPath = await this.fileMapper.getJavaPath(document.uri.fsPath);
            if (!javaPath) {
                // Not a MyBatis mapper, clear any existing diagnostics
                this.diagnosticCollection.set(document.uri, []);
                return;
            }
            const statements = await extractXmlStatements(document.uri.fsPath);

            // Validate each statement
            for (const statement of statements) {
                const statementDiagnostics = await this.validateStatement(
                    document.uri.fsPath,
                    javaPath,
                    statement
                );
                diagnostics.push(...statementDiagnostics);
            }

            // Set diagnostics for this document
            this.diagnosticCollection.set(document.uri, diagnostics);

        } catch (error) {
            console.error('[ParameterValidator] Error validating document:', error);
        }
    }

    /**
     * Validate parameters in a single SQL statement
     */
    private async validateStatement(
        xmlPath: string,
        javaPath: string,
        statement: { id: string; type: string; line: number }
    ): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // Extract parameters from the statement (#{...} and ${...})
            const parameters = await extractParameterReferences(xmlPath, statement as any);

            // Also extract parameters referenced in attributes (e.g., collection="ids")
            const attrReferences = await extractAttributeReferences(xmlPath, statement as any);

            // Combine both types of references
            const allReferences = [...parameters];
            attrReferences.forEach(attrRef => {
                // Convert attribute references to ParameterReference format for validation
                allReferences.push({
                    name: attrRef,
                    line: statement.line,
                    startColumn: 0,
                    endColumn: 0,
                    type: 'prepared' as const
                });
            });

            // Get parameter info from the statement tag
            const paramInfo = await extractStatementParameterInfo(xmlPath, statement as any);

            // Get valid parameter names
            const validParams = new Set<string>();

            // 1. Add parameters from @Param annotations in Java method
            let methodParams: any[] = [];
            let skipValidation = false;
            try {
                methodParams = await extractMethodParameters(javaPath, statement.id);
                methodParams.forEach(p => validParams.add(p.name));
                console.log(`[ParameterValidator] Method ${statement.id} has parameters: ${Array.from(validParams).join(', ')}`);
            } catch (error) {
                console.error(`[ParameterValidator] Error extracting method parameters:`, error);
            }

            // 2. Add fields from parameterType class
            if (paramInfo.parameterType && !isBuiltInType(paramInfo.parameterType)) {
                try {
                    const fields = await this.getClassFields(paramInfo.parameterType);
                    fields.forEach(f => validParams.add(f));
                    console.log(`[ParameterValidator] Class ${paramInfo.parameterType} has fields: ${fields.join(', ')}`);
                } catch (error) {
                    console.error(`[ParameterValidator] Error extracting class fields:`, error);
                }
            }

            // 2.5. MyBatis parameter handling - add default argument names
            // When parameters don't have @Param annotations, MyBatis provides default names:
            // - arg0, arg1, arg2, ... (0-indexed)
            // - param1, param2, param3, ... (1-indexed)
            const hasAnyParamAnnotation = methodParams.some(p => p.hasParamAnnotation);
            if (!hasAnyParamAnnotation && methodParams.length > 0) {
                methodParams.forEach((p, index) => {
                    // Add default MyBatis argument names
                    validParams.add(`arg${index}`);
                    validParams.add(`param${index + 1}`);
                });
                console.log(`[ParameterValidator] Added default MyBatis argument names for ${methodParams.length} parameters`);
            }

            // 2.6. MyBatis single parameter handling
            // When there's exactly one parameter without @Param annotation:
            // - For primitive/built-in types: MyBatis allows ANY parameter name in XML
            // - For complex objects: MyBatis auto-maps the object's fields
            // - For collections: MyBatis allows 'list', 'collection', 'array' as names
            if (methodParams.length === 1 && !methodParams[0].hasParamAnnotation) {
                const singleParam = methodParams[0];
                const paramType = singleParam.paramType;

                if (isBuiltInType(paramType)) {
                    // For single primitive/built-in parameter without @Param,
                    // MyBatis allows any parameter name, so skip validation entirely
                    skipValidation = true;
                    console.log(`[ParameterValidator] Single primitive parameter ${singleParam.name} (${paramType}): skipping validation (any name allowed)`);
                } else if (isCollectionType(paramType)) {
                    // For single collection parameter, MyBatis allows special names
                    validParams.add('list');
                    validParams.add('collection');
                    validParams.add('array');
                    console.log(`[ParameterValidator] Single collection parameter ${singleParam.name} (${paramType}): added default collection names`);
                } else {
                    // For complex objects, auto-map fields
                    try {
                        // Try to get the fully qualified class name from the Java file
                        const fullyQualifiedType = await resolveFullyQualifiedType(javaPath, paramType);

                        if (fullyQualifiedType) {
                            const fields = await this.getClassFields(fullyQualifiedType);
                            fields.forEach(f => validParams.add(f));
                            console.log(`[ParameterValidator] Single parameter ${singleParam.name} (${fullyQualifiedType}) auto-mapped fields: ${fields.join(', ')}`);
                        }
                    } catch (error) {
                        console.error(`[ParameterValidator] Error extracting fields from single parameter type:`, error);
                    }
                }
            }

            // 3. Add local variables from dynamic SQL tags (foreach, bind)
            try {
                const localVars = await extractLocalVariables(xmlPath, statement as any);
                localVars.forEach(v => validParams.add(v));
                if (localVars.size > 0) {
                    console.log(`[ParameterValidator] Statement ${statement.id} has local variables: ${Array.from(localVars).join(', ')}`);
                }
            } catch (error) {
                console.error(`[ParameterValidator] Error extracting local variables:`, error);
            }

            // 4. TODO: Add parameters from parameterMap (future enhancement)

            // Skip validation if single primitive parameter allows any name
            if (skipValidation) {
                console.log(`[ParameterValidator] Skipping validation for statement ${statement.id} (single primitive parameter)`);
                return diagnostics;
            }

            // Validate each parameter reference
            for (const param of allReferences) {
                if (!validParams.has(param.name)) {
                    // Parameter not found - create diagnostic
                    const range = new vscode.Range(
                        new vscode.Position(param.line, param.startColumn),
                        new vscode.Position(param.line, param.endColumn)
                    );

                    const message = `Parameter '${param.name}' is not defined. ` +
                        `Expected one of: ${Array.from(validParams).join(', ') || '(none)'}`;

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Error
                    );

                    diagnostic.source = 'MyBatis Boost';
                    diagnostics.push(diagnostic);

                    console.log(`[ParameterValidator] Invalid parameter: ${param.name} at line ${param.line}`);
                }
            }

        } catch (error) {
            console.error('[ParameterValidator] Error validating statement:', error);
        }

        return diagnostics;
    }

    /**
     * Get field names from a Java class (with caching)
     */
    private async getClassFields(className: string): Promise<string[]> {
        // 1. Check cache first
        const cached = this.fieldCache.get(className);
        if (cached !== undefined) {
            console.log(`[ParameterValidator] Cache hit for class: ${className} (${cached.length} fields)`);
            return cached;
        }

        // 2. Cache miss - search and parse
        console.log(`[ParameterValidator] Cache miss for class: ${className}, searching...`);

        try {
            const file = await findJavaClassFile(className);

            if (!file) {
                console.log(`[ParameterValidator] Class not found: ${className}`);
                // Cache empty result to avoid repeated searches
                this.fieldCache.set(className, []);
                return [];
            }

            const fields = await extractJavaFields(file.fsPath);
            const fieldNames = fields.map(f => f.name);

            // 3. Store in cache
            this.fieldCache.set(className, fieldNames);
            console.log(`[ParameterValidator] Cached fields for ${className}: ${fieldNames.join(', ')}`);

            return fieldNames;

        } catch (error) {
            console.error(`[ParameterValidator] Error getting class fields:`, error);
            return [];
        }
    }

    /**
     * Invalidate field cache for a specific Java file
     */
    private invalidateFieldCache(javaPath: string): void {
        try {
            // Extract class name from file path
            // Example: /path/to/src/main/java/com/example/User.java → com.example.User
            const className = this.getClassNameFromPath(javaPath);
            if (className) {
                this.fieldCache.delete(className);
                console.log(`[ParameterValidator] Invalidated field cache for: ${className}`);
            }
        } catch (error) {
            console.error(`[ParameterValidator] Error invalidating field cache:`, error);
        }
    }

    /**
     * Extract fully-qualified class name from Java file path
     */
    private getClassNameFromPath(javaPath: string): string | null {
        try {
            // Find the Java source root (src/main/java, src/test/java, etc.)
            const normalizedPath = javaPath.replace(/\\/g, '/');

            // Common Java source roots
            const sourceRoots = [
                '/src/main/java/',
                '/src/test/java/',
                '/src/java/',
                '/java/'
            ];

            for (const root of sourceRoots) {
                const index = normalizedPath.indexOf(root);
                if (index !== -1) {
                    // Extract path after source root
                    const relativePath = normalizedPath.substring(index + root.length);
                    // Remove .java extension and convert / to .
                    const className = relativePath
                        .replace(/\.java$/, '')
                        .replace(/\//g, '.');
                    return className;
                }
            }

            // Fallback: if no standard source root found, try to extract from last few segments
            // This handles non-standard project structures
            const segments = normalizedPath.split('/');
            const javaIndex = segments.lastIndexOf('java');
            if (javaIndex !== -1 && javaIndex < segments.length - 1) {
                const relevantSegments = segments.slice(javaIndex + 1);
                const className = relevantSegments
                    .join('.')
                    .replace(/\.java$/, '');
                return className;
            }

            return null;
        } catch (error) {
            console.error(`[ParameterValidator] Error extracting class name from path:`, error);
            return null;
        }
    }

    /**
     * Revalidate all open XML documents after external Java file changes
     */
    private revalidateOpenXmlDocuments(): void {
        if (!this.enabled) {
            return;
        }
        vscode.workspace.textDocuments.forEach(doc => {
            if (doc.languageId === 'xml') {
                this.debouncedValidateDocument(doc);
            }
        });
    }

    /**
     * Check if validation is currently enabled
     * Useful for testing and debugging
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Clear all diagnostics
     */
    public clear(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Clear all pending validation timers
        this.validationTimers.forEach(timer => clearTimeout(timer));
        this.validationTimers.clear();

        // Clear field cache
        this.fieldCache.clear();

        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
