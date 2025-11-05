/**
 * Java field parser for extracting field declarations from Java classes
 */

import { JavaField } from '../../types';
import { readFile } from '../../utils/fileUtils';

/**
 * Extract all fields from a Java class
 *
 * @param filePath - Path to Java file
 * @returns Array of field information
 */
export async function extractJavaFields(filePath: string): Promise<JavaField[]> {
    const content = await readFile(filePath);
    const lines = content.split('\n');
    const fields: JavaField[] = [];

    let inClassBody = false;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track class boundaries
        if (/(?:class|interface|enum)\s+\w+/.test(line)) {
            inClassBody = false; // Will become true when we see the opening brace
        }

        // Track brace level
        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        // We're in class body if brace level is 1 (inside class but not in methods)
        if (braceLevel > 0) {
            inClassBody = true;
        }

        // Skip if not in class body or inside methods/blocks
        if (!inClassBody || braceLevel !== 1) {
            continue;
        }

        // Skip comments and annotations
        if (trimmed.startsWith('//') || trimmed.startsWith('@') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }

        // Skip method declarations (they have parentheses)
        if (trimmed.includes('(')) {
            continue;
        }

        // Match field declarations
        // Pattern: [modifiers] Type fieldName [= value];
        // Examples:
        //   private String name;
        //   protected Integer age = 0;
        //   public Long id;
        //   private List<String> items;
        const fieldRegex = /(?:private|protected|public|static|final)?\s*(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/;
        const match = trimmed.match(fieldRegex);

        if (match) {
            const fieldType = match[1];
            const fieldName = match[2];

            // Find the column position of the field name in the original line
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
