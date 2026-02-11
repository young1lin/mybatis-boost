/**
 * Java file parser
 *
 * Uses tree-sitter AST parsing when available, with regex fallback.
 */
import { JavaMethod, MethodParameter } from '../../types';
import { readFirstLines, readFile } from '../../utils/fileUtils';
import {
    extractMethodsFromAST,
    extractParametersFromAST,
    extractNamespaceFromAST,
    isMyBatisMapperFromAST,
} from './javaTreeSitterParser';

/**
 * Extract namespace (package + interface name) from Java file
 * Only reads first N lines for performance
 */
export async function extractJavaNamespace(
    filePath: string,
    parseLines: number = 100
): Promise<string | null> {
    const content = await readFirstLines(filePath, parseLines);
    try {
        return await extractNamespaceFromAST(content);
    } catch {
        return extractJavaNamespaceRegex(content);
    }
}

/**
 * Check if a Java file is a MyBatis mapper interface
 */
export async function isMyBatisMapper(filePath: string): Promise<boolean> {
    const content = await readFirstLines(filePath, 100);
    try {
        return await isMyBatisMapperFromAST(content);
    } catch {
        return isMyBatisMapperRegex(content);
    }
}

/**
 * Extract all methods from a Java mapper interface
 */
export async function extractJavaMethods(filePath: string): Promise<JavaMethod[]> {
    const content = await readFile(filePath);
    return extractJavaMethodsFromContent(content);
}

/**
 * Extract all methods from Java content string (for use with document.getText())
 */
