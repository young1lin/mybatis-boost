/**
 * Shared XML utility functions
 */

/**
 * Remove XML comments from content using regex replacement.
 * Preserves line numbers by replacing comment content with newlines.
 * Suitable for most use cases where line-number preservation is needed.
 */
export function removeXmlComments(content: string): string {
    if (!content) {
        return '';
    }
    return content.replace(/<!--[\s\S]*?-->/g, (match) => {
        const newlineCount = (match.match(/\n/g) || []).length;
        return '\n'.repeat(newlineCount);
    });
}

/**
 * Remove XML comments using character-by-character parsing.
 * Handles edge cases where comment-like syntax (-->) appears inside comments
 * by finding the last --> within the comment's scope (before the next <!--).
 * Use this for strict comment removal in parameter extraction.
 */
export function removeXmlCommentsStrict(content: string): string {
    let result = '';
    let i = 0;

    while (i < content.length) {
        // Look for comment start: <!--
        if (i < content.length - 4 && content.substring(i, i + 4) === '<!--') {
            // Found comment start, find the matching end: -->
            let j = i + 4;
            let lastEnd = -1;
            let nextCommentStart = -1;

            // First, find the next <!-- to limit our search scope
            for (let k = i + 4; k < content.length - 4; k++) {
                if (content.substring(k, k + 4) === '<!--') {
                    nextCommentStart = k;
                    break;
                }
            }

            // Find the last --> before the next <!-- (or end of content)
            const searchEnd = nextCommentStart !== -1 ? nextCommentStart : content.length - 2;
            while (j <= searchEnd) {
                if (j < content.length - 2 && content.substring(j, j + 3) === '-->') {
                    lastEnd = j + 3;
                }
                j++;
            }

            if (lastEnd !== -1) {
                // Skip the entire comment (from <!-- to last -->)
                i = lastEnd;
                continue;
            } else {
                // Comment start found but no end, treat as regular text
                result += content[i];
                i++;
            }
        } else {
            result += content[i];
            i++;
        }
    }

    return result;
}
