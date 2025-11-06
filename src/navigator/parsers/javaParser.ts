/**
 * Java file parser
 */
import { JavaMethod, MethodParameter } from '../../types';
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

/**
 * Extract method parameters from a specific method in a Java mapper interface
 *
 * @param filePath - Path to Java file
 * @param methodName - Method name
 * @returns Array of method parameters with @Param annotations
 */
export async function extractMethodParameters(
    filePath: string,
    methodName: string
): Promise<MethodParameter[]> {
    const content = await readFile(filePath);
    const lines = content.split('\n');
    const parameters: MethodParameter[] = [];

    let inInterface = false;
    let braceLevel = 0;
    let foundMethod = false;
    let methodDeclaration = '';
    let methodStartLine = -1;

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
        if (braceLevel === 0 && inInterface && i > 0) {
            break;
        }

        // Skip if not inside interface body
        if (!inInterface || braceLevel !== 1) {
            continue;
        }

        // Look for the method
        if (!foundMethod) {
            // Check if this line contains the method name
            const methodRegex = new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`);
            if (methodRegex.test(line)) {
                foundMethod = true;
                methodStartLine = i;
                // Start accumulating from a few lines before to capture annotations
                // but stop at any line that looks like the end of another method/statement
                methodDeclaration = '';
                let startLine = Math.max(0, i - 10); // Look back up to 10 lines

                // Find the actual start by looking for the last closing brace, semicolon, or interface declaration
                for (let j = i - 1; j >= startLine; j--) {
                    const prevLine = lines[j].trim();
                    // Stop if we hit an import statement (shouldn't be part of method declaration)
                    if (prevLine.startsWith('import ')) {
                        startLine = j + 1;
                        break;
                    }
                    // Stop if we hit a package declaration
                    if (prevLine.startsWith('package ')) {
                        startLine = j + 1;
                        break;
                    }
                    // Stop if we hit the end of a previous statement or method
                    if (prevLine.endsWith(';') || prevLine.endsWith('}')) {
                        startLine = j + 1;
                        break;
                    }
                    // Stop if we hit the interface declaration
                    if (prevLine.includes('interface')) {
                        startLine = j + 1;
                        break;
                    }
                }

                // Accumulate from the determined start line to current line
                for (let j = startLine; j <= i; j++) {
                    methodDeclaration += lines[j] + '\n';
                }
            }
        } else {
            // Continue accumulating method declaration until we find the semicolon
            methodDeclaration += line + '\n';
        }

        // If we found the method and reached the end of the declaration
        if (foundMethod && (line.includes(';') || line.includes('{'))) {
            // Extract parameters from the complete method declaration
            const params = parseMethodParameters(methodDeclaration, methodStartLine, lines);
            parameters.push(...params);
            break;
        }
    }

    console.log(`[javaParser] Found ${parameters.length} parameters for method ${methodName}`);
    return parameters;
}

/**
 * Parse method parameters from a method declaration string
 *
 * @param declaration - Complete method declaration
 * @param startLine - Starting line number
 * @param lines - All lines in the file
 * @returns Array of method parameters
 */
function parseMethodParameters(
    declaration: string,
    startLine: number,
    lines: string[]
): MethodParameter[] {
    const parameters: MethodParameter[] = [];

    // Extract the parameter list (everything between the method's parentheses)
    // Need to handle nested parentheses in annotations like @Param("value")
    const openParenIndex = declaration.indexOf('(');
    if (openParenIndex === -1) {
        return parameters;
    }

    // Find matching closing parenthesis
    let parenLevel = 0;
    let closeParenIndex = -1;
    for (let i = openParenIndex; i < declaration.length; i++) {
        if (declaration[i] === '(') {
            parenLevel++;
        } else if (declaration[i] === ')') {
            parenLevel--;
            if (parenLevel === 0) {
                closeParenIndex = i;
                break;
            }
        }
    }

    if (closeParenIndex === -1) {
        return parameters;
    }

    const paramList = declaration.substring(openParenIndex + 1, closeParenIndex).trim();
    if (!paramList) {
        return parameters;
    }

    // Split parameters by comma (but not commas inside angle brackets)
    const paramStrings = splitParameters(paramList);

    for (const paramStr of paramStrings) {
        const trimmed = paramStr.trim();
        if (!trimmed) {
            continue;
        }

        // Check for @Param annotation
        const paramAnnotationMatch = trimmed.match(/@Param\s*\(\s*["']([^"']+)["']\s*\)/);
        const hasParamAnnotation = paramAnnotationMatch !== null;
        const annotationValue = paramAnnotationMatch ? paramAnnotationMatch[1] : null;

        // Extract type and name
        // Pattern: [annotations] Type paramName
        // Remove annotations first
        let withoutAnnotations = trimmed.replace(/@\w+\s*\([^)]*\)/g, '').trim();
        withoutAnnotations = withoutAnnotations.replace(/@\w+/g, '').trim();

        // Match type and parameter name
        // Handle generic types like List<String> but extract only root type
        // Support fully qualified class names (e.g., com.example.query.UserQuery)
        const typeParamMatch = withoutAnnotations.match(/([\w.]+)(?:<[^>]+>)?\s+(\w+)/);

        if (typeParamMatch) {
            const paramType = typeParamMatch[1]; // Can be simple (List) or fully qualified (com.example.UserQuery)
            const paramName = typeParamMatch[2];

            // Use annotation value if present, otherwise use parameter name
            const effectiveParamName = annotationValue || paramName;

            // Find the line and column where the parameter name appears
            let paramLine = startLine;
            let paramStartColumn = 0;
            let paramEndColumn = 0;

            // Search for the parameter name in the method declaration
            for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
                const line = lines[i];

                // For @Param annotation, find the annotation value
                if (hasParamAnnotation && annotationValue) {
                    const annotationRegex = new RegExp(`@Param\\s*\\(\\s*["']${escapeRegex(annotationValue)}["']\\s*\\)`);
                    if (annotationRegex.test(line)) {
                        paramLine = i;
                        const match = line.match(annotationRegex);
                        if (match && match.index !== undefined) {
                            // Find the position of the annotation value (inside quotes)
                            const quotePos = line.indexOf(annotationValue, match.index);
                            if (quotePos >= 0) {
                                paramStartColumn = quotePos;
                                paramEndColumn = quotePos + annotationValue.length;
                            }
                        }
                        break;
                    }
                } else {
                    // Find the parameter name in the declaration
                    const paramNameRegex = new RegExp(`\\b${escapeRegex(paramName)}\\b`);
                    if (paramNameRegex.test(line) && !line.trim().startsWith('//')) {
                        paramLine = i;
                        const match = line.match(paramNameRegex);
                        if (match && match.index !== undefined) {
                            paramStartColumn = match.index;
                            paramEndColumn = match.index + paramName.length;
                        }
                        break;
                    }
                }
            }

            parameters.push({
                name: effectiveParamName,
                paramType: paramType,
                line: paramLine,
                startColumn: paramStartColumn,
                endColumn: paramEndColumn,
                hasParamAnnotation: hasParamAnnotation
            });

            console.log(`[javaParser] Found parameter: ${effectiveParamName} (${paramType}) at line ${paramLine}, hasParamAnnotation: ${hasParamAnnotation}`);
        }
    }

    return parameters;
}

/**
 * Split parameter list by commas, respecting generic type brackets
 *
 * @param paramList - Parameter list string
 * @returns Array of parameter strings
 */
function splitParameters(paramList: string): string[] {
    const params: string[] = [];
    let current = '';
    let bracketLevel = 0;

    for (let i = 0; i < paramList.length; i++) {
        const char = paramList[i];

        if (char === '<') {
            bracketLevel++;
            current += char;
        } else if (char === '>') {
            bracketLevel--;
            current += char;
        } else if (char === ',' && bracketLevel === 0) {
            params.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Add the last parameter
    if (current.trim()) {
        params.push(current.trim());
    }

    return params;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
