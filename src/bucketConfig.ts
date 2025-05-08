import { S3Client } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";

export type StorageProvider = "s3" | "r2" | "gcs";

interface S3Credentials {
    accessKeyId: string;
    secretAccessKey: string;
}

interface GCSCredentials {
    clientEmail: string;
    privateKey: string;
}

export interface BucketConfig {
    provider: StorageProvider;
    bucketName: string;
    region?: string;
    accountId?: string;
    projectId?: string;
    credentials: S3Credentials | GCSCredentials;
}

export interface BucketInstance {
    client: S3Client | Storage;
    bucketName: string;
    provider: StorageProvider;
}

// Map to store multiple bucket instances
const bucketInstances = new Map<string, BucketInstance>();

/**
 * Initialize a bucket with the specified configuration
 * @param config The configuration for the bucket
 * @param name Optional name for the bucket instance (defaults to bucketName)
 * @returns The name of the initialized bucket
 */
export function initBucket(config: BucketConfig, name?: string): string {
    const { provider, bucketName, region, accountId, projectId, credentials } = config;
    const instanceName = name || bucketName;

    if (!credentials) {
        throw new Error("Credentials are required");
    }

    if (provider === "s3") {
        if (!region) {
            throw new Error("Region is required for S3 provider");
        }
        if (!(credentials as S3Credentials).accessKeyId || !(credentials as S3Credentials).secretAccessKey) {
            throw new Error("Access key and secret key are required for S3 provider");
        }
        bucketInstances.set(instanceName, {
            client: new S3Client({
                region,
                credentials: {
                    accessKeyId: (credentials as S3Credentials).accessKeyId,
                    secretAccessKey: (credentials as S3Credentials).secretAccessKey,
                },
            }),
            bucketName,
            provider,
        });
    } else if (provider === "r2") {
        if (!accountId) {
            throw new Error("Account ID is required for R2 provider");
        }
        if (!(credentials as S3Credentials).accessKeyId || !(credentials as S3Credentials).secretAccessKey) {
            throw new Error("Access key and secret key are required for R2 provider");
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
        });
    } else if (provider === "gcs") {
        if (!projectId) {
            throw new Error("Project ID is required for GCS provider");
        }
        if (!(credentials as GCSCredentials).clientEmail || !(credentials as GCSCredentials).privateKey) {
            throw new Error("Client email and private key are required for GCS provider");
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
        });
    } else {
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return instanceName;
}

/**
 * Get a specific bucket instance
 * @param name The name of the bucket instance
 * @returns The bucket instance
 * @throws Error if the bucket instance doesn't exist
 */
export function getBucket(name?: string): BucketInstance {
    const instanceName = name || Array.from(bucketInstances.keys())[0];

    if (!instanceName || !bucketInstances.has(instanceName)) {
        throw new Error(`Bucket instance "${instanceName}" not found. Call initBucket() first.`);
    }

    return bucketInstances.get(instanceName)!;
}

/**
 * Reset a specific bucket instance
 * @param name The name of the bucket instance to reset
 */
export function resetBucket(name?: string): void {
    if (name) {
        bucketInstances.delete(name);
    } else {
        bucketInstances.clear();
    }
}

/**
 * List all active bucket instances
 * @returns Array of bucket instance names
 */
export function listBuckets(): string[] {
    return Array.from(bucketInstances.keys());
}
