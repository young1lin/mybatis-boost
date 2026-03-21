/**
 * Shared Java type utility functions
 */

const PRIMITIVE_TYPES = ['int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char'];

const JAVA_LANG_SHORT_NAMES = [
    'String', 'Integer', 'Long', 'Double', 'Float',
    'Boolean', 'Byte', 'Short', 'Character', 'Object'
];

const JAVA_LANG_FULLY_QUALIFIED = [
    'java.lang.String', 'java.lang.Integer', 'java.lang.Long',
    'java.lang.Double', 'java.lang.Float', 'java.lang.Boolean',
    'java.lang.Byte', 'java.lang.Short', 'java.lang.Character',
    'java.lang.Object'
];

const COLLECTION_SHORT_NAMES = [
    'List', 'Set', 'Map', 'Collection',
    'ArrayList', 'LinkedList', 'HashSet', 'HashMap',
    'LinkedHashMap', 'TreeMap', 'TreeSet',
    'Vector', 'Stack', 'Queue', 'Deque'
];

const COLLECTION_FULLY_QUALIFIED = [
    'java.util.List', 'java.util.Set', 'java.util.Map', 'java.util.Collection',
    'java.util.ArrayList', 'java.util.LinkedList', 'java.util.HashSet',
    'java.util.HashMap', 'java.util.LinkedHashMap', 'java.util.TreeMap',
    'java.util.TreeSet', 'java.util.Vector', 'java.util.Stack',
    'java.util.Queue', 'java.util.Deque'
];

/**
 * Check if a class name is a built-in type (primitives + short names + java.lang.*)
 * Used by ParameterValidator, XmlParameterDefinitionProvider for skip-validation logic
 */
export function isBuiltInType(className: string): boolean {
    return PRIMITIVE_TYPES.includes(className)
        || JAVA_LANG_SHORT_NAMES.includes(className)
        || JAVA_LANG_FULLY_QUALIFIED.includes(className);
}

/**
 * Check if a class name is a built-in type for navigation purposes.
 * Only matches primitives and fully-qualified java.lang.* names.
 * Used by JavaClassDefinitionProvider, XmlResultMapPropertyDefinitionProvider
 * where short names like "String" could be user-defined classes.
 */
export function isBuiltInTypeForNavigation(className: string): boolean {
    return PRIMITIVE_TYPES.includes(className)
        || JAVA_LANG_FULLY_QUALIFIED.includes(className);
}

/**
 * Check if a class name is a collection type
 */
export function isCollectionType(className: string): boolean {
    return COLLECTION_SHORT_NAMES.includes(className)
        || COLLECTION_FULLY_QUALIFIED.includes(className);
}
