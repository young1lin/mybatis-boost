/**
 * Java file parser
 */
import { JavaMethod } from '../../types';
import { readFirstLines, readFile } from '../../utils/fileUtils';

/**
 * Extract namespace (package + interface name) from Java file
 * Only reads first N lines for performance
 */
export async function extractJavaNamespace(
    filePath: string,
    parseLines: number = 100
): Promise<string | null> {
    const content = await readFirstLines(filePath, parseLines);

    // Extract package
    const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
    if (!packageMatch) {
        return null;
    }
    const packageName = packageMatch[1];

    // Extract interface name
    const interfaceMatch = content.match(/(?:public\s+)?interface\s+(\w+)/);
    if (!interfaceMatch) {
        return null;
    }
    const interfaceName = interfaceMatch[1];

    return `${packageName}.${interfaceName}`;
}

/**
 * Check if a Java file is a MyBatis mapper interface
 */
export async function isMyBatisMapper(filePath: string): Promise<boolean> {
    const content = await readFirstLines(filePath, 100);

    // Must be an interface
    if (!content.includes('interface')) {
        return false;
    }

    // Check for MyBatis annotations or imports
    const hasAnnotations = /@Mapper|@Select|@Insert|@Update|@Delete/.test(content);
    const hasImports = /import\s+org\.(apache\.ibatis|mybatis)\./.test(content);

    return hasAnnotations || hasImports;
}

/**
 * Extract all methods from a Java mapper interface
 */
export async function extractJavaMethods(filePath: string): Promise<JavaMethod[]> {
    const content = await readFile(filePath);
    const lines = content.split('\n');
    const methods: JavaMethod[] = [];

    let inInterface = false;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track interface boundaries
        if (/interface\s+\w+/.test(line)) {
            inInterface = true;
        }

        // Track brace level
        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        // Exit if we're out of the interface
        if (braceLevel === 0 && inInterface) {
            break;
        }

        // Skip if not inside interface body (braceLevel should be 1 for method declarations)
        if (!inInterface || braceLevel !== 1) {
            continue;
        }

        // Skip comments and annotations
        if (trimmed.startsWith('//') || trimmed.startsWith('@') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }

        // Match method declarations
        // Improved regex to handle various method patterns
        // Matches: [modifiers] ReturnType methodName(params) [throws ...];
        const methodRegex = /(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/;
        const match = trimmed.match(methodRegex);

        if (match) {
            const methodName = match[2];
            // Avoid matching class names or keywords
            if (methodName !== 'interface' && methodName !== 'class' && methodName !== 'enum') {
                // Check if method ends on same line
                let methodComplete = trimmed.includes(';') || trimmed.includes(')');

                // If not complete on same line, look ahead to find the end
                if (!methodComplete) {
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.includes(';') || nextLine.includes('}')) {
                            methodComplete = true;
                            break;
                        }
                    }
                }

                // Only add if we found a valid method ending
                if (methodComplete) {
                    // Find the column position of the method name in the original line
                    const methodNameIndex = line.indexOf(methodName);
                    const startColumn = methodNameIndex >= 0 ? methodNameIndex : 0;
                    const endColumn = startColumn + methodName.length;

                    methods.push({
                        name: methodName,
                        line: i,
                        startColumn: startColumn,
                        endColumn: endColumn,
                        signature: trimmed
                    });
                    console.log(`[javaParser] Found method: ${methodName} at line ${i}, columns ${startColumn}-${endColumn}`);
                }
            }
        }
    }

    console.log(`[javaParser] Total methods found: ${methods.length}`);
    return methods;
}

/**
 * Find a specific method in Java file and return its line number
 */
export async function findJavaMethodLine(filePath: string, methodName: string): Promise<number | null> {
    console.log(`[javaParser] Looking for method: ${methodName} in ${filePath}`);
    const methods = await extractJavaMethods(filePath);
    console.log(`[javaParser] Available methods: ${methods.map(m => m.name).join(', ')}`);
    const method = methods.find(m => m.name === methodName);
    if (method) {
        console.log(`[javaParser] Found method ${methodName} at line ${method.line}`);
    } else {
        console.log(`[javaParser] Method ${methodName} NOT FOUND`);
    }
    return method ? method.line : null;
}

/**
 * Find a specific method in Java file and return its position (line and column range)
 */
export async function findJavaMethodPosition(
    filePath: string,
    methodName: string
): Promise<{ line: number; startColumn: number; endColumn: number } | null> {
    console.log(`[javaParser] Looking for method position: ${methodName} in ${filePath}`);
    const methods = await extractJavaMethods(filePath);
    console.log(`[javaParser] Available methods: ${methods.map(m => m.name).join(', ')}`);
    const method = methods.find(m => m.name === methodName);
    if (method) {
        console.log(`[javaParser] Found method ${methodName} at line ${method.line}, columns ${method.startColumn}-${method.endColumn}`);
        return { line: method.line, startColumn: method.startColumn, endColumn: method.endColumn };
    } else {
        console.log(`[javaParser] Method ${methodName} NOT FOUND`);
        return null;
    }
}
