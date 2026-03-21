/**
 * Unit tests for xmlUtils - XML comment removal functions
 */

import * as assert from 'assert';
import { removeXmlComments, removeXmlCommentsStrict } from '../../utils/xmlUtils';

describe('xmlUtils Unit Tests', () => {
    describe('removeXmlComments', () => {
        it('should return empty string for empty input', () => {
            assert.strictEqual(removeXmlComments(''), '');
        });

        it('should return empty string for null/undefined input', () => {
            assert.strictEqual(removeXmlComments(null as unknown as string), '');
            assert.strictEqual(removeXmlComments(undefined as unknown as string), '');
        });

        it('should return content unchanged when no comments present', () => {
            const content = '<mapper namespace="com.example.UserMapper">\n  <select id="findAll">SELECT * FROM users</select>\n</mapper>';
            assert.strictEqual(removeXmlComments(content), content);
        });

        it('should remove single-line comment', () => {
            const content = '<root><!-- comment --><child/></root>';
            assert.strictEqual(removeXmlComments(content), '<root><child/></root>');
        });

        it('should remove multi-line comment preserving line count', () => {
            const content = '<root>\n<!-- line1\nline2\nline3 -->\n<child/></root>';
            const result = removeXmlComments(content);
            assert.strictEqual(result, '<root>\n\n\n\n<child/></root>');
        });

        it('should remove multiple comments', () => {
            const content = '<!-- first --><a/><!-- second --><b/>';
            assert.strictEqual(removeXmlComments(content), '<a/><b/>');
        });

        it('should handle empty comment <!---->', () => {
            const content = '<a><!----><b/></a>';
            assert.strictEqual(removeXmlComments(content), '<a><b/></a>');
        });

        it('should preserve line numbers by replacing comment with newlines', () => {
            const lines = [
                '<root>',           // line 1
                '<!-- comment',     // line 2
                'spanning',         // line 3
                'lines -->',        // line 4
                '<after/>'          // line 5
            ];
            const content = lines.join('\n');
            const result = removeXmlComments(content);
            const resultLines = result.split('\n');
            // <after/> should still be on line 5 (index 4)
            assert.strictEqual(resultLines[4], '<after/>');
            assert.strictEqual(resultLines.length, 5);
        });

        it('should preserve content between comments', () => {
            const content = '<!-- c1 -->KEEP<!-- c2 -->';
            assert.strictEqual(removeXmlComments(content), 'KEEP');
        });

        it('should handle comment at start of content', () => {
            const content = '<!-- start -->rest';
            assert.strictEqual(removeXmlComments(content), 'rest');
        });

        it('should handle comment at end of content', () => {
            const content = 'rest<!-- end -->';
            assert.strictEqual(removeXmlComments(content), 'rest');
        });
    });

    describe('removeXmlCommentsStrict', () => {
        it('should remove a basic comment', () => {
            const content = '<root><!-- comment --><child/></root>';
            assert.strictEqual(removeXmlCommentsStrict(content), '<root><child/></root>');
        });

        it('should remove multi-line comment', () => {
            const content = '<root><!-- multi\nline\ncomment --><child/></root>';
            assert.strictEqual(removeXmlCommentsStrict(content), '<root><child/></root>');
        });

        it('should remove multiple consecutive comments', () => {
            const content = '<!-- first --><!-- second --><a/>';
            assert.strictEqual(removeXmlCommentsStrict(content), '<a/>');
        });

        it('should preserve content between comments', () => {
            const content = '<!-- c1 -->MIDDLE<!-- c2 -->';
            assert.strictEqual(removeXmlCommentsStrict(content), 'MIDDLE');
        });

        it('should consume nested --> by finding last --> before next <!--', () => {
            // <!-- a --> b --> has no next <!--, so searches entire rest
            // Finds --> at index 7 (lastEnd=10), then --> at index 13 (lastEnd=16)
            // Uses last one, consuming entire string
            const content = '<!-- a --> b -->';
            assert.strictEqual(removeXmlCommentsStrict(content), '');
        });

        it('should treat unclosed comment as regular text', () => {
            // <!-- at index 0, no --> found, so lastEnd=-1
            // Treats '<' as regular text, advances char by char
            const content = '<!-- no end here';
            assert.strictEqual(removeXmlCommentsStrict(content), content);
        });

        it('should handle empty comment <!---->',  () => {
            const content = '<a><!----><b/></a>';
            assert.strictEqual(removeXmlCommentsStrict(content), '<a><b/></a>');
        });

        it('should return empty string for empty input', () => {
            assert.strictEqual(removeXmlCommentsStrict(''), '');
        });

        it('should return content unchanged when no comments present', () => {
            const content = '<mapper namespace="test"><select id="find">SELECT 1</select></mapper>';
            assert.strictEqual(removeXmlCommentsStrict(content), content);
        });
    });
});
