/**
 * Cache entry structure for storing file contents.
 */
interface CacheEntry {
    /** The cached content (string or binary) */
    content: string | Uint8Array;
    /** Timestamp when the entry was created/updated */
    timestamp: number;
    /** Optional ETag for future validation */
    etag?: string;
}

/**
 * In-memory cache for bucket file operations.
 * Implements LRU (Least Recently Used) eviction when cache size limit is reached.
 */
export class Cache {
    private entries: Map<string, CacheEntry>;
    private maxSize: number;
    private ttl?: number;

    /**
     * Create a new cache instance.
     *
     * @param maxSize Maximum number of cached entries (default: 1000)
     * @param ttl Time-to-live in milliseconds (undefined = no expiration)
     */
    constructor(maxSize: number = 1000, ttl?: number) {
        this.entries = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    /**
     * Get cached content for a key.
     *
     * @param key Cache key
     * @returns Cached content or null if not found/expired
     */
    get(key: string): string | Uint8Array | null {
        const entry = this.entries.get(key);
        if (!entry) {
            return null;
        }

        // Check TTL expiration
        if (this.ttl && (Date.now() - entry.timestamp) > this.ttl) {
            this.entries.delete(key);
            return null;
        }

        return entry.content;
    }

    /**
     * Store content in cache.
     *
     * @param key Cache key
     * @param content Content to cache
     * @param etag Optional ETag for validation
     */
    set(key: string, content: string | Uint8Array, etag?: string): void {
        // Implement LRU eviction if at max size
        if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
            this.evictLRU();
        }

        this.entries.set(key, {
            content,
            timestamp: Date.now(),
            etag,
        });
    }

    /**
     * Delete a cache entry.
     *
     * @param key Cache key to delete
     */
    delete(key: string): void {
        this.entries.delete(key);
    }

    /**
     * Clear all cache entries.
     */
    clear(): void {
        this.entries.clear();
    }

    /**
     * Get current cache size.
     *
     * @returns Number of cached entries
     */
    get size(): number {
        return this.entries.size;
    }

    /**
     * Get maximum cache size.
     *
     * @returns Maximum number of entries
     */
    get maxCacheSize(): number {
        return this.maxSize;
    }

    /**
     * Evict the least recently used entry from cache.
     */
    private evictLRU(): void {
        // Find oldest entry and remove it
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.entries) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.entries.delete(oldestKey);
        }
    }
}

/**
 * Cache configuration options.
 */
export interface CacheOptions {
    /** Enable/disable caching (default: false) */
    enabled: boolean;
    /** Maximum number of cached entries per bucket (default: 1000) */
    maxSize?: number;
    /** Time-to-live in milliseconds (undefined = no expiration) */
    ttl?: number;
    /** Cache write operations (default: true) */
    includeWrites?: boolean;
    /** Cache read operations (default: true) */
    includeReads?: boolean;
}

// Global cache storage per bucket instance
const bucketCaches = new Map<string, Cache>();

/**
 * Get cache instance for a specific bucket.
 *
 * @param bucketName Bucket instance name
 * @returns Cache instance or null if not found
 */
export function getCache(bucketName?: string): Cache | null {
    const instanceName = bucketName || Array.from(bucketCaches.keys())[0];
    return bucketCaches.get(instanceName) || null;
}

/**
 * Set cache instance for a specific bucket.
 *
 * @param bucketName Bucket instance name
 * @param cache Cache instance to set
 */
export function setCache(bucketName: string, cache: Cache): void {
    bucketCaches.set(bucketName, cache);
}

/**
 * Remove cache instance for a specific bucket.
 *
 * @param bucketName Bucket instance name
 */
export function removeCache(bucketName: string): void {
    bucketCaches.delete(bucketName);
}

/**
 * Clear cache for a specific bucket or all buckets.
 *
 * @param bucketName Optional bucket instance name (if not provided, clears all)
 */
export function clearCache(bucketName?: string): void {
    if (bucketName) {
        const cache = bucketCaches.get(bucketName);
        if (cache) {
            cache.clear();
        }
    } else {
        bucketCaches.forEach((cache) => cache.clear());
    }
}

/**
 * Get cache statistics for a bucket.
 *
 * @param bucketName Optional bucket instance name
 * @returns Cache statistics or null if cache not found
 */
export function getCacheStats(bucketName?: string): { size: number; maxSize: number } | null {
    const cache = getCache(bucketName);
    if (!cache) return null;
    return {
        size: cache.size,
        maxSize: cache.maxCacheSize,
    };
}
