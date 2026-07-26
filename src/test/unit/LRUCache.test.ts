/**
 * Unit tests for LRUCache, including the eviction callback used by
 * ParameterValidator to keep dependency bookkeeping in sync with the cache.
 */

import * as assert from 'assert';
import { LRUCache } from '../../utils/LRUCache';

describe('LRUCache Unit Tests', () => {
    it('should evict the least recently used entry when full', () => {
        const cache = new LRUCache<string, number>(2);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);

        assert.strictEqual(cache.has('a'), false);
        assert.strictEqual(cache.get('b'), 2);
        assert.strictEqual(cache.get('c'), 3);
        assert.strictEqual(cache.size(), 2);
    });

    it('should refresh recency on get', () => {
        const cache = new LRUCache<string, number>(2);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.get('a');
        cache.set('c', 3);

        assert.strictEqual(cache.has('a'), true, 'recently read entry should survive');
        assert.strictEqual(cache.has('b'), false, 'stale entry should be evicted');
    });

    describe('onEvict callback', () => {
        it('should fire with the evicted key and value on capacity eviction', () => {
            const evicted: Array<{ key: string; value: number }> = [];
            const cache = new LRUCache<string, number>(2, (key, value) => evicted.push({ key, value }));

            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);

            assert.deepStrictEqual(evicted, [{ key: 'a', value: 1 }]);
        });

        it('should not fire when updating an existing key', () => {
            const evicted: string[] = [];
            const cache = new LRUCache<string, number>(2, key => evicted.push(key));

            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('a', 10);

            assert.deepStrictEqual(evicted, []);
            assert.strictEqual(cache.get('a'), 10);
        });

        it('should not fire on explicit delete or clear', () => {
            const evicted: string[] = [];
            const cache = new LRUCache<string, number>(2, key => evicted.push(key));

            cache.set('a', 1);
            cache.set('b', 2);
            cache.delete('a');
            cache.clear();

            assert.deepStrictEqual(evicted, []);
        });
    });
});
