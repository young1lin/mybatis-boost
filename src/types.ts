/**
 * Type definitions for MyBatis Boost extension
 */

/**
 * Metadata for a Java-XML mapping pair
 */
export interface MappingMetadata {
    /** Absolute path to XML file */
    xmlPath: string;
    /** Absolute path to Java file */
    javaPath: string;
    /** Java file modification time (milliseconds) */
    javaModTime: number;
    /** XML file modification time (milliseconds) */
    xmlModTime: number;
    /** Cached namespace value */
    namespace?: string;
}

/**
 * Represents a Java method in a mapper interface
 */
export interface JavaMethod {
    /** Method name */
    name: string;
    /** Line number (0-indexed) */
    line: number;
    /** Column number where method name starts (0-indexed) */
    startColumn: number;
    /** Column number where method name ends (0-indexed, exclusive) */
    endColumn: number;
    /** Full method signature */
    signature?: string;
}

/**
 * Represents an XML SQL statement
 */
export interface XmlStatement {
    /** Statement ID (matches Java method name) */
    id: string;
    /** Line number (0-indexed) */
    line: number;
    /** Column number where id attribute value starts (0-indexed) */
    startColumn: number;
    /** Column number where id attribute value ends (0-indexed, exclusive) */
    endColumn: number;
    /** Statement type: select, insert, update, delete */
    type: 'select' | 'insert' | 'update' | 'delete';
    /** Result type attribute value */
    resultType?: string;
}

/**
 * Configuration options for the extension
 */
export interface ExtensionConfig {
    /** Maximum number of entries in LRU cache */
    cacheSize: number;
    /** Custom directories to search for XML files */
    customXmlDirectories: string[];
    /** Number of lines to read from Java files for namespace extraction */
    javaParseLines: number;
    /** Timeout for file scanning operations (ms) */
    scanTimeoutMs: number;
}
