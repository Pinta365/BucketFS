import { getBucket } from "./bucketConfig.ts";
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { _Object, S3Client } from "@aws-sdk/client-s3";
import type { Storage } from "@google-cloud/storage";

/**
 * Write content to a file in the bucket
 * @param path Path to the file
 * @param content Content to write
 * @param bucketName Optional name of the bucket instance to use
 */
export async function writeFile(path: string, content: string | Uint8Array, bucketName?: string): Promise<void> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    if (bucket.provider === "gcs") {
        const client = bucket.client as Storage;
        const bucketInstance = client.bucket(bucket.bucketName);
        const file = bucketInstance.file(path);
        await file.save(content);
    } else {
        const client = bucket.client as S3Client;
        const command = new PutObjectCommand({
            Bucket: bucket.bucketName,
            Key: path,
            Body: content,
        });
        await client.send(command);
    }
}

/**
 * Read content from a file in the bucket
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 * @returns File content as string, or null if the file doesn't exist
 */
export async function readFile(path: string, bucketName?: string): Promise<string | null> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    try {
        if (bucket.provider === "gcs") {
            const client = bucket.client as Storage;
            const bucketInstance = client.bucket(bucket.bucketName);
            const file = bucketInstance.file(path);
            const [content] = await file.download();
            return new TextDecoder().decode(content);
        } else {
            const client = bucket.client as S3Client;
            const command = new GetObjectCommand({
                Bucket: bucket.bucketName,
                Key: path,
            });
            const response = await client.send(command);
            if (!response.Body) {
                throw new Error(`File ${path} not found`);
            }
            const text = await response.Body.transformToString();
            return text;
        }
    } catch (error: unknown) {
        if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
            return null;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file ${path}: ${errorMessage}`);
    }
}

/**
 * Delete a file from the bucket
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 */
export async function deleteFile(path: string, bucketName?: string): Promise<void> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    if (bucket.provider === "gcs") {
        const client = bucket.client as Storage;
        const bucketInstance = client.bucket(bucket.bucketName);
        const file = bucketInstance.file(path);
        await file.delete();
    } else {
        const client = bucket.client as S3Client;
        const command = new DeleteObjectCommand({
            Bucket: bucket.bucketName,
            Key: path,
        });
        await client.send(command);
    }
}

/**
 * List files in a directory
 * @param prefix Directory prefix to list files from
 * @param bucketName Optional name of the bucket instance to use
 * @returns Array of file paths
 */
export async function listFiles(prefix?: string, bucketName?: string): Promise<string[]> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    if (bucket.provider === "gcs") {
        const client = bucket.client as Storage;
        const bucketInstance = client.bucket(bucket.bucketName);
        const [files] = await bucketInstance.getFiles({ prefix: prefix || "" });
        return files.map((file) => file.name);
    } else {
        const client = bucket.client as S3Client;
        const command = new ListObjectsV2Command({
            Bucket: bucket.bucketName,
            Prefix: prefix || "",
        });
        const response = await client.send(command);
        return (response.Contents || []).map((item: _Object) => item.Key || "");
    }
}

/**
 * Check if a file exists in the bucket
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 * @returns True if file exists, false otherwise
 */
export async function fileExists(path: string, bucketName?: string): Promise<boolean> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    try {
        if (bucket.provider === "gcs") {
            const client = bucket.client as Storage;
            const bucketInstance = client.bucket(bucket.bucketName);
            const file = bucketInstance.file(path);
            const [exists] = await file.exists();
            return exists;
        } else {
            const client = bucket.client as S3Client;
            const command = new HeadObjectCommand({
                Bucket: bucket.bucketName,
                Key: path,
            });
            await client.send(command);
            return true;
        }
    } catch (error) {
        if ((error as Error).name === "NotFound") {
            return false;
        }
        throw error;
    }
}
