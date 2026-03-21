/**
 * SQL Composer - Composes complete SQL by resolving <include> references
 */

import { readFile } from '../utils/fileUtils';
import { removeXmlComments } from '../utils/xmlUtils';
import { escapeRegex } from '../utils/stringUtils';

/**
 * SQL Fragment definition
 */
interface SqlFragment {
    id: string;
    content: string;
}

/**
 * Extract all <sql id="xxx">...</sql> fragments from XML file
 */
function extractSqlFragments(content: string): Map<string, string> {
    const fragments = new Map<string, string>();
    const contentWithoutComments = removeXmlComments(content);

    // Match <sql id="xxx">...</sql> tags (non-greedy)
    const sqlFragmentRegex = /<sql\s+id\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/sql>/gi;
    let match;

    while ((match = sqlFragmentRegex.exec(contentWithoutComments)) !== null) {
        const id = match[1];
        const content = match[2].trim();
        fragments.set(id, content);
    }

    return fragments;
}

/**
 * Extract SQL content from a statement tag
 * @param content XML file content
 * @param statementId The statement id to extract
 * @returns The SQL content or null if not found
 */
function extractStatementContent(content: string, statementId: string): string | null {
    const contentWithoutComments = removeXmlComments(content);

    // Match statement tags (select, insert, update, delete) with the given id
    const statementRegex = new RegExp(
        `<(select|insert|update|delete)\\s+[^>]*id\\s*=\\s*["']${escapeRegex(statementId)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
        'i'
    );

    const match = contentWithoutComments.match(statementRegex);
    if (!match) {
        return null;
    }

    return match[2].trim();
}

/**
 * Resolve <include refid="xxx"> references recursively
 * @param sql The SQL content with potential <include> tags
 * @param fragments Map of sql fragment id to content
 * @param visited Set of visited fragment ids to detect circular references
 * @returns The resolved SQL content
 */
function resolveIncludes(sql: string, fragments: Map<string, string>, visited: Set<string> = new Set()): string {
    // Match <include refid="xxx"/> or <include refid="xxx"></include>
    const includeRegex = /<include\s+refid\s*=\s*["']([^"']+)["']\s*\/?>/gi;

    let resolved = sql;
    let match;
    let hasIncludes = false;

    // Reset lastIndex for global regex
    includeRegex.lastIndex = 0;

    while ((match = includeRegex.exec(sql)) !== null) {
        hasIncludes = true;
        const refId = match[1];
        const includeTag = match[0];

        // Check for circular reference
        if (visited.has(refId)) {
            resolved = resolved.replace(includeTag, `/* Circular reference detected: ${refId} */`);
            continue;
        }

        // Get the fragment content
        const fragmentContent = fragments.get(refId);
        if (fragmentContent) {
            // Mark as visited
            const newVisited = new Set(visited);
            newVisited.add(refId);

            // Recursively resolve includes in the fragment
            const resolvedFragment = resolveIncludes(fragmentContent, fragments, newVisited);

            // Replace the include tag with resolved fragment content
            resolved = resolved.replace(includeTag, resolvedFragment);
        } else {
            // Fragment not found
            resolved = resolved.replace(includeTag, `/* Fragment not found: ${refId} */`);
        }
    }

    // If we made replacements, check again for any newly exposed includes
    if (hasIncludes) {
        includeRegex.lastIndex = 0;
        if (includeRegex.test(resolved)) {
            // There are still includes, resolve them
            return resolveIncludes(resolved, fragments, visited);
        }
    }

    return resolved;
}

/**
 * Clean up MyBatis XML tags from SQL
 * Removes <if>, <where>, <trim>, <foreach>, <choose>, etc., but keeps their content
 */
function cleanupXmlTags(sql: string): string {
    let cleaned = sql;

    // Remove self-closing tags like <include refid="xxx"/>
    cleaned = cleaned.replace(/<\w+[^>]*\/>/g, '');

    // Remove opening and closing tags but keep content
    // Handle common MyBatis tags: if, where, trim, foreach, choose, when, otherwise, set, bind
    cleaned = cleaned.replace(/<\/?(?:if|where|trim|foreach|choose|when|otherwise|set|bind)[^>]*>/gi, '');

    return cleaned.trim();
}

/**
 * Compose complete SQL for a statement by resolving all <include> references
 * @param xmlFilePath Path to the XML mapper file
 * @param statementId The statement id
 * @returns The composed SQL or null if statement not found
 */
export async function composeSql(xmlFilePath: string, statementId: string): Promise<string | null> {
    try {
        const content = await readFile(xmlFilePath);

        // Extract all sql fragments
        const fragments = extractSqlFragments(content);

        // Extract the statement content
        const statementContent = extractStatementContent(content, statementId);
        if (!statementContent) {
            return null;
        }

        // Resolve all includes recursively
        const resolved = resolveIncludes(statementContent, fragments);

        // Clean up XML tags (optional, keep if you want to see MyBatis dynamic SQL structure)
        // Comment out the next line if you want to keep the dynamic SQL tags
        // const cleaned = cleanupXmlTags(resolved);

        return resolved;
    } catch (error) {
        console.error('[SqlComposer] Error composing SQL:', error);
        return null;
    }
}

/**
 * Check if a statement has any <include> references
 * @param xmlFilePath Path to the XML mapper file
 * @param statementId The statement id
 * @returns true if the statement has includes, false otherwise
 */
export async function hasIncludes(xmlFilePath: string, statementId: string): Promise<boolean> {
    try {
        const content = await readFile(xmlFilePath);
        const statementContent = extractStatementContent(content, statementId);
        if (!statementContent) {
            return false;
        }

        // Check if there are any <include> tags
        return /<include\s+refid\s*=\s*["'][^"']+["']\s*\/?>/.test(statementContent);
    } catch (error) {
        console.error('[SqlComposer] Error checking includes:', error);
        return false;
    }
}
