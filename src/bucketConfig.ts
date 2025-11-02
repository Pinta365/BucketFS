import { S3Client } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { Cache, removeCache, setCache } from "./cache.ts";
import type { CacheOptions } from "./cache.ts";

/**
 * Supported cloud storage providers.
 * - `aws-s3`: Amazon S3 (Simple Storage Service)
 * - `cf-r2`: Cloudflare R2
 * - `gcs`: Google Cloud Storage
 * - `do-spaces`: DigitalOcean Spaces
 */
export type StorageProvider = "aws-s3" | "cf-r2" | "gcs" | "do-spaces";

/**
 * Credentials for S3-compatible storage providers (ex. S3, R2 and spaces).
 */
interface S3Credentials {
    /** AWS access key ID or R2 access key ID */
    accessKeyId: string;
    /** AWS secret access key or R2 secret access key */
    secretAccessKey: string;
}

/**
 * Credentials for Google Cloud Storage.
 */
interface GCSCredentials {
    /** GCP service account client email */
    clientEmail: string;
    /** GCP service account private key */
    privateKey: string;
}

/**
 * Configuration for initializing a bucket instance.
 *
 * @example
 * ```ts
 * // AWS S3 configuration
 * const s3Config: BucketConfig = {
 *   provider: "aws-s3",
 *   bucketName: "my-bucket",
 *   region: "us-east-1",
 *   credentials: {
 *     accessKeyId: "your-access-key",
 *     secretAccessKey: "your-secret-key"
 *   }
 * };
 *
 * // Cloudflare R2 configuration
 * const r2Config: BucketConfig = {
 *   provider: "cf-r2",
 *   bucketName: "my-bucket",
 *   accountId: "your-account-id",
 *   credentials: {
 *     accessKeyId: "your-access-key",
 *     secretAccessKey: "your-secret-key"
 *   }
 * };
 *
 * // Google Cloud Storage configuration
 * const gcsConfig: BucketConfig = {
 *   provider: "gcs",
 *   bucketName: "my-bucket",
 *   projectId: "your-project-id",
 *   credentials: {
 *     clientEmail: "your-service-account",
 *     privateKey: "your-private-key"
 *   }
 * };
 *
 * // DigitalOcean Spaces configuration
 * const spacesConfig: BucketConfig = {
 *   provider: "do-spaces",
 *   bucketName: "my-bucket",
 *   region: "nyc3",
 *   credentials: {
 *     accessKeyId: "your-access-key",
 *     secretAccessKey: "your-secret-key"
 *   }
 * };
 * ```
 */
export interface BucketConfig {
    /** The storage provider to use */
    provider: StorageProvider;
    /** The name of the bucket */
    bucketName: string;
    /** The region for S3/Spaces provider (required for S3/Spaces) */
    region?: string;
    /** The account ID for R2 provider (required for R2) */
    accountId?: string;
    /** The project ID for GCS provider (required for GCS) */
    projectId?: string;
    /** The credentials for the storage provider */
    credentials: S3Credentials | GCSCredentials;
    /** Optional cache configuration */
    cache?: CacheOptions;
}

/**
 * Represents an initialized bucket instance.
 */
export interface BucketInstance {
    /** The storage client instance */
    client: S3Client | Storage;
    /** The name of the bucket */
    bucketName: string;
    /** The storage provider */
    provider: StorageProvider;
    /** Cache configuration if enabled */
    cacheOptions?: CacheOptions;
}

// Map to store multiple bucket instances
const bucketInstances = new Map<string, BucketInstance>();

/**
 * Initialize a bucket with the specified configuration.
 *
 * @param config The configuration for the bucket
 * @param name Optional name for the bucket instance (defaults to bucketName)
 * @returns The name of the initialized bucket
 * @throws Error if required configuration is missing or invalid
 *
 * @example
 * ```ts
 * // Initialize an S3 bucket
 * const bucketName = initBucket({
 *   provider: "aws-s3",
 *   bucketName: "my-bucket",
 *   region: "us-east-1",
 *   credentials: {
 *     accessKeyId: "your-access-key",
 *     secretAccessKey: "your-secret-key"
 *   }
 * });
 *
 * // Initialize with a custom name
 * const customName = initBucket(config, "my-custom-name");
 * ```
 */
