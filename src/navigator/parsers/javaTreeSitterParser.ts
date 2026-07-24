/**
 * Tree-sitter based Java parser for accurate AST-based extraction.
 * Falls back to regex parsing when WASM initialization fails.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Parser, Language, Node as TSNode } from 'web-tree-sitter';
import { JavaMethod, MethodParameter, JavaField } from '../../types';

let parser: Parser | null = null;
let javaLanguage: Language | null = null;
let initPromise: Promise<boolean> | null = null;

/**
 * Lazily initialize the tree-sitter parser with Java WASM grammar.
 * Returns true if initialization succeeded, false otherwise.
 * Safe to call multiple times — only initializes once.
 */
export async function initTreeSitter(): Promise<boolean> {
    if (parser && javaLanguage) {
        return true;
    }
    if (initPromise) {
        return initPromise;
    }
    initPromise = doInit();
    const result = await initPromise;
    // Allow retry on failure
    if (!result) {
        initPromise = null;
    }
    return result;
}

/**
 * Resolve WASM file path. Works in both:
 * - Production: esbuild bundle, __dirname = dist/, WASM in dist/wasm/
 * - Development/tests: ts-node, __dirname = src/navigator/parsers/, WASM in node_modules/
 */
function resolveWasmPath(filename: string): string {
    // Production path: dist/wasm/
    const prodPath = path.join(__dirname, 'wasm', filename);
    if (fs.existsSync(prodPath)) {
        return prodPath;
    }

    // Dev/test path: find project root and look in node_modules
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
        const nodeModulesPath = filename === 'tree-sitter-java.wasm'
            ? path.join(dir, 'node_modules', 'tree-sitter-java', filename)
            : path.join(dir, 'node_modules', 'web-tree-sitter', filename);
        if (fs.existsSync(nodeModulesPath)) {
            return nodeModulesPath;
        }
        dir = path.dirname(dir);
    }

    // Fallback to production path (will fail gracefully)
    return prodPath;
}

async function doInit(): Promise<boolean> {
    try {
        const treeSitterWasm = resolveWasmPath('web-tree-sitter.wasm');
        const javaWasm = resolveWasmPath('tree-sitter-java.wasm');

        await Parser.init({
            locateFile: () => treeSitterWasm
        });
        javaLanguage = await Language.load(javaWasm);
        parser = new Parser();
        parser.setLanguage(javaLanguage);
        return true;
    } catch (e) {
        console.error('[javaTreeSitterParser] Failed to initialize tree-sitter:', e);
        parser = null;
        javaLanguage = null;
        return false;
    }
}

function ensureParser(): Parser {
    if (!parser) {
        throw new Error('Tree-sitter parser not initialized');
    }
    return parser;
}

function parseContent(content: string): TSNode {
    const p = ensureParser();
    const tree = p.parse(content);
    if (!tree) {
        throw new Error('Tree-sitter parse returned null');
    }
    return tree.rootNode;
}

const TYPE_DECLARATION_NODE_TYPES = new Set([
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'record_declaration',
    'annotation_type_declaration'
]);

/**
 * Match a source-file type by simple name without accepting a same-named
 * nested or local type. Hierarchy resolution starts from a Java source file
 * selected by fully-qualified top-level class name, so nested declarations
 * represent different binary types and must not contribute fields or parents.
 */
function isRequestedTopLevelType(node: TSNode, className: string): boolean {
    const nameNode = node.childForFieldName('name');
    if (!nameNode || nameNode.text !== className) {
        return false;
    }

    let ancestor = node.parent;
    while (ancestor) {
        if (TYPE_DECLARATION_NODE_TYPES.has(ancestor.type)) {
            return false;
        }
        ancestor = ancestor.parent;
    }

    return true;
}

/**
 * Extract all methods from a Java mapper interface using AST.
 */
export async function extractMethodsFromAST(content: string): Promise<JavaMethod[]> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);
    const methods: JavaMethod[] = [];

    // Find interface declarations
    const interfaces = root.descendantsOfType('interface_declaration');
    for (const iface of interfaces) {
        const body = iface.childForFieldName('body');
        if (!body) {
            continue;
        }

        // Method declarations in interfaces
        const methodDecls = body.descendantsOfType('method_declaration');
        for (const m of methodDecls) {
            const nameNode = m.childForFieldName('name');
            if (!nameNode) {
                continue;
            }

            const name = nameNode.text;
            const line = nameNode.startPosition.row;
            const startColumn = nameNode.startPosition.column;
            const endColumn = startColumn + name.length;

            methods.push({
                name,
                line,
                startColumn,
                endColumn,
                signature: m.text.replace(/\n/g, ' ').trim()
            });
        }
    }

    return methods;
}

/**
 * Extract parameters for a specific method using AST.
 */
