/**
 * In-memory storage implementation for memory bucket provider.
 * Uses a simple Map to store file contents.
 */
export class MemoryStorage {
    private files: Map<string, Uint8Array>;

    constructor() {
        this.files = new Map();
    }

    /**
     * Write content to a file path.
     */
    write(path: string, content: string | Uint8Array): void {
        const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
        this.files.set(path, data);
    }

    /**
     * Read content from a file path.
     */
    read(path: string): Uint8Array | null {
        return this.files.get(path) || null;
    }

    /**
     * Delete a file at the given path.
     */
    delete(path: string): void {
        this.files.delete(path);
    }

    /**
     * Check if a file exists at the given path.
     */
    exists(path: string): boolean {
        return this.files.has(path);
    }

    /**
     * List all file paths, optionally filtered by prefix.
     */
    list(prefix?: string): string[] {
        const allPaths = Array.from(this.files.keys());
        if (!prefix) {
            return allPaths;
        }
        return allPaths.filter((path) => path.startsWith(prefix));
    }

    /**
     * Copy a file from oldPath to newPath.
     */
    copy(oldPath: string, newPath: string): void {
        const content = this.files.get(oldPath);
        if (!content) {
            throw new Error(`Source file ${oldPath} not found`);
        }
        // Create a copy of the Uint8Array
        this.files.set(newPath, new Uint8Array(content));
    }

    /**
     * Clear all files from storage.
     */
    clear(): void {
        this.files.clear();
    }

    /**
     * Get the number of files stored.
     */
    get size(): number {
        return this.files.size;
    }
}