export function initBucket(config: BucketConfig, name?: string): string {
    const { provider, bucketName, region, accountId, projectId, credentials } = config;
    const instanceName = name || bucketName;

    if (!credentials) {
        throw new Error("Credentials are required");
    }

    if (provider === "aws-s3" || provider === "do-spaces") {
        if (!region) {
            throw new Error("Region is required for AWS S3/Spaces provider");
        }
        if (!(credentials as S3Credentials).accessKeyId || !(credentials as S3Credentials).secretAccessKey) {
            throw new Error("Access key and secret key are required for AWS S3/Spaces provider");
        }
        bucketInstances.set(instanceName, {
            client: new S3Client({
                region,
                endpoint: provider === "do-spaces" ? `https://${region}.digitaloceanspaces.com` : undefined,
                credentials: {
                    accessKeyId: (credentials as S3Credentials).accessKeyId,
                    secretAccessKey: (credentials as S3Credentials).secretAccessKey,
                },
            }),
            bucketName,
            provider,
            cacheOptions: config.cache,
        });

        // Initialize cache if enabled
        if (config.cache?.enabled) {
            const cache = new Cache(
                config.cache.maxSize ?? 1000,
                config.cache.maxMemorySize,
                config.cache.ttl,
            );
            setCache(instanceName, cache);
        }
    } else if (provider === "cf-r2") {
        if (!accountId) {
            throw new Error("Account ID is required for Cloudflare R2 provider");
        }
        if (!(credentials as S3Credentials).accessKeyId || !(credentials as S3Credentials).secretAccessKey) {
            throw new Error("Access key and secret key are required for Cloudflare R2 provider");
        }
        bucketInstances.set(instanceName, {
            client: new S3Client({
                region: "auto",
                endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: (credentials as S3Credentials).accessKeyId,
                    secretAccessKey: (credentials as S3Credentials).secretAccessKey,
                },
            }),
            bucketName,
            provider,
            cacheOptions: config.cache,
        });

        // Initialize cache if enabled
        if (config.cache?.enabled) {
            const cache = new Cache(
                config.cache.maxSize ?? 1000,
                config.cache.maxMemorySize,
                config.cache.ttl,
            );
            setCache(instanceName, cache);
        }
    } else if (provider === "gcs") {
        if (!projectId) {
            throw new Error("Project ID is required for Google Cloud Storage provider");
        }
        if (!(credentials as GCSCredentials).clientEmail || !(credentials as GCSCredentials).privateKey) {
            throw new Error("Client email and private key are required for Google Cloud Storage provider");
        }
        bucketInstances.set(instanceName, {
            client: new Storage({
                projectId,
                credentials: {
                    client_email: (credentials as GCSCredentials).clientEmail,
                    private_key: (credentials as GCSCredentials).privateKey,
                },
            }),
            bucketName,
            provider,
            cacheOptions: config.cache,
        });

        // Initialize cache if enabled
        if (config.cache?.enabled) {
            const cache = new Cache(
                config.cache.maxSize ?? 1000,
                config.cache.maxMemorySize,
                config.cache.ttl,
            );
            setCache(instanceName, cache);
        }
    } else {
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return instanceName;
}

/**
 * Get a specific bucket instance.
 *
 * @param name The name of the bucket instance (defaults to the first initialized bucket)
 * @returns The bucket instance
 * @throws Error if the bucket instance doesn't exist
 *
 * @example
 * ```ts
 * // Get the default bucket
 * const bucket = getBucket();
 *
 * // Get a specific bucket
 * const customBucket = getBucket("my-custom-name");
 * ```
 */
export function getBucket(name?: string): BucketInstance {
    const instanceName = name || Array.from(bucketInstances.keys())[0];

    if (!instanceName || !bucketInstances.has(instanceName)) {
        throw new Error(`Bucket instance "${instanceName}" not found. Call initBucket() first.`);
    }

    return bucketInstances.get(instanceName)!;
}

/**
 * Reset a specific bucket instance or all instances.
 *
 * @param name The name of the bucket instance to reset (if not provided, resets all instances)
 *
 * @example
 * ```ts
 * // Reset a specific bucket
 * resetBucket("my-custom-name");
 *
 * // Reset all buckets
 * resetBucket();
 * ```
 */
export function resetBucket(name?: string): void {
    if (name) {
        bucketInstances.delete(name);
        removeCache(name);
    } else {
        // Clear all caches before clearing bucket instances
        const bucketNames = Array.from(bucketInstances.keys());
        bucketNames.forEach((name) => removeCache(name));
        bucketInstances.clear();
    }
}

/**
 * List all active bucket instances.
 *
 * @returns Array of bucket instance names
 *
 * @example
 * ```ts
 * const bucketNames = listBuckets();
 * console.log(bucketNames); // ["bucket1", "bucket2"]
 * ```
 */
export function listBuckets(): string[] {
    return Array.from(bucketInstances.keys());
}
