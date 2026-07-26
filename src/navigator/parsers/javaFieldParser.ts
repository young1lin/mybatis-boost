/**
 * Java field parser for extracting field declarations from Java classes
 *
 * Uses tree-sitter AST parsing when available, with regex fallback.
 */

import { JavaField } from '../../types';
import { readFile } from '../../utils/fileUtils';
import { escapeRegex } from '../../utils/stringUtils';
import { extractFieldsFromAST, extractSuperclassNameFromAST } from './javaTreeSitterParser';
import { getClassFieldsViaLS } from '../../utils/javaLSHelper';

/**
 * Extract all fields from a Java class
 *
 * Three-tier fallback: WASM (tree-sitter) → Java LS → Regex
 *
 * @param filePath - Path to Java file
 * @param className - When given, extraction is scoped to that class declaration
 *                    so other types in the same file cannot contribute fields
 * @returns Array of field information
 */
export async function extractJavaFields(filePath: string, className?: string): Promise<JavaField[]> {
    const content = await readFile(filePath);

    // Tier 1: WASM (tree-sitter)
    try {
        return await extractFieldsFromAST(content, className);
    } catch { /* fallthrough */ }

    // Tier 2: Java Language Server
    try {
        const lsFields = await getClassFieldsViaLS(filePath, className);
        if (lsFields) {
            return lsFields;
        }
    } catch { /* fallthrough */ }

    // Tier 3: Regex fallback
    return extractJavaFieldsRegex(content, className);
}

/**
 * Find a specific field in a Java class
 *
 * @param filePath - Path to Java file
 * @param fieldName - Field name to find
 * @returns Field information if found, null otherwise
 */
export async function findJavaField(
    filePath: string,
    fieldName: string
): Promise<JavaField | null> {
    const fields = await extractJavaFields(filePath);
    const field = fields.find(f => f.name === fieldName);

    if (field) {
        console.log(`[javaFieldParser] Found field ${fieldName} at line ${field.line}`);
    } else {
        console.log(`[javaFieldParser] Field ${fieldName} NOT FOUND`);
    }

    return field || null;
}

/**
 * Find a specific field in a Java class and return its position
 *
 * @param filePath - Path to Java file
 * @param fieldName - Field name to find
 * @returns Position information if found, null otherwise
 */
export async function findJavaFieldPosition(
    filePath: string,
    fieldName: string
): Promise<{ line: number; startColumn: number; endColumn: number } | null> {
    const field = await findJavaField(filePath, fieldName);

    if (field) {
        return {
            line: field.line,
            startColumn: field.startColumn,
            endColumn: field.endColumn
        };
    }

    return null;
}

/**
 * Extract the superclass name declared in a Java class file's `extends` clause
 *
 * Two-tier fallback: WASM (tree-sitter) → Regex
 *
 * @param filePath - Path to Java file
 * @param className - When given, only that class declaration is inspected, so
 *                    other types in the same file cannot be mistaken for the
 *                    class's superclass
 * @returns Superclass name as written in source (simple or fully-qualified,
 *          without generic type arguments), or null when the class extends nothing
 */
export async function extractSuperclassName(
    filePath: string,
    className?: string
): Promise<string | null> {
    const content = await readFile(filePath);

    // Tier 1: WASM (tree-sitter)
    try {
        return await extractSuperclassNameFromAST(content, className);
    } catch { /* fallthrough */ }

    // Tier 2: Regex fallback
    return extractSuperclassNameRegex(content, className);
}

// ==================== Regex fallback implementation ====================

function extractSuperclassNameRegex(content: string, className?: string): string | null {
    // Strip comments so "// class Foo extends Bar" cannot produce a false match
    const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');

    // The optional generic group keeps bounded type parameters like
    // "class Child<T extends Number> extends Base" from capturing "Number",
    // and supports one level of nested generics such as
    // "class Foo<T extends Comparable<String>> extends Base".
    // Anchoring on the class name keeps other types in the same file from
    // being mistaken for the class's superclass.
    const classToken = className ? escapeRegex(className) : '\\w+';
    const superclassRegex = new RegExp(
        `\\bclass\\s+${classToken}(?:\\s*<(?:[^<>]|<[^<>]*>)*>)?\\s+extends\\s+([\\w.]+)`
    );
    const match = withoutComments.match(superclassRegex);
    return match ? match[1] : null;
}

function extractJavaFieldsRegex(content: string, className?: string): JavaField[] {
    const lines = content.split('\n');
    const fields: JavaField[] = [];

    let inClassBody = false;
    let braceLevel = 0;
    // When scoped to a class, only collect fields while inside that class's body
    let inTargetClass = !className;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/(?:class|interface|enum)\s+\w+/.test(line)) {
            inClassBody = false;
            // Only top-level declarations (braceLevel 0) change which class we
            // are in. Nested type declarations must not clear the flag: their
            // own fields sit deeper than braceLevel 1 and are excluded by the
            // depth check, while the outer class's fields after the nested
            // type still belong to the target class.
            if (className && braceLevel === 0) {
                inTargetClass = new RegExp(`\\b(?:class|interface|enum)\\s+${escapeRegex(className)}\\b`).test(line);
            }
        }

        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        if (braceLevel > 0) {
            inClassBody = true;
        }

        if (!inClassBody || braceLevel !== 1 || !inTargetClass) {
            continue;
        }

        if (trimmed.startsWith('//') || trimmed.startsWith('@') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }

        if (trimmed.includes('(')) {
            continue;
        }

        const fieldRegex = /(?:private|protected|public|static|final)?\s*(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/;
        const match = trimmed.match(fieldRegex);

        if (match) {
            const fieldType = match[1];
            const fieldName = match[2];

            const fieldNameIndex = line.indexOf(fieldName);

            if (fieldNameIndex >= 0) {
                const startColumn = fieldNameIndex;
                const endColumn = startColumn + fieldName.length;

                fields.push({
                    name: fieldName,
                    fieldType: fieldType,
                    line: i,
                    startColumn: startColumn,
                    endColumn: endColumn
                });

                console.log(`[javaFieldParser] Found field: ${fieldName} (${fieldType}) at line ${i}, columns ${startColumn}-${endColumn}`);
            }
        }
    }

    console.log(`[javaFieldParser] Total fields found: ${fields.length}`);
    return fields;
}
