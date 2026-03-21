/**
 * Unit tests for javaTypeUtils - Java type classification functions
 */

import * as assert from 'assert';
import { isBuiltInType, isBuiltInTypeForNavigation, isCollectionType } from '../../utils/javaTypeUtils';

describe('javaTypeUtils Unit Tests', () => {
    describe('isBuiltInType', () => {
        it('should return true for primitive types', () => {
            for (const t of ['int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char']) {
                assert.strictEqual(isBuiltInType(t), true, `Expected ${t} to be built-in`);
            }
        });

        it('should return true for java.lang short names', () => {
            for (const t of ['String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Byte', 'Short', 'Character', 'Object']) {
                assert.strictEqual(isBuiltInType(t), true, `Expected ${t} to be built-in`);
            }
        });

        it('should return true for fully-qualified java.lang names', () => {
            for (const t of ['java.lang.String', 'java.lang.Integer', 'java.lang.Object']) {
                assert.strictEqual(isBuiltInType(t), true, `Expected ${t} to be built-in`);
            }
        });

        it('should return false for custom classes', () => {
            assert.strictEqual(isBuiltInType('UserMapper'), false);
            assert.strictEqual(isBuiltInType('com.example.User'), false);
        });

        it('should return false for empty string', () => {
            assert.strictEqual(isBuiltInType(''), false);
        });

        it('should be case-sensitive', () => {
            assert.strictEqual(isBuiltInType('INT'), false);
            assert.strictEqual(isBuiltInType('string'), false);
            assert.strictEqual(isBuiltInType('BOOLEAN'), false);
        });
    });

    describe('isBuiltInTypeForNavigation', () => {
        it('should return true for primitive types', () => {
            assert.strictEqual(isBuiltInTypeForNavigation('int'), true);
            assert.strictEqual(isBuiltInTypeForNavigation('boolean'), true);
            assert.strictEqual(isBuiltInTypeForNavigation('char'), true);
        });

        it('should return true for fully-qualified java.lang names', () => {
            assert.strictEqual(isBuiltInTypeForNavigation('java.lang.String'), true);
            assert.strictEqual(isBuiltInTypeForNavigation('java.lang.Integer'), true);
        });

        it('should return false for java.lang short names (key difference from isBuiltInType)', () => {
            assert.strictEqual(isBuiltInTypeForNavigation('String'), false);
            assert.strictEqual(isBuiltInTypeForNavigation('Integer'), false);
            assert.strictEqual(isBuiltInTypeForNavigation('Object'), false);
        });

        it('should return false for custom classes', () => {
            assert.strictEqual(isBuiltInTypeForNavigation('User'), false);
            assert.strictEqual(isBuiltInTypeForNavigation('com.example.Role'), false);
        });

        it('should return false for empty string', () => {
            assert.strictEqual(isBuiltInTypeForNavigation(''), false);
        });
    });

    describe('isCollectionType', () => {
        it('should return true for collection short names', () => {
            for (const t of ['List', 'Set', 'Map', 'Collection', 'ArrayList', 'LinkedList', 'HashSet', 'HashMap', 'LinkedHashMap', 'TreeMap', 'TreeSet', 'Vector', 'Stack', 'Queue', 'Deque']) {
                assert.strictEqual(isCollectionType(t), true, `Expected ${t} to be a collection`);
            }
        });

        it('should return true for fully-qualified collection names', () => {
            for (const t of ['java.util.List', 'java.util.Map', 'java.util.ArrayList', 'java.util.HashMap']) {
                assert.strictEqual(isCollectionType(t), true, `Expected ${t} to be a collection`);
            }
        });

        it('should return false for non-collection types', () => {
            assert.strictEqual(isCollectionType('String'), false);
            assert.strictEqual(isCollectionType('int'), false);
            assert.strictEqual(isCollectionType('com.example.User'), false);
        });

        it('should return false for empty string', () => {
            assert.strictEqual(isCollectionType(''), false);
        });

        it('should be case-sensitive', () => {
            assert.strictEqual(isCollectionType('list'), false);
            assert.strictEqual(isCollectionType('MAP'), false);
        });
    });
});
