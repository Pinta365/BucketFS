import { getBucket } from "./bucketConfig.ts";
import { getCache } from "./cache.ts";
import type { MemoryStorage } from "./memoryStorage.ts";
import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
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

    if (bucket.provider === "memory") {
        const client = bucket.client as MemoryStorage;
        client.write(path, content);
    } else if (bucket.provider === "gcs") {
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

    // Update cache after successful write
    const cache = getCache(bucketName);
    if (cache && bucket.cacheOptions?.enabled && bucket.cacheOptions?.includeWrites !== false) {
        const cacheKey = `${bucket.bucketName}:${path}`;
        cache.set(cacheKey, content);
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

    const cache = getCache(bucketName);
    const cacheKey = `${bucket.bucketName}:${path}`;

    // Check cache first if enabled and includes reads
    if (cache && bucket.cacheOptions?.enabled && bucket.cacheOptions?.includeReads !== false) {
        const cachedContent = cache.get(cacheKey);
        if (cachedContent !== null) {
            return typeof cachedContent === "string" ? cachedContent : new TextDecoder().decode(cachedContent);
        }
    }

    try {
        let content: string;
        if (bucket.provider === "memory") {
            const client = bucket.client as MemoryStorage;
            const fileContent = client.read(path);
            if (!fileContent) {
                return null;
            }
            content = new TextDecoder().decode(fileContent);
        } else if (bucket.provider === "gcs") {
            const client = bucket.client as Storage;
            const bucketInstance = client.bucket(bucket.bucketName);
            const file = bucketInstance.file(path);
            const [fileContent] = await file.download();
            //const [metadata] = await file.getMetadata();
            content = new TextDecoder().decode(fileContent);
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
            content = await response.Body.transformToString();
        }

        // Store in cache if enabled
        if (cache && bucket.cacheOptions?.enabled && bucket.cacheOptions?.includeReads !== false) {
            cache.set(cacheKey, content);
        }

        return content;
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.name === "NoSuchKey" || error.name === "NotFound") {
                return null;
            }
            if ("code" in error && typeof error.code === "number" && error.code === 404) {
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

    if (bucket.provider === "memory") {
        const client = bucket.client as MemoryStorage;
        client.delete(path);
    } else if (bucket.provider === "gcs") {
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

    // Invalidate cache
    const cache = getCache(bucketName);
    if (cache) {
        const cacheKey = `${bucket.bucketName}:${path}`;
        cache.delete(cacheKey);
    }
}

/**
 * Move or rename a file in the bucket.
 * This operation moves a file from an old path to a new path.
 * If the new path specifies a different directory, the file is moved.
 * If the new path specifies the same directory but a different name, the file is renamed.
 * If both the directory and name change, the file is moved and renamed.
 * This is typically implemented as a copy to the new path followed by a deletion of the old path.
 *
 * @param oldPath The current path of the file
 * @param newPath The new path for the file
 * @param bucketName Optional name of the bucket instance to use
 * @throws Error if the bucket is not initialized or if the move/rename operation fails
 *
 * @example
 * ```ts
 * // Rename a file in the same directory
 * await moveFile("myfolder/oldname.txt", "myfolder/newname.txt");
 *
 * // Move a file to a different directory
 * await moveFile("myfolder/myfile.txt", "anotherfolder/myfile.txt");
 *
 * // Move and rename a file
 * await moveFile("myfolder/oldname.txt", "anotherfolder/newname.txt");
 *
 * // Move/rename in a specific bucket
 * await moveFile("old/path/file.txt", "new/path/file.txt", "my-custom-bucket");
 * ```
 */
export async function moveFile(oldPath: string, newPath: string, bucketName?: string): Promise<void> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }

    const cache = getCache(bucketName);
    const oldCacheKey = `${bucket.bucketName}:${oldPath}`;
    const newCacheKey = `${bucket.bucketName}:${newPath}`;

    // Get cached content before move if available
    let cachedContent: string | Uint8Array | null = null;
    if (cache) {
        cachedContent = cache.get(oldCacheKey);
        // Remove old path and new path from cache (in case new path existed)
        cache.delete(oldCacheKey);
        cache.delete(newCacheKey);
    }

    try {
        if (bucket.provider === "memory") {
            const client = bucket.client as MemoryStorage;
            client.copy(oldPath, newPath);
            client.delete(oldPath);
        } else if (bucket.provider === "gcs") {
            const client = bucket.client as Storage;
            const bucketInstance = client.bucket(bucket.bucketName);
            const oldFile = bucketInstance.file(oldPath);
            const newFile = bucketInstance.file(newPath);

            await oldFile.copy(newFile);
            await oldFile.delete();
        } else {
            const client = bucket.client as S3Client;
            const copyCommand = new CopyObjectCommand({
                Bucket: bucket.bucketName,
                CopySource: `${bucket.bucketName}/${oldPath}`,
                Key: newPath,
            });
            await client.send(copyCommand);
            const deleteCommand = new DeleteObjectCommand({
                Bucket: bucket.bucketName,
                Key: oldPath,
            });
            await client.send(deleteCommand);
        }

        // If content was cached, preserve it for new path
        if (cache && cachedContent !== null && bucket.cacheOptions?.enabled) {
            cache.set(newCacheKey, cachedContent);
        }
    } catch (error) {
        // Improve error handling
        throw new Error(`Failed to move/rename file from ${oldPath} to ${newPath}: ${error}`);
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

    if (bucket.provider === "memory") {
        const client = bucket.client as MemoryStorage;
        return client.list(prefix);
    } else if (bucket.provider === "gcs") {
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
        if (bucket.provider === "memory") {
            const client = bucket.client as MemoryStorage;
            return client.exists(path);
        } else if (bucket.provider === "gcs") {
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

/**
 * Check authentication/connection to the bucket with minimal/no operational cost.
 * For S3/R2/Spaces, uses HeadBucketCommand. For GCS, uses getMetadata on the bucket.
 *
 * @param bucketName Optional name of the bucket instance to use
 * @returns True if authentication succeeds, false otherwise
 * @throws Error if the bucket is not initialized or if the check operation fails for reasons other than auth
 *
 * @example
 * ```ts
 * const ok = await checkBucketAuth();
 * if (!ok) throw new Error("Auth failed");
 * ```
 */
export async function checkBucketAuth(bucketName?: string): Promise<boolean> {
    const bucket = getBucket(bucketName);
    if (!bucket) {
        throw new Error(`Bucket ${bucketName || "default"} not initialized`);
    }
    try {
        if (bucket.provider === "memory") {
            // Memory provider is always available
            return true;
        } else if (bucket.provider === "gcs") {
            const client = bucket.client as Storage;
            const bucketInstance = client.bucket(bucket.bucketName);
            await bucketInstance.getMetadata();
            return true;
        } else {
            // S3, R2, Spaces
            const client = bucket.client as S3Client;
            const command = new HeadBucketCommand({ Bucket: bucket.bucketName });
            await client.send(command);
            return true;
        }
    } catch (error) {
        if (error && typeof error === "object" && "name" in error && (error as any).name === "Forbidden") {
            return false;
        }
        if (
            error && typeof error === "object" && "$metadata" in error &&
            (error as any).$metadata?.httpStatusCode === 403
        ) {
            return false;
        }
        return false;
    }
}
