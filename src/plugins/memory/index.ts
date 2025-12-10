import type { ProviderPlugin } from "../../plugin.ts";
import { MemoryStorage } from "../../memoryStorage.ts";

/**
 * Memory storage plugin implementation.
 * Stores all data in memory only (no persistence).
 */
class MemoryPlugin implements ProviderPlugin {
    private storage: MemoryStorage;

    constructor() {
        this.storage = new MemoryStorage();
    }

    write(_bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        this.storage.write(path, content);
        return Promise.resolve();
    }

    read(_bucketName: string, path: string): Promise<string | null> {
        const content = this.storage.read(path);
        if (!content) {
            return Promise.resolve(null);
        }
        return Promise.resolve(new TextDecoder().decode(content));
    }

    readBuffer(_bucketName: string, path: string): Promise<Uint8Array | null> {
        return Promise.resolve(this.storage.read(path));
    }

    delete(_bucketName: string, path: string): Promise<void> {
        this.storage.delete(path);
        return Promise.resolve();
    }

    move(_bucketName: string, oldPath: string, newPath: string): Promise<void> {
        this.storage.copy(oldPath, newPath);
        this.storage.delete(oldPath);
        return Promise.resolve();
    }

    list(_bucketName: string, prefix?: string): Promise<string[]> {
        return Promise.resolve(this.storage.list(prefix));
    }

    exists(_bucketName: string, path: string): Promise<boolean> {
        return Promise.resolve(this.storage.exists(path));
    }

    checkAuth(_bucketName: string): Promise<boolean> {
        return Promise.resolve(true);
    }
}

/**
 * Create a memory storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new MemoryPlugin instance
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
    return new MemoryPlugin();
}
