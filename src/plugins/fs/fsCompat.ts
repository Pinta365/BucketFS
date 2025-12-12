/**
 * Cross-runtime filesystem compatibility layer.
 * Provides filesystem operations that work across Deno, Node.js, and Bun.
 * Uses standard runtime APIs to avoid external dependencies.
 */

export { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
export { dirname, join, normalize } from "node:path";
import { stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Checks if a file or directory exists at the specified path.
 *
 * @param path - The path to the file or directory.
 * @returns True if the file or directory exists, otherwise false.
 */
export async function exists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch (error) {
        // Check for NotFoundError or ENOENT error code
        if (
            error instanceof Error &&
            (error.name === "NotFoundError" ||
                (error as { code?: string }).code === "ENOENT")
        ) {
            return false;
        } else {
            throw error;
        }
    }
}

/**
 * Checks if the specified path is a directory.
 *
 * @param path - The path to check.
 * @returns True if the path exists and is a directory, false otherwise.
 */
export async function isDir(path: string): Promise<boolean> {
    try {
        const result = await stat(path);
        return result.isDirectory();
    } catch (error) {
        // Check for NotFoundError or ENOENT error code
        if (
            error instanceof Error &&
            (error.name === "NotFoundError" ||
                (error as { code?: string }).code === "ENOENT")
        ) {
            return false;
        } else {
            throw error;
        }
    }
}

/**
 * Checks if the specified path is a regular file.
 *
 * @param path - The path to check.
 * @returns True if the path exists and is a regular file, false otherwise.
 */
export async function isFile(path: string): Promise<boolean> {
    try {
        const result = await stat(path);
        return result.isFile();
    } catch (error) {
        // Check for NotFoundError or ENOENT error code
        if (
            error instanceof Error &&
            (error.name === "NotFoundError" ||
                (error as { code?: string }).code === "ENOENT")
        ) {
            return false;
        } else {
            throw error;
        }
    }
}

/**
 * Creates a temporary directory with an optional prefix.
 *
 * @param prefix - Optional prefix for the temporary directory name.
 * @returns The path to the created temporary directory.
 */
export async function mktempdir(prefix?: string): Promise<string> {
    // Use Deno's native API when available
    if (typeof Deno !== "undefined" && Deno.makeTempDir) {
        return await Deno.makeTempDir({ prefix });
    }
    
    // Fallback for Node.js/Bun: generate random directory name
    const tempDir = tmpdir();
    
    // Generate a unique random suffix
    const timestamp = Date.now().toString(36);
    const randomPart1 = Math.random().toString(36).replace("0.", "");
    const randomPart2 = Math.random().toString(36).replace("0.", "");
    const randomSuffix = `${timestamp}-${randomPart1}-${randomPart2}`;
    
    // Construct the directory path
    const dirPath = prefix
        ? join(tempDir, prefix.endsWith("-") ? `${prefix}${randomSuffix}` : `${prefix}-${randomSuffix}`)
        : join(tempDir, randomSuffix);
    
    // Create the directory
    await mkdir(dirPath, { recursive: true });
    
    return dirPath;
}

