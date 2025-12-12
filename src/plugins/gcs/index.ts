import type { ProviderPlugin } from "../../plugin.ts";
import {
    copyObject,
    deleteObject,
    downloadObjectAsBuffer,
    downloadObjectAsString,
    getBucketMetadata,
    listObjects,
    objectExists,
    uploadObject,
} from "./api.ts";
import type { ServiceAccountCredentials } from "./auth.ts";

/**
 * Google Cloud Storage plugin implementation.
 * Uses GCS JSON API directly via fetch
 */
class GCSPlugin implements ProviderPlugin {
    private credentials: ServiceAccountCredentials;

    constructor(credentials: ServiceAccountCredentials) {
        this.credentials = credentials;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        await uploadObject(this.credentials, bucketName, path, content);
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        return await downloadObjectAsString(this.credentials, bucketName, path);
    }

    async readBuffer(bucketName: string, path: string): Promise<Uint8Array | null> {
        return await downloadObjectAsBuffer(this.credentials, bucketName, path);
    }

    async delete(bucketName: string, path: string): Promise<void> {
        await deleteObject(this.credentials, bucketName, path);
    }

    async move(bucketName: string, oldPath: string, newPath: string): Promise<void> {
        await copyObject(this.credentials, bucketName, oldPath, newPath);
        await deleteObject(this.credentials, bucketName, oldPath);
    }

    async list(bucketName: string, prefix?: string): Promise<string[]> {
        return await listObjects(this.credentials, bucketName, prefix);
    }

    async exists(bucketName: string, path: string): Promise<boolean> {
        return await objectExists(this.credentials, bucketName, path);
    }

    async checkAuth(bucketName: string): Promise<boolean> {
        try {
            await getBucketMetadata(this.credentials, bucketName);
            return true;
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("403") || error.message.includes("Forbidden")) {
                    return false;
                }
                if (error.message.includes("401") || error.message.includes("Unauthorized")) {
                    return false;
                }
            }
            return false;
        }
    }
}

/**
 * Create a Google Cloud Storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new GCSPlugin instance
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
    if (!config.projectId) {
        throw new Error("Project ID is required for Google Cloud Storage provider");
    }
    const credentials = config.credentials as { clientEmail?: string; privateKey?: string; scope?: string } | undefined;
    if (!credentials?.clientEmail || !credentials?.privateKey) {
        throw new Error("Client email and private key are required for Google Cloud Storage provider");
    }

    const serviceAccountCredentials: ServiceAccountCredentials = {
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
        scope: credentials.scope,
    };

    return Promise.resolve(new GCSPlugin(serviceAccountCredentials));
}
