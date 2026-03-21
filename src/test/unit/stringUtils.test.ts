/**
 * Unit tests for stringUtils - regex escaping
 */

import * as assert from 'assert';
import { escapeRegex } from '../../utils/stringUtils';

describe('stringUtils Unit Tests', () => {
    describe('escapeRegex', () => {
        it('should escape all special regex characters', () => {
            // Each special char: . * + ? ^ $ { } ( ) | [ ] \
            assert.strictEqual(escapeRegex('.'), '\\.');
            assert.strictEqual(escapeRegex('*'), '\\*');
            assert.strictEqual(escapeRegex('+'), '\\+');
            assert.strictEqual(escapeRegex('?'), '\\?');
            assert.strictEqual(escapeRegex('^'), '\\^');
            assert.strictEqual(escapeRegex('$'), '\\$');
            assert.strictEqual(escapeRegex('{'), '\\{');
            assert.strictEqual(escapeRegex('}'), '\\}');
            assert.strictEqual(escapeRegex('('), '\\(');
            assert.strictEqual(escapeRegex(')'), '\\)');
            assert.strictEqual(escapeRegex('|'), '\\|');
            assert.strictEqual(escapeRegex('['), '\\[');
            assert.strictEqual(escapeRegex(']'), '\\]');
            assert.strictEqual(escapeRegex('\\'), '\\\\');
        });

        it('should return empty string for empty input', () => {
            assert.strictEqual(escapeRegex(''), '');
        });

        it('should return plain string unchanged', () => {
            assert.strictEqual(escapeRegex('hello'), 'hello');
            assert.strictEqual(escapeRegex('UserMapper'), 'UserMapper');
        });

        it('should escape dots in qualified class names', () => {
            assert.strictEqual(escapeRegex('com.example.UserMapper'), 'com\\.example\\.UserMapper');
        });

        it('should escape backslash', () => {
            assert.strictEqual(escapeRegex('a\\b'), 'a\\\\b');
        });

        it('should produce a usable regex pattern', () => {
            const input = 'com.example.UserMapper';
            const escaped = escapeRegex(input);
            const regex = new RegExp(escaped);
            assert.ok(regex.test(input));
            assert.ok(!regex.test('comXexampleXUserMapper'));
        });
    });
});
