import type { ProviderPlugin } from "../../plugin.ts";
import { FSStorage } from "./storage.ts";
import { exists, isDir } from "./fsCompat.ts";

/**
 * Filesystem storage plugin implementation.
 * Stores files on the local filesystem using cross-runtime compatible APIs.
 */
class FSPlugin implements ProviderPlugin {
    private storage: FSStorage;

    constructor(rootDirectory: string) {
        this.storage = new FSStorage(rootDirectory);
    }

    async write(_bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        await this.storage.write(path, content);
    }

    async read(_bucketName: string, path: string): Promise<string | null> {
        const content = await this.storage.read(path);
        if (!content) {
            return null;
        }
        return new TextDecoder().decode(content);
    }

    async readBuffer(_bucketName: string, path: string): Promise<Uint8Array | null> {
        return await this.storage.read(path);
    }

    async delete(_bucketName: string, path: string): Promise<void> {
        await this.storage.delete(path);
    }

    async move(_bucketName: string, oldPath: string, newPath: string): Promise<void> {
        await this.storage.copy(oldPath, newPath);
        await this.storage.delete(oldPath);
    }

    async list(_bucketName: string, prefix?: string): Promise<string[]> {
        return await this.storage.list(prefix);
    }

    async exists(_bucketName: string, path: string): Promise<boolean> {
        return await this.storage.exists(path);
    }

    async checkAuth(_bucketName: string): Promise<boolean> {
        const rootPath = this.storage.root;
        return (await exists(rootPath)) && (await isDir(rootPath));
    }
}

/**
 * Create a filesystem storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new FSPlugin instance
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
    if (!config.rootDirectory) {
        throw new Error("Root directory is required for filesystem provider");
    }
    return new FSPlugin(config.rootDirectory);
}
