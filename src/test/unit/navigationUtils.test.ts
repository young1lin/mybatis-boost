import * as assert from 'assert';
import { mapCursorProportionally, matchXmlAttributeAtCursor, CursorMatchInfo } from '../../utils/navigationUtils';

describe('navigationUtils', () => {

    describe('mapCursorProportionally', () => {
        it('should return targetStartColumn when sourceLength is 0', () => {
            assert.strictEqual(mapCursorProportionally(0, 0, 10, 5), 10);
        });

        it('should return targetStartColumn when sourceLength is negative', () => {
            assert.strictEqual(mapCursorProportionally(0, -1, 10, 5), 10);
        });

        it('should map 0% offset to targetStartColumn', () => {
            assert.strictEqual(mapCursorProportionally(0, 10, 20, 10), 20);
        });

        it('should map 50% offset proportionally', () => {
            assert.strictEqual(mapCursorProportionally(5, 10, 20, 10), 25);
        });

        it('should map 100% offset to end of target', () => {
            assert.strictEqual(mapCursorProportionally(10, 10, 20, 10), 30);
        });

        it('should map to different target length', () => {
            // 50% of source (5/10) mapped to target length 20 starting at col 0
            assert.strictEqual(mapCursorProportionally(5, 10, 0, 20), 10);
        });

        it('should handle same source and target length', () => {
            assert.strictEqual(mapCursorProportionally(3, 8, 5, 8), 8);
        });

        it('should clamp to target end', () => {
            // cursorOffset > sourceLength should still be clamped
            assert.strictEqual(mapCursorProportionally(15, 10, 0, 10), 10);
        });
    });

    describe('matchXmlAttributeAtCursor', () => {
        it('should match refid attribute when cursor is on value', () => {
            const line = '    <include refid="baseColumns"/>';
            const result = matchXmlAttributeAtCursor(line, 25, /<include[^>]+refid\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'baseColumns');
            assert.strictEqual(result!.cursorOffset, result!.startColumn <= 25 ? 25 - result!.startColumn : 0);
        });

        it('should return null when cursor is outside value', () => {
            const line = '    <include refid="baseColumns"/>';
            const result = matchXmlAttributeAtCursor(line, 2, /<include[^>]+refid\s*=\s*["']([^"']+)["']/g);
            assert.strictEqual(result, null);
        });

        it('should match resultMap attribute', () => {
            const line = '    <select resultMap="UserResultMap">';
            const result = matchXmlAttributeAtCursor(line, 26, /resultMap\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'UserResultMap');
        });

        it('should match with single quotes', () => {
            const line = "    <include refid='baseColumns'/>";
            const result = matchXmlAttributeAtCursor(line, 25, /<include[^>]+refid\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'baseColumns');
        });

        it('should match correct occurrence with multiple matches', () => {
            const line = 'resultMap="First" resultMap="Second"';
            // Cursor on "Second" (at position 30)
            const result = matchXmlAttributeAtCursor(line, 30, /resultMap\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'Second');
        });

        it('should return null for empty line', () => {
            const result = matchXmlAttributeAtCursor('', 0, /resultMap\s*=\s*["']([^"']+)["']/g);
            assert.strictEqual(result, null);
        });

        it('should set correct startColumn and endColumn', () => {
            const line = '<sql id="myFragment">';
            const result = matchXmlAttributeAtCursor(line, 12, /<sql[^>]+id\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'myFragment');
            assert.strictEqual(result!.endColumn - result!.startColumn, 'myFragment'.length);
        });

        it('should set correct cursorOffset', () => {
            const line = '<sql id="myFragment">';
            const result = matchXmlAttributeAtCursor(line, 12, /<sql[^>]+id\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.cursorOffset, 12 - result!.startColumn);
        });

        it('should match cursor at start of value', () => {
            const line = '<sql id="myFragment">';
            const result = matchXmlAttributeAtCursor(line, 9, /<sql[^>]+id\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.cursorOffset, 0);
        });

        it('should match cursor at end of value', () => {
            const line = '<sql id="myFragment">';
            const result = matchXmlAttributeAtCursor(line, 19, /<sql[^>]+id\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.cursorOffset, 'myFragment'.length);
        });

        it('should match property attribute', () => {
            const line = '    <result property="userName" />';
            const result = matchXmlAttributeAtCursor(line, 25, /property\s*=\s*["']([^"']+)["']/g);
            assert.ok(result);
            assert.strictEqual(result!.value, 'userName');
        });
    });

});
