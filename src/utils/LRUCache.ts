/**
 * Generic LRU (Least Recently Used) Cache implementation
 * Used by FileMapper for mapping metadata and ParameterValidator for field caching
 */
export class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private maxSize: number;
    private onEvict?: (key: K, value: V) => void;

    /**
     * @param maxSize - Maximum number of entries to keep
     * @param onEvict - Called when an entry is silently evicted because the
     *                  cache is full. Not called for explicit delete()/clear(),
     *                  which the owner already knows about.
     */
    constructor(maxSize: number, onEvict?: (key: K, value: V) => void) {
        this.maxSize = maxSize;
        this.onEvict = onEvict;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        // Remove if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value as K;
            if (firstKey !== undefined) {
                const evictedValue = this.cache.get(firstKey);
                this.cache.delete(firstKey);
                if (this.onEvict && evictedValue !== undefined) {
                    this.onEvict(firstKey, evictedValue);
                }
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}
