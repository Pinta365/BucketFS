/**
 * BucketFS - A Cloud Storage Abstraction Layer
 *
 * BucketFS provides a interface for working with multiple cloud storage providers,
 * including AWS S3, Cloudflare R2, and Google Cloud Storage (GCS). It offers a consistent
 * API that abstracts away the complexities and differences between various storage services.
 *
 * Features:
 * - Multi-provider support
 * - Multiple bucket management
 *
 * Use Cases:
 * - Cloud storage abstraction in applications
 * - Persistent storage in serverless environments (e.g., Deno Deploy or Cloudflare Workers)
 * - Multi-cloud storage strategies
 * - Simplified storage operations across different providers
 */

// Types
export type { BucketConfig, BucketInstance, StorageProvider } from "./src/bucketConfig.ts";
export type { CacheOptions } from "./src/cache.ts";

// Configuration functions
export { getBucket, initBucket, listBuckets, resetBucket } from "./src/bucketConfig.ts";

// File operations
export { checkBucketAuth, deleteFile, fileExists, listFiles, moveFile, readFile, writeFile } from "./src/bucketCore.ts";

// Cache operations
export { clearCache, getCacheStats } from "./src/cache.ts";
