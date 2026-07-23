/**
 * Resolves Java class fields including fields inherited from superclasses,
 * by walking the `extends` chain across workspace source files.
 *
 * Shared by parameter validation and XML → Java field navigation so that
 * inherited fields behave the same everywhere (issue #50).
 */

import { JavaField } from '../types';
import { extractJavaFields, extractSuperclassName } from '../navigator/parsers/javaFieldParser';
import { resolveFullyQualifiedType } from './javaTypeResolver';
import { findJavaClassFile } from './navigationUtils';
import { isBuiltInType } from './javaTypeUtils';

/**
 * A field together with the class and file that declare it
 */
export interface ResolvedJavaField {
    field: JavaField;
    /** Absolute path of the Java file declaring the field */
    filePath: string;
    /** Fully-qualified name of the declaring class */
    className: string;
}

/**
 * Fields of a class hierarchy plus the chain of classes that contributed them
 */
export interface ClassHierarchyFields {
    /** Own and inherited fields; subclass fields shadow same-named superclass fields */
    fields: ResolvedJavaField[];
    /** Fully-qualified names of all resolved classes in the chain (subclass first) */
    classChain: string[];
}

// Guard against pathological or cyclic extends chains
const MAX_HIERARCHY_DEPTH = 10;

/**
 * Walk a class's `extends` chain, yielding each class that can be resolved
 * to a workspace source file (subclass first). Stops at classes outside the
 * workspace (JDK/library types), cycles, or MAX_HIERARCHY_DEPTH.
 */
async function* walkClassHierarchy(
    className: string
): AsyncGenerator<{ className: string; filePath: string }> {
    const visited = new Set<string>();
    let current: string | null = className;

    while (current && visited.size < MAX_HIERARCHY_DEPTH) {
        if (visited.has(current)) {
            break;
        }
        visited.add(current);

        const file = await findJavaClassFile(current);
        if (!file) {
            break;
        }

        yield { className: current, filePath: file.fsPath };

        current = await resolveSuperclass(file.fsPath, simpleNameOf(current));
    }
}

function simpleNameOf(className: string): string {
    return className.substring(className.lastIndexOf('.') + 1);
}

/**
 * Get all fields of a class including inherited ones.
 * Fields declared in a subclass shadow same-named superclass fields.
 *
 * @param className - Fully-qualified class name (e.g., "com.example.Role")
 * @returns Resolved fields and the class chain that contributed them
 */
export async function getClassFieldsWithInheritance(
    className: string
): Promise<ClassHierarchyFields> {
    const fields: ResolvedJavaField[] = [];
    const seenFieldNames = new Set<string>();
    const classChain: string[] = [];

    for await (const cls of walkClassHierarchy(className)) {
        classChain.push(cls.className);

        const ownFields = await extractJavaFields(cls.filePath);
        for (const field of ownFields) {
            if (!seenFieldNames.has(field.name)) {
                seenFieldNames.add(field.name);
                fields.push({ field, filePath: cls.filePath, className: cls.className });
            }
        }
    }

    return { fields, classChain };
}

/**
 * Find a field by name in a class or any of its superclasses.
 * Returns as soon as the field is found, without walking the rest of the chain.
 *
 * @param className - Fully-qualified class name (e.g., "com.example.Role")
 * @param fieldName - Field name to find
 * @returns The field with its declaring class/file, or null
 */
export async function findFieldInHierarchy(
    className: string,
    fieldName: string
): Promise<ResolvedJavaField | null> {
    for await (const cls of walkClassHierarchy(className)) {
        const ownFields = await extractJavaFields(cls.filePath);
        const field = ownFields.find(f => f.name === fieldName);
        if (field) {
            return { field, filePath: cls.filePath, className: cls.className };
        }
    }

    return null;
}

/**
 * Resolve the fully-qualified superclass name of a specific class declared in a file.
 * The class name anchors extraction so other types in the same compilation unit
 * cannot be mistaken for the class's superclass.
 */
async function resolveSuperclass(filePath: string, className: string): Promise<string | null> {
    try {
        const superclassName = await extractSuperclassName(filePath, className);
        if (!superclassName || isBuiltInType(superclassName)) {
            return null;
        }
        const fullyQualified = await resolveFullyQualifiedType(filePath, superclassName);
        if (!fullyQualified || isBuiltInType(fullyQualified)) {
            return null;
        }
        return fullyQualified;
    } catch (error) {
        console.warn(`[javaFieldHierarchy] Failed to resolve superclass of ${filePath}:`, error);
        return null;
    }
}
