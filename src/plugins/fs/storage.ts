/**
 * Local filesystem storage implementation for fs bucket provider.
 * Uses @cross/fs for cross-runtime compatibility (Deno, Node.js, Bun).
 */
import { readFile, writeFile } from "@cross/fs/io";
import { mkdir, readdir, unlink } from "@cross/fs/ops";
import { exists, isDir, isFile } from "@cross/fs/stat";
import { dirname, join, normalize } from "@std/path";

export class FSStorage {
    private rootDirectory: string;

    constructor(rootDirectory: string) {
        this.rootDirectory = normalize(rootDirectory);
    }

    /**
     * Get the full path for a file.
     */
    private getFullPath(path: string): string {
        // Normalize the path to prevent directory traversal
        const normalizedPath = normalize(path);
        // Remove leading slashes to prevent absolute paths
        const safePath = normalizedPath.replace(/^\/+/, "");
        return join(this.rootDirectory, safePath);
    }

    /**
     * Write content to a file path.
     * Automatically creates parent directories if they don't exist.
     */
    async write(path: string, content: string | Uint8Array): Promise<void> {
        const fullPath = this.getFullPath(path);
        const dirPath = dirname(fullPath);

        // Create parent directories if they don't exist
        if (dirPath && dirPath !== this.rootDirectory) {
            try {
                await mkdir(dirPath, { recursive: true });
            } catch (error) {
                // Ignore error if directory already exists
                if (!(await exists(dirPath))) {
                    throw error;
                }
            }
        }

        await writeFile(fullPath, content);
    }

    /**
     * Read content from a file path.
     */
    async read(path: string): Promise<Uint8Array | null> {
        const fullPath = this.getFullPath(path);

        if (!(await exists(fullPath))) {
            return null;
        }

        if (!(await isFile(fullPath))) {
            return null;
        }

        try {
            return await readFile(fullPath);
        } catch (error) {
            if ((error as Error).name === "NotFound" || (error as Error).message.includes("ENOENT")) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Delete a file at the given path.
     */
    async delete(path: string): Promise<void> {
        const fullPath = this.getFullPath(path);

        if (!(await exists(fullPath))) {
            return;
        }

        if (await isFile(fullPath)) {
            await unlink(fullPath);
        }
    }

    /**
     * Check if a file exists at the given path.
     */
    async exists(path: string): Promise<boolean> {
        const fullPath = this.getFullPath(path);
        return (await exists(fullPath)) && (await isFile(fullPath));
    }

    /**
     * List all file paths, optionally filtered by prefix.
     * Returns relative paths (not full paths).
     */
    async list(prefix?: string): Promise<string[]> {
        const prefixPath = prefix ? this.getFullPath(prefix) : this.rootDirectory;
        const files: string[] = [];

        async function traverseDir(dir: string, baseDir: string): Promise<void> {
            if (!(await exists(dir)) || !(await isDir(dir))) {
                return;
            }

            const entries = await readdir(dir);

            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const relativePath = fullPath.substring(baseDir.length + 1).replace(/\\/g, "/");

                if (await isFile(fullPath)) {
                    files.push(relativePath);
                } else if (await isDir(fullPath)) {
                    await traverseDir(fullPath, baseDir);
                }
            }
        }

        await traverseDir(prefixPath, this.rootDirectory);

        if (prefix) {
            const normalizedPrefix = normalize(prefix).replace(/^\/+/, "").replace(/\\/g, "/");
            return files.filter((file) => file.startsWith(normalizedPrefix));
        }

        return files;
    }

    /**
     * Copy a file from oldPath to newPath.
     */
    async copy(oldPath: string, newPath: string): Promise<void> {
        const sourcePath = this.getFullPath(oldPath);

        if (!(await exists(sourcePath))) {
            throw new Error(`Source file ${oldPath} not found`);
        }

        const content = await readFile(sourcePath);
        await this.write(newPath, content);
    }

    /**
     * Get the root directory path.
     */
    get root(): string {
        return this.rootDirectory;
    }
}
