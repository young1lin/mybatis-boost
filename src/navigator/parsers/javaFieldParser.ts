/**
 * Java field parser for extracting field declarations from Java classes
 *
 * Uses tree-sitter AST parsing when available, with regex fallback.
 */

import { JavaField } from '../../types';
import { readFile } from '../../utils/fileUtils';
import { extractFieldsFromAST, extractSuperclassNameFromAST } from './javaTreeSitterParser';
import { getClassFieldsViaLS } from '../../utils/javaLSHelper';

/**
 * Extract all fields from a Java class
 *
 * Three-tier fallback: WASM (tree-sitter) → Java LS → Regex
 *
 * @param filePath - Path to Java file
 * @returns Array of field information
 */
export async function extractJavaFields(filePath: string): Promise<JavaField[]> {
    const content = await readFile(filePath);

    // Tier 1: WASM (tree-sitter)
    try {
        return await extractFieldsFromAST(content);
    } catch { /* fallthrough */ }

    // Tier 2: Java Language Server
    try {
        const lsFields = await getClassFieldsViaLS(filePath);
        if (lsFields) {
            return lsFields;
        }
    } catch { /* fallthrough */ }

    // Tier 3: Regex fallback
    return extractJavaFieldsRegex(content);
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
 * @returns Superclass name as written in source (simple or fully-qualified,
 *          without generic type arguments), or null when the class extends nothing
 */
export async function extractSuperclassName(filePath: string): Promise<string | null> {
    const content = await readFile(filePath);

    // Tier 1: WASM (tree-sitter)
    try {
        return await extractSuperclassNameFromAST(content);
    } catch { /* fallthrough */ }

    // Tier 2: Regex fallback
    return extractSuperclassNameRegex(content);
}

// ==================== Regex fallback implementation ====================

function extractSuperclassNameRegex(content: string): string | null {
    // The optional generic group keeps bounded type parameters like
    // "class Child<T extends Number> extends Base" from capturing "Number"
    const match = content.match(/\bclass\s+\w+(?:\s*<[^>]*>)?\s+extends\s+([\w.]+)/);
    return match ? match[1] : null;
}

function extractJavaFieldsRegex(content: string): JavaField[] {
    const lines = content.split('\n');
    const fields: JavaField[] = [];

    let inClassBody = false;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/(?:class|interface|enum)\s+\w+/.test(line)) {
            inClassBody = false;
        }

        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        if (braceLevel > 0) {
            inClassBody = true;
        }

        if (!inClassBody || braceLevel !== 1) {
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
