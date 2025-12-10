import type { ProviderPlugin } from "../../plugin.ts";
import type { Storage } from "@google-cloud/storage";

/**
 * Google Cloud Storage plugin implementation.
 * Uses @google-cloud/storage SDK.
 */
class GCSPlugin implements ProviderPlugin {
    private client: Storage;

    constructor(client: Storage) {
        this.client = client;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        const bucketInstance = this.client.bucket(bucketName);
        const file = bucketInstance.file(path);
        await file.save(content);
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        try {
            const bucketInstance = this.client.bucket(bucketName);
            const file = bucketInstance.file(path);
            const [fileContent] = await file.download();
            return new TextDecoder().decode(fileContent);
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (error.name === "NoSuchKey" || error.name === "NotFound") {
                    return null;
                }
                if ("code" in error && typeof error.code === "number" && error.code === 404) {
                    return null;
                }
            }
            throw error;
        }
    }

    async readBuffer(bucketName: string, path: string): Promise<Uint8Array | null> {
        try {
            const bucketInstance = this.client.bucket(bucketName);
            const file = bucketInstance.file(path);
            const [fileContent] = await file.download();
            return fileContent;
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (error.name === "NoSuchKey" || error.name === "NotFound") {
                    return null;
                }
                if ("code" in error && typeof error.code === "number" && error.code === 404) {
                    return null;
                }
            }
            throw error;
        }
    }

    async delete(bucketName: string, path: string): Promise<void> {
        const bucketInstance = this.client.bucket(bucketName);
        const file = bucketInstance.file(path);
        await file.delete();
    }

    async move(bucketName: string, oldPath: string, newPath: string): Promise<void> {
        const bucketInstance = this.client.bucket(bucketName);
        const oldFile = bucketInstance.file(oldPath);
        const newFile = bucketInstance.file(newPath);

        await oldFile.copy(newFile);
        await oldFile.delete();
    }

    async list(bucketName: string, prefix?: string): Promise<string[]> {
        const bucketInstance = this.client.bucket(bucketName);
        const [files] = await bucketInstance.getFiles({ prefix: prefix || "" });
        return files.map((file) => file.name);
    }

    async exists(bucketName: string, path: string): Promise<boolean> {
        try {
            const bucketInstance = this.client.bucket(bucketName);
            const file = bucketInstance.file(path);
            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            if ((error as Error).name === "NotFound") {
                return false;
            }
            throw error;
        }
    }

    async checkAuth(bucketName: string): Promise<boolean> {
        try {
            const bucketInstance = this.client.bucket(bucketName);
            await bucketInstance.getMetadata();
            return true;
        } catch (error) {
            if (error && typeof error === "object") {
                // Check for Forbidden error by name
                if ("name" in error && error.name === "Forbidden") {
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
export async function createPlugin(config: {
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
    const credentials = config.credentials as { clientEmail?: string; privateKey?: string } | undefined;
    if (!credentials?.clientEmail || !credentials?.privateKey) {
        throw new Error("Client email and private key are required for Google Cloud Storage provider");
    }

    const { Storage } = await import("@google-cloud/storage");
    const client = new Storage({
        projectId: config.projectId,
        credentials: {
            client_email: credentials.clientEmail,
            private_key: credentials.privateKey,
        },
    });

    return new GCSPlugin(client);
}