export async function extractParametersFromAST(
    content: string,
    methodName: string
): Promise<MethodParameter[]> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);
    const parameters: MethodParameter[] = [];
    const lines = content.split('\n');

    // Find the target method
    const interfaces = root.descendantsOfType('interface_declaration');
    for (const iface of interfaces) {
        const body = iface.childForFieldName('body');
        if (!body) {
            continue;
        }

        const methodDecls = body.descendantsOfType('method_declaration');
        for (const m of methodDecls) {
            const nameNode = m.childForFieldName('name');
            if (!nameNode || nameNode.text !== methodName) {
                continue;
            }

            const params = m.childForFieldName('parameters');
            if (!params) {
                return parameters;
            }

            const formalParams = [
                ...params.descendantsOfType('formal_parameter'),
                ...params.descendantsOfType('spread_parameter'),
            ];
            for (const fp of formalParams) {
                let paramNameNode = fp.childForFieldName('name');
                let paramTypeNode = fp.childForFieldName('type');

                // spread_parameter (varargs) uses variable_declarator for name
                // and has type as a direct child, not via field name
                if (!paramNameNode && fp.type === 'spread_parameter') {
                    const varDecl = fp.descendantsOfType('variable_declarator');
                    if (varDecl.length > 0) {
                        paramNameNode = varDecl[0].childForFieldName('name');
                    }
                    const typeNodes = fp.descendantsOfType('type_identifier');
                    if (typeNodes.length > 0) {
                        paramTypeNode = typeNodes[0];
                    }
                }

                if (!paramNameNode || !paramTypeNode) {
                    continue;
                }

                const paramName = paramNameNode.text;
                // Extract root type (e.g., "List" from "List<String>")
                let paramType = paramTypeNode.text;
                const genericIdx = paramType.indexOf('<');
                if (genericIdx >= 0) {
                    paramType = paramType.substring(0, genericIdx);
                }

                // Check for @Param annotation
                let hasParamAnnotation = false;
                let annotationValue: string | null = null;
                let annotationLine = -1;
                let annotationStartCol = -1;
                let annotationEndCol = -1;

                // Look at modifiers (annotations are part of modifiers in tree-sitter-java)
                const modifiers = fp.descendantsOfType('annotation');
                for (const ann of modifiers) {
                    const annNameNode = ann.childForFieldName('name');
                    if (!annNameNode) {
                        continue;
                    }
                    if (annNameNode.text === 'Param') {
                        hasParamAnnotation = true;
                        // Extract annotation value from arguments
                        const annArgs = ann.childForFieldName('arguments');
                        if (annArgs) {
                            // Find the string_literal inside annotation arguments
                            const stringLiterals = annArgs.descendantsOfType('string_literal');
                            if (stringLiterals.length > 0) {
                                const rawValue = stringLiterals[0].text;
                                // Remove quotes
                                annotationValue = rawValue.replace(/^["']|["']$/g, '');
                                // Find position of the annotation value (the text inside quotes) in the source
                                const annLine = stringLiterals[0].startPosition.row;
                                const lineText = lines[annLine];
                                const quotePos = lineText.indexOf(annotationValue, stringLiterals[0].startPosition.column);
                                if (quotePos >= 0) {
                                    annotationLine = annLine;
                                    annotationStartCol = quotePos;
                                    annotationEndCol = quotePos + annotationValue.length;
                                }
                            }
                        }
                        break;
                    }
                }

                const effectiveParamName = annotationValue || paramName;

                let paramLine: number;
                let paramStartColumn: number;
                let paramEndColumn: number;

                if (hasParamAnnotation && annotationValue && annotationLine >= 0) {
                    paramLine = annotationLine;
                    paramStartColumn = annotationStartCol;
                    paramEndColumn = annotationEndCol;
                } else {
                    paramLine = paramNameNode.startPosition.row;
                    paramStartColumn = paramNameNode.startPosition.column;
                    paramEndColumn = paramStartColumn + paramName.length;
                }

                parameters.push({
                    name: effectiveParamName,
                    paramType,
                    line: paramLine,
                    startColumn: paramStartColumn,
                    endColumn: paramEndColumn,
                    hasParamAnnotation
                });
            }

            return parameters;
        }
    }

    return parameters;
}

/**
 * Extract all fields from a Java class using AST.
 *
 * @param content - Java source content
 * @param className - When given, only the matching top-level class/interface
 *                    declaration's own fields are returned (direct members,
 *                    excluding nested types), so other types in the same
 *                    compilation unit cannot leak into the result. When omitted,
 *                    fields of all types in the file are merged (legacy behavior).
 */
export async function extractFieldsFromAST(
    content: string,
    className?: string
): Promise<JavaField[]> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);
    const fields: JavaField[] = [];

    // Find class declarations (and also check interface body for constant fields)
    const classDecls = root.descendantsOfType(['class_declaration', 'interface_declaration']);
    for (const cls of classDecls) {
        if (className && !isRequestedTopLevelType(cls, className)) {
            continue;
        }

        const body = cls.childForFieldName('body');
        if (!body) {
            continue;
        }

        // Scoped extraction takes only the class's direct members so nested
        // types' fields are not attributed to the class itself
        const fieldDecls = className
            ? body.namedChildren.filter((c): c is TSNode => c !== null && c.type === 'field_declaration')
            : body.descendantsOfType('field_declaration');
        for (const fd of fieldDecls) {
            const declarator = fd.descendantsOfType('variable_declarator')[0];
            if (!declarator) {
                continue;
            }

            const nameNode = declarator.childForFieldName('name');
            const typeNode = fd.childForFieldName('type');
            if (!nameNode || !typeNode) {
                continue;
            }

            const fieldName = nameNode.text;
            let fieldType = typeNode.text;
            const genericIdx = fieldType.indexOf('<');
            if (genericIdx >= 0) {
                fieldType = fieldType.substring(0, genericIdx);
            }

            const line = nameNode.startPosition.row;
            const startColumn = nameNode.startPosition.column;
            const endColumn = startColumn + fieldName.length;

            fields.push({
                name: fieldName,
                fieldType,
                line,
                startColumn,
                endColumn
            });
        }
    }

    return fields;
}

