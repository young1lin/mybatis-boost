/**
 * Three-tier fallback type resolver: WASM (tree-sitter) → Java LS → Regex
 * Resolves simple Java type names to fully-qualified class names
 */

import * as vscode from 'vscode';
import { initTreeSitter } from '../navigator/parsers/javaTreeSitterParser';
import { resolveTypeViaLS } from './javaLSHelper';
import { WORKSPACE_EXCLUDE_PATTERN } from './fileUtils';

/**
 * Resolve a simple type name to its fully-qualified name from a Java source file.
 *
 * Three-tier fallback:
 * 1. WASM (tree-sitter): Verify parser available, extract imports via regex
 *    (import syntax is fixed, regex is reliable here; tree-sitter confirms Java parsing works)
 * 2. Java LS: Use workspace symbol provider via Red Hat Java extension
 *    (finds classes on classpath, not just source files)
 * 3. Regex: Scan import lines + same-package fallback
 *
 * @param javaPath - Path to the Java file containing the type reference
 * @param simpleTypeName - Simple class name (e.g., "User")
 * @returns Fully-qualified class name or null
 */
export async function resolveFullyQualifiedType(
    javaPath: string,
    simpleTypeName: string
): Promise<string | null> {
    // Already fully qualified
    if (simpleTypeName.includes('.')) {
        return simpleTypeName;
    }

    const fs = await import('fs');
    const content = await fs.promises.readFile(javaPath, 'utf-8');

    // Tier 1: WASM-backed import resolution
    // Use tree-sitter availability as a signal that Java parsing is working,
    // then extract imports (which have fixed syntax, so regex is reliable)
    try {
        if (await initTreeSitter()) {
            const result = resolveFromImports(content, simpleTypeName);
            if (result) {
                console.log(`[javaTypeResolver] WASM tier resolved ${simpleTypeName} to ${result}`);
                return result;
            }
        }
    } catch {
        // fallthrough to next tier
    }

    // Tier 2: Java Language Server (finds classpath classes, not just source files)
    try {
        const result = await resolveTypeViaLS(simpleTypeName);
        if (result) {
            console.log(`[javaTypeResolver] Java LS resolved ${simpleTypeName} to ${result}`);
            return result;
        }
    } catch {
        // fallthrough to next tier
    }

    // Tier 3: Regex fallback (imports + same-package check)
    const fromImports = resolveFromImports(content, simpleTypeName);
    if (fromImports) {
        console.log(`[javaTypeResolver] Regex resolved ${simpleTypeName} to ${fromImports}`);
        return fromImports;
    }

    // Same-package fallback
    const fromSamePackage = await resolveFromSamePackage(content, simpleTypeName);
    if (fromSamePackage) {
        console.log(`[javaTypeResolver] Same-package resolved ${simpleTypeName} to ${fromSamePackage}`);
        return fromSamePackage;
    }

    // Wildcard-import fallback (lowest precedence, matching Java import semantics)
    const fromWildcard = await resolveFromWildcardImports(content, simpleTypeName);
    if (fromWildcard) {
        console.log(`[javaTypeResolver] Wildcard-import resolved ${simpleTypeName} to ${fromWildcard}`);
    } else {
        console.log(`[javaTypeResolver] Could not resolve ${simpleTypeName}`);
    }
    return fromWildcard;
}

/**
 * Resolve type from import declarations in Java source content
 */
function resolveFromImports(content: string, simpleTypeName: string): string | null {
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Stop at the class/interface declaration
        if (trimmed.match(/(?:class|interface|enum)\s+/)) {
            break;
        }

        const importMatch = trimmed.match(/import\s+([\w.]+\.(\w+))\s*;/);
        if (importMatch && importMatch[2] === simpleTypeName) {
            return importMatch[1];
        }
    }

    return null;
}

/**
 * Resolve type from wildcard import declarations (e.g., `import com.example.common.*;`)
 * by checking whether the imported package contains a matching source file in the
 * workspace. Static imports are ignored — they import members, not types.
 */
async function resolveFromWildcardImports(content: string, simpleTypeName: string): Promise<string | null> {
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Stop at the class/interface declaration
        if (trimmed.match(/(?:class|interface|enum)\s+/)) {
            break;
        }

        const wildcardMatch = trimmed.match(/^import\s+([\w.]+)\.\*\s*;/);
        if (!wildcardMatch) {
            continue;
        }

        const candidate = `${wildcardMatch[1]}.${simpleTypeName}`;
        const pathPattern = candidate.replace(/\./g, '/') + '.java';

        const files = await vscode.workspace.findFiles(
            `**/${pathPattern}`,
            WORKSPACE_EXCLUDE_PATTERN,
            1
        );

        if (files.length > 0) {
            return candidate;
        }
    }

    return null;
}

/**
 * Resolve type by checking the same package
 */
async function resolveFromSamePackage(content: string, simpleTypeName: string): Promise<string | null> {
    const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
    if (packageMatch) {
        const packageName = packageMatch[1];
        const possibleFullyQualified = `${packageName}.${simpleTypeName}`;

        const pathPattern = possibleFullyQualified.replace(/\./g, '/') + '.java';
        const searchPattern = `**/${pathPattern}`;

        const files = await vscode.workspace.findFiles(
            searchPattern,
            WORKSPACE_EXCLUDE_PATTERN,
            1
        );

        if (files.length > 0) {
            return possibleFullyQualified;
        }
    }

    return null;
}
