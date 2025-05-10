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
 * Write content to a file in the bucket.
 *
 * @param path Path to the file
 * @param content Content to write (string or Uint8Array)
 * @param bucketName Optional name of the bucket instance to use
 * @throws Error if the bucket is not initialized or if the write operation fails
 *
 * @example
 * ```ts
 * // Write a text file
 * await writeFile("hello.txt", "Hello, World!");
 *
 * // Write binary data
 * const data = new Uint8Array([1, 2, 3, 4, 5]);
 * await writeFile("data.bin", data);
 *
 * // Write to a specific bucket
 * await writeFile("hello.txt", "Hello, World!", "my-custom-bucket");
 * ```
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
 * Read content from a file in the bucket.
 * 
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 * @returns File content as string, or null if the file doesn't exist
 * @throws Error if the bucket is not initialized or if the read operation fails
 * 
 * @example
 * ```ts
 * // Read a file
 * const content = await readFile("hello.txt");
 * if (content !== null) {
 *   console.log(content); // "Hello, World!"
 * }
 * 
 * // Read from a specific bucket
 * const content = await readFile("hello.txt", "my-custom-bucket");
 * ```
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
        if (error instanceof Error) {
            if (error.name === "NoSuchKey" || error.name === "NotFound") {
                return null;
            }
            if ('code' in error && typeof error.code === 'number' && error.code === 404) {
                return null;
           }
           throw error;
        }
        const errorMessage = String(error);
        throw new Error(`An unexpected non-Error value was thrown during file read: ${errorMessage}`);
    }
}

/**
 * Delete a file from the bucket.
 *
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 * @throws Error if the bucket is not initialized or if the delete operation fails
 *
 * @example
 * ```ts
 * // Delete a file
 * await deleteFile("hello.txt");
 *
 * // Delete from a specific bucket
 * await deleteFile("hello.txt", "my-custom-bucket");
 * ```
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
 * List files in a directory.
 *
 * @param prefix Directory prefix to list files from (e.g., "folder/" or "folder/subfolder/")
 * @param bucketName Optional name of the bucket instance to use
 * @returns Array of file paths
 * @throws Error if the bucket is not initialized or if the list operation fails
 *
 * @example
 * ```ts
 * // List all files
 * const files = await listFiles();
 * console.log(files); // ["file1.txt", "file2.txt", "folder/file3.txt"]
 *
 * // List files in a directory
 * const files = await listFiles("folder/");
 * console.log(files); // ["folder/file3.txt", "folder/file4.txt"]
 *
 * // List from a specific bucket
 * const files = await listFiles("folder/", "my-custom-bucket");
 * ```
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
 * Check if a file exists in the bucket.
 *
 * @param path Path to the file
 * @param bucketName Optional name of the bucket instance to use
 * @returns True if file exists, false otherwise
 * @throws Error if the bucket is not initialized or if the check operation fails
 *
 * @example
 * ```ts
 * // Check if a file exists
 * const exists = await fileExists("hello.txt");
 * if (exists) {
 *   console.log("File exists!");
 * }
 *
 * // Check in a specific bucket
 * const exists = await fileExists("hello.txt", "my-custom-bucket");
 * ```
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
