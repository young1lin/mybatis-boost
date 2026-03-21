/**
 * Shared string utility functions
 */

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
