/**
 * BucketFS - A Unified Cloud Storage Abstraction Layer
 *
 * BucketFS provides a interface for working with multiple cloud storage providers,
 * including AWS S3 and Cloudflare R2. It offers a consistent API that abstracts away the
 * complexities and differences between various storage services.
 *
 * Use Cases:
 * - Cloud storage abstraction in applications
 * - Persistent storage in serverless environments (e.g., Deno Deploy or Cloudflare Workers)
 * - Multi-cloud storage strategies
 * - Simplified storage operations across different providers
 *
 * @module bucketfs
 */

// Types
export type { BucketConfig, BucketInstance, StorageProvider } from "./src/bucketConfig.ts";

// Configuration functions
export { getBucket, initBucket, listBuckets, resetBucket } from "./src/bucketConfig.ts";

// File operations
export { deleteFile, fileExists, listFiles, readFile, writeFile } from "./src/bucketCore.ts";