export async function extractJavaMethodsFromContent(content: string): Promise<JavaMethod[]> {
    try {
        return await extractMethodsFromAST(content);
    } catch {
        return extractJavaMethodsRegex(content);
    }
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
 */
export async function extractMethodParameters(
    filePath: string,
    methodName: string
): Promise<MethodParameter[]> {
    const content = await readFile(filePath);
    try {
        return await extractParametersFromAST(content, methodName);
    } catch {
        return extractMethodParametersRegex(content, methodName);
    }
}

// ==================== Regex fallback implementations ====================

function extractJavaNamespaceRegex(content: string): string | null {
    const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
    if (!packageMatch) {
        return null;
    }
    const packageName = packageMatch[1];

    const interfaceMatch = content.match(/(?:public\s+)?interface\s+(\w+)/);
    if (!interfaceMatch) {
        return null;
    }
    const interfaceName = interfaceMatch[1];

    return `${packageName}.${interfaceName}`;
}

function isMyBatisMapperRegex(content: string): boolean {
    if (!content.includes('interface')) {
        return false;
    }
    const hasAnnotations = /@Mapper|@Select|@Insert|@Update|@Delete/.test(content);
    const hasImports = /import\s+org\.(apache\.ibatis|mybatis)\./.test(content);
    return hasAnnotations || hasImports;
}

function extractJavaMethodsRegex(content: string): JavaMethod[] {
    const lines = content.split('\n');
    const methods: JavaMethod[] = [];

    let inInterface = false;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/interface\s+\w+/.test(line)) {
            inInterface = true;
        }

        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        if (braceLevel === 0 && inInterface) {
            break;
        }

        if (!inInterface || braceLevel !== 1) {
            continue;
        }

        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }

        // For lines starting with @, strip annotations to check for method signature underneath
        let lineForExtraction = trimmed;
        if (trimmed.startsWith('@')) {
            lineForExtraction = stripLeadingAnnotations(trimmed);
            if (!lineForExtraction) {
                continue; // Pure annotation line (e.g., @Mapper, @Select("..."), @Override)
            }
        }

        const methodName = extractMethodNameFromLine(lineForExtraction);

        if (methodName) {
            if (methodName !== 'interface' && methodName !== 'class' && methodName !== 'enum') {
                let methodComplete = trimmed.includes(';') || trimmed.includes(')');

                if (!methodComplete) {
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.includes(';') || nextLine.includes('}')) {
                            methodComplete = true;
                            break;
                        }
                    }
                }

                if (methodComplete) {
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

function extractMethodParametersRegex(content: string, methodName: string): MethodParameter[] {
    const lines = content.split('\n');
    const parameters: MethodParameter[] = [];

    let inInterface = false;
    let braceLevel = 0;
    let foundMethod = false;
    let methodDeclaration = '';
    let methodStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/interface\s+\w+/.test(line)) {
            inInterface = true;
        }

        braceLevel += (line.match(/{/g) || []).length;
        braceLevel -= (line.match(/}/g) || []).length;

        if (braceLevel === 0 && inInterface && i > 0) {
            break;
        }

        if (!inInterface || braceLevel !== 1) {
            continue;
        }

        if (!foundMethod) {
            const methodRegex = new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`);
            if (methodRegex.test(line)) {
                foundMethod = true;
                methodStartLine = i;
                methodDeclaration = '';
                let startLine = Math.max(0, i - 10);

                for (let j = i - 1; j >= startLine; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('import ')) {
                        startLine = j + 1;
                        break;
                    }
                    if (prevLine.startsWith('package ')) {
                        startLine = j + 1;
                        break;
                    }
                    if (prevLine.endsWith(';') || prevLine.endsWith('}')) {
                        startLine = j + 1;
                        break;
                    }
                    if (prevLine.includes('interface')) {
                        startLine = j + 1;
                        break;
                    }
                }

                for (let j = startLine; j <= i; j++) {
                    methodDeclaration += lines[j] + '\n';
                }
            }
        } else {
            methodDeclaration += line + '\n';
        }

        if (foundMethod && (line.includes(';') || line.includes('{'))) {
            const params = parseMethodParameters(methodDeclaration, methodStartLine, lines);
            parameters.push(...params);
            break;
        }
    }

    console.log(`[javaParser] Found ${parameters.length} parameters for method ${methodName}`);
    return parameters;
}

function parseMethodParameters(
    declaration: string,
    startLine: number,
    lines: string[]
): MethodParameter[] {
    const parameters: MethodParameter[] = [];

    const cleanDeclaration = declaration
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');

    const openParenIndex = cleanDeclaration.indexOf('(');
    if (openParenIndex === -1) {
        return parameters;
    }

    let parenLevel = 0;
    let closeParenIndex = -1;
    for (let i = openParenIndex; i < cleanDeclaration.length; i++) {
        if (cleanDeclaration[i] === '(') {
            parenLevel++;
        } else if (cleanDeclaration[i] === ')') {
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

    const paramList = cleanDeclaration.substring(openParenIndex + 1, closeParenIndex).trim();
    if (!paramList) {
        return parameters;
    }

    const paramStrings = splitParameters(paramList);

    for (const paramStr of paramStrings) {
        const trimmed = paramStr.trim();
        if (!trimmed) {
            continue;
        }

        const paramAnnotationMatch = trimmed.match(/@Param\s*\(\s*["']([^"']+)["']\s*\)/);
        const hasParamAnnotation = paramAnnotationMatch !== null;
        const annotationValue = paramAnnotationMatch ? paramAnnotationMatch[1] : null;

        let withoutAnnotations = trimmed.replace(/@\w+\s*\([^)]*\)/g, '').trim();
        withoutAnnotations = withoutAnnotations.replace(/@\w+/g, '').trim();

        const typeParamMatch = withoutAnnotations.match(/([\w.]+)(?:<[^>]+>)?\s+(\w+)/);

        if (typeParamMatch) {
            const paramType = typeParamMatch[1];
            const paramName = typeParamMatch[2];
            const effectiveParamName = annotationValue || paramName;

            let paramLine = startLine;
            let paramStartColumn = 0;
            let paramEndColumn = 0;

            for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
                const line = lines[i];

                if (hasParamAnnotation && annotationValue) {
                    const annotationRegex = new RegExp(`@Param\\s*\\(\\s*["']${escapeRegex(annotationValue)}["']\\s*\\)`);
                    if (annotationRegex.test(line)) {
                        paramLine = i;
                        const match = line.match(annotationRegex);
                        if (match && match.index !== undefined) {
                            const quotePos = line.indexOf(annotationValue, match.index);
                            if (quotePos >= 0) {
                                paramStartColumn = quotePos;
                                paramEndColumn = quotePos + annotationValue.length;
                            }
                        }
                        break;
                    }
                } else {
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

    if (current.trim()) {
        params.push(current.trim());
    }

    return params;
}

function skipGenericType(text: string, start: number): number {
    if (text[start] !== '<') {
        return -1;
    }
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '<') {
            depth++;
        } else if (text[i] === '>') {
            depth--;
            if (depth === 0) {
                return i + 1;
            }
        }
    }
    return -1;
}

function extractMethodNameFromLine(trimmedLine: string): string | null {
    let lastWord = '';
    let i = 0;

    while (i < trimmedLine.length) {
        const ch = trimmedLine[i];

        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }

        if (ch === '(') {
            return lastWord || null;
        }

        if (ch === '<') {
            const end = skipGenericType(trimmedLine, i);
            if (end === -1) {
                return null;
            }
            i = end;
            continue;
        }

        if (/[\w.]/.test(ch)) {
            let word = '';
            while (i < trimmedLine.length && /[\w.]/.test(trimmedLine[i])) {
                word += trimmedLine[i];
                i++;
            }
            lastWord = word;
            continue;
        }

        i++;
    }

    return null;
}

/**
 * Strip leading annotations from a line, returning the remainder.
 * e.g., "@Nullable Integer selectCount()" → "Integer selectCount()"
 *        "@Select("SELECT...")"           → "" (pure annotation)
 *        "@Nonnull @Param("id") Long id"  → not used for method extraction
 */
function stripLeadingAnnotations(line: string): string {
    let temp = line;
    while (temp.startsWith('@')) {
        // Remove @AnnotationName
        const annMatch = temp.match(/^@\w+/);
        if (!annMatch) {
            break;
        }
        temp = temp.substring(annMatch[0].length).trim();
        // Remove (args) if present
        if (temp.startsWith('(')) {
            let depth = 0;
            let j = 0;
            for (; j < temp.length; j++) {
                if (temp[j] === '(') {
                    depth++;
                } else if (temp[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        break;
                    }
                }
            }
            if (depth !== 0) {
                break; // Unclosed paren, bail out
            }
            temp = temp.substring(j + 1).trim();
        }
    }
    return temp;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
