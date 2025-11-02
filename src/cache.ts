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
    /** Size of the content in bytes */
    sizeBytes: number;
}

/**
 * In-memory cache for bucket file operations.
 * Implements LRU (Least Recently Used) eviction when cache size or memory limit is reached.
 */
export class Cache {
    private entries: Map<string, CacheEntry>;
    private maxSize?: number;
    private maxMemorySize?: number;
    private currentMemorySize: number;
    private ttl?: number;

    /**
     * Create a new cache instance.
     *
     * @param maxSize Maximum number of cached entries (undefined = no limit)
     * @param maxMemorySize Maximum memory size in bytes (undefined = no limit)
     * @param ttl Time-to-live in milliseconds (undefined = no expiration)
     */
    constructor(maxSize?: number, maxMemorySize?: number, ttl?: number) {
        this.entries = new Map();
        this.maxSize = maxSize;
        this.maxMemorySize = maxMemorySize;
        this.currentMemorySize = 0;
        this.ttl = ttl;
    }

    /**
     * Calculate the size of content in bytes.
     */
    private calculateSize(content: string | Uint8Array): number {
        if (typeof content === "string") {
            // UTF-16 encoding: 2 bytes per character (approximation)
            return content.length * 2;
        } else {
            return content.length;
        }
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
            this.delete(key);
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
        const contentSize = this.calculateSize(content);
        const existingEntry = this.entries.get(key);
        const existingSize = existingEntry ? existingEntry.sizeBytes : 0;

        // Evict entries until both limits are satisfied
        while (true) {
            // Calculate new memory size if we add/update this entry
            const newMemorySize = this.currentMemorySize - existingSize + contentSize;

            // Check if we need to evict entries to make room
            const exceedsMemoryLimit = this.maxMemorySize !== undefined && newMemorySize > this.maxMemorySize;
            const exceedsSizeLimit = this.maxSize !== undefined &&
                this.entries.size >= this.maxSize &&
                !this.entries.has(key);

            // If no limits are exceeded, we're done
            if (!exceedsMemoryLimit && !exceedsSizeLimit) {
                break;
            }

            // Check if there are any entries to evict
            if (this.entries.size === 0) {
                // No entries to evict - the entry itself might be too large, but we'll try to add it anyway
                break;
            }

            // Evict one entry and check again
            this.evictLRU();
        }

        // Update or add the entry
        if (existingEntry) {
            this.currentMemorySize -= existingEntry.sizeBytes;
        }

        this.currentMemorySize += contentSize;
        this.entries.set(key, {
            content,
            timestamp: Date.now(),
            etag,
            sizeBytes: contentSize,
        });
    }

    /**
     * Delete a cache entry.
     *
     * @param key Cache key to delete
     */
    delete(key: string): void {
        const entry = this.entries.get(key);
        if (entry) {
            this.currentMemorySize -= entry.sizeBytes;
            this.entries.delete(key);
        }
    }

    /**
     * Clear all cache entries.
     */
    clear(): void {
        this.entries.clear();
        this.currentMemorySize = 0;
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
     * @returns Maximum number of entries (undefined if no limit)
     */
    get maxCacheSize(): number | undefined {
        return this.maxSize;
    }

    /**
     * Get current memory usage in bytes.
     *
     * @returns Current memory usage
     */
    get memorySize(): number {
        return this.currentMemorySize;
    }

    /**
     * Get maximum memory size.
     *
     * @returns Maximum memory size in bytes (undefined if no limit)
     */
    get maxMemoryLimit(): number | undefined {
        return this.maxMemorySize;
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
            const entry = this.entries.get(oldestKey);
            if (entry) {
                this.currentMemorySize -= entry.sizeBytes;
                this.entries.delete(oldestKey);
            }
        }
    }
}

/**
 * Cache configuration options.
 */
export interface CacheOptions {
    /** Enable/disable caching (default: false) */
    enabled: boolean;
    /** Maximum number of cached entries per bucket (undefined = no limit) */
    maxSize?: number;
    /** Maximum memory size in bytes (undefined = no limit). If both maxSize and maxMemorySize are set, either limit can trigger eviction */
    maxMemorySize?: number;
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
export function getCacheStats(bucketName?: string): {
    size: number;
    maxSize: number | undefined;
    memorySize: number;
    maxMemorySize: number | undefined;
} | null {
    const cache = getCache(bucketName);
    if (!cache) return null;
    return {
        size: cache.size,
        maxSize: cache.maxCacheSize,
        memorySize: cache.memorySize,
        maxMemorySize: cache.maxMemoryLimit,
    };
}
