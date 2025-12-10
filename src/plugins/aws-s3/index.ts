import type { ProviderPlugin } from "../../plugin.ts";
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * AWS S3 storage plugin implementation.
 * Uses AWS SDK v3 for S3 operations.
 */
class AWSS3Plugin implements ProviderPlugin {
    private client: S3Client;
    private s3Commands: {
        CopyObjectCommand: typeof import("@aws-sdk/client-s3").CopyObjectCommand;
        DeleteObjectCommand: typeof import("@aws-sdk/client-s3").DeleteObjectCommand;
        GetObjectCommand: typeof import("@aws-sdk/client-s3").GetObjectCommand;
        HeadBucketCommand: typeof import("@aws-sdk/client-s3").HeadBucketCommand;
        HeadObjectCommand: typeof import("@aws-sdk/client-s3").HeadObjectCommand;
        ListObjectsV2Command: typeof import("@aws-sdk/client-s3").ListObjectsV2Command;
        PutObjectCommand: typeof import("@aws-sdk/client-s3").PutObjectCommand;
    } | null = null;

    constructor(client: S3Client) {
        this.client = client;
    }

    private async getS3Commands() {
        if (!this.s3Commands) {
            const s3Module = await import("@aws-sdk/client-s3");
            this.s3Commands = {
                CopyObjectCommand: s3Module.CopyObjectCommand,
                DeleteObjectCommand: s3Module.DeleteObjectCommand,
                GetObjectCommand: s3Module.GetObjectCommand,
                HeadBucketCommand: s3Module.HeadBucketCommand,
                HeadObjectCommand: s3Module.HeadObjectCommand,
                ListObjectsV2Command: s3Module.ListObjectsV2Command,
                PutObjectCommand: s3Module.PutObjectCommand,
            };
        }
        return this.s3Commands;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        const commands = await this.getS3Commands();
        const command = new commands.PutObjectCommand({
            Bucket: bucketName,
            Key: path,
            Body: content,
        });
        await this.client.send(command);
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        try {
            const commands = await this.getS3Commands();
            const command = new commands.GetObjectCommand({
                Bucket: bucketName,
                Key: path,
            });
            const response = await this.client.send(command);
            if (!response.Body) {
                return null;
            }
            return await response.Body.transformToString();
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
            const commands = await this.getS3Commands();
            const command = new commands.GetObjectCommand({
                Bucket: bucketName,
                Key: path,
            });
            const response = await this.client.send(command);
            if (!response.Body) {
                return null;
            }
            return await response.Body.transformToByteArray();
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
        const commands = await this.getS3Commands();
        const command = new commands.DeleteObjectCommand({
            Bucket: bucketName,
            Key: path,
        });
        await this.client.send(command);
    }

    async move(bucketName: string, oldPath: string, newPath: string): Promise<void> {
        const commands = await this.getS3Commands();
        const copyCommand = new commands.CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `${bucketName}/${oldPath}`,
            Key: newPath,
        });
        await this.client.send(copyCommand);
        const deleteCommand = new commands.DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldPath,
        });
        await this.client.send(deleteCommand);
    }

    async list(bucketName: string, prefix?: string): Promise<string[]> {
        const commands = await this.getS3Commands();
        const command = new commands.ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix || "",
        });
        const response = await this.client.send(command);
        return (response.Contents || []).map((item) => item.Key || "").filter((key) => key !== "");
    }

    async exists(bucketName: string, path: string): Promise<boolean> {
        try {
            const commands = await this.getS3Commands();
            const command = new commands.HeadObjectCommand({
                Bucket: bucketName,
                Key: path,
            });
            await this.client.send(command);
            return true;
        } catch (error) {
            if ((error as Error).name === "NotFound") {
                return false;
            }
            throw error;
        }
    }

    async checkAuth(bucketName: string): Promise<boolean> {
        try {
            const commands = await this.getS3Commands();
            const command = new commands.HeadBucketCommand({ Bucket: bucketName });
            await this.client.send(command);
            return true;
        } catch (error) {
            if (error && typeof error === "object") {
                // Check for Forbidden error by name
                if ("name" in error && error.name === "Forbidden") {
                    return false;
                }
                // Check for AWS SDK error with 403 status code
                if ("$metadata" in error && typeof error.$metadata === "object" && error.$metadata !== null) {
                    const metadata = error.$metadata as { httpStatusCode?: number };
                    if (metadata.httpStatusCode === 403) {
                        return false;
                    }
                }
            }
            return false;
        }
    }
}

/**
 * Create an AWS S3 storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new AWSS3Plugin instance
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
    if (!config.region) {
        throw new Error("Region is required for AWS S3 provider");
    }
    const credentials = config.credentials as { accessKeyId?: string; secretAccessKey?: string } | undefined;
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
        throw new Error("Access key and secret key are required for AWS S3 provider");
    }

    const { S3Client } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
        region: config.region,
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
        },
    });

    return new AWSS3Plugin(client);
}
