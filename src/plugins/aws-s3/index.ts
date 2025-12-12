import type { ProviderPlugin } from "../../plugin.ts";
import {
    checkBucketAccess,
    copyObject,
    deleteObject,
    downloadObjectAsBuffer,
    downloadObjectAsString,
    listObjects,
    objectExists,
    uploadObject,
} from "../s3-compatible/api.ts";
import type { AWSCredentials } from "../s3-compatible/sigv4.ts";
import type { S3EndpointConfig } from "../s3-compatible/api.ts";

/**
 * AWS S3 storage plugin implementation.
 * Uses S3 REST API directly via fetch
 */
class AWSS3Plugin implements ProviderPlugin {
    private credentials: AWSCredentials;
    private config: S3EndpointConfig;

    constructor(credentials: AWSCredentials, config: S3EndpointConfig) {
        this.credentials = credentials;
        this.config = config;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        await uploadObject(this.config.endpoint, bucketName, path, content, this.credentials, this.config);
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        return await downloadObjectAsString(this.config.endpoint, bucketName, path, this.credentials, this.config);
    }

    async readBuffer(bucketName: string, path: string): Promise<Uint8Array | null> {
        return await downloadObjectAsBuffer(this.config.endpoint, bucketName, path, this.credentials, this.config);
    }

    async delete(bucketName: string, path: string): Promise<void> {
        await deleteObject(this.config.endpoint, bucketName, path, this.credentials, this.config);
    }

    async move(bucketName: string, oldPath: string, newPath: string): Promise<void> {
        await copyObject(this.config.endpoint, bucketName, oldPath, newPath, this.credentials, this.config);
        await deleteObject(this.config.endpoint, bucketName, oldPath, this.credentials, this.config);
    }

    async list(bucketName: string, prefix?: string): Promise<string[]> {
        return await listObjects(this.config.endpoint, bucketName, prefix, this.credentials, this.config);
    }

    async exists(bucketName: string, path: string): Promise<boolean> {
        return await objectExists(this.config.endpoint, bucketName, path, this.credentials, this.config);
    }

    async checkAuth(bucketName: string): Promise<boolean> {
        return await checkBucketAccess(this.config.endpoint, bucketName, this.credentials, this.config);
    }
}

/**
 * Create an AWS S3 storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new AWSS3Plugin instance
 */
export function createPlugin(config: {
    provider: string;
    bucketName: string;
    region?: string;
    accountId?: string;
    projectId?: string;
    rootDirectory?: string;
    credentials?: unknown;
    cache?: unknown;
}): Promise<ProviderPlugin> {
    if (!config.region) {
        throw new Error("Region is required for AWS S3 provider");
    }
    const credentials = config.credentials as { accessKeyId?: string; secretAccessKey?: string } | undefined;
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
        throw new Error("Access key and secret key are required for AWS S3 provider");
    }

    const awsCredentials: AWSCredentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
    };

    const endpointConfig: S3EndpointConfig = {
        endpoint: `https://s3.${config.region}.amazonaws.com`,
        region: config.region,
        forcePathStyle: false,
    };

    return Promise.resolve(new AWSS3Plugin(awsCredentials, endpointConfig));
}