/**
 * Extract the superclass name from a class declaration's `extends` clause
 * using AST. Generic type arguments are stripped
 * (e.g., `extends BaseEntity<Long>` → "BaseEntity").
 *
 * @param content - Java source content
 * @param className - When given, only that top-level class declaration is
 *                    inspected, so other types in the same compilation unit
 *                    cannot be mistaken for the class's superclass. When omitted,
 *                    the first class declaration with an `extends` clause is used.
 * @returns Superclass name as written in source (simple or fully-qualified), or null
 */
export async function extractSuperclassNameFromAST(
    content: string,
    className?: string
): Promise<string | null> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);

    const classDecls = root.descendantsOfType('class_declaration');
    for (const cls of classDecls) {
        if (className && !isRequestedTopLevelType(cls, className)) {
            continue;
        }

        const superclassNode = cls.childForFieldName('superclass');
        if (!superclassNode) {
            if (className) {
                // The requested class extends nothing
                return null;
            }
            continue;
        }

        // The superclass node text is "extends TypeName[<...>]"
        let name = superclassNode.text.replace(/^extends\s+/, '').trim();
        const genericIdx = name.indexOf('<');
        if (genericIdx >= 0) {
            name = name.substring(0, genericIdx).trim();
        }

        if (name) {
            return name;
        }
    }

    return null;
}

/**
 * Extract namespace (package.InterfaceName) from Java content using AST.
 */
export async function extractNamespaceFromAST(content: string): Promise<string | null> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);

    // Extract package
    const packageDecls = root.descendantsOfType('package_declaration');
    if (packageDecls.length === 0) {
        return null;
    }
    // Package name is in a scoped_identifier or identifier child
    const packageNode = packageDecls[0];
    let packageName = '';
    for (const child of packageNode.children) {
        if (child.type === 'scoped_identifier' || child.type === 'identifier') {
            packageName = child.text;
            break;
        }
    }
    if (!packageName) {
        return null;
    }

    // Extract interface name
    const interfaces = root.descendantsOfType('interface_declaration');
    if (interfaces.length === 0) {
        return null;
    }
    const interfaceNameNode = interfaces[0].childForFieldName('name');
    if (!interfaceNameNode) {
        return null;
    }

    return `${packageName}.${interfaceNameNode.text}`;
}

/**
 * Check if content is a MyBatis mapper interface using AST.
 */
export async function isMyBatisMapperFromAST(content: string): Promise<boolean> {
    if (!await initTreeSitter()) {
        throw new Error('Tree-sitter not available');
    }
    const root = parseContent(content);

    // Must have an interface declaration
    const interfaces = root.descendantsOfType('interface_declaration');
    if (interfaces.length === 0) {
        return false;
    }

    // Check for MyBatis imports
    const imports = root.descendantsOfType('import_declaration');
    for (const imp of imports) {
        const text = imp.text;
        if (/org\.(apache\.ibatis|mybatis)\./.test(text)) {
            return true;
        }
    }

    // Check for MyBatis annotations
    const annotations = root.descendantsOfType('annotation');
    for (const ann of annotations) {
        const annNameNode = ann.childForFieldName('name');
        if (!annNameNode) {
            continue;
        }
        const name = annNameNode.text;
        if (/^(Mapper|Select|Insert|Update|Delete)$/.test(name)) {
            return true;
        }
    }

    return false;
}
