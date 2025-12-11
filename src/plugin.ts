/**
 * Plugin interface for storage providers.
 * All storage provider plugins must implement this interface.
 */
export interface ProviderPlugin {
    /**
     * Write content to a file.
     * @param bucketName The name of the bucket
     * @param path Path to the file
     * @param content Content to write (string or Uint8Array)
     */
    write(bucketName: string, path: string, content: string | Uint8Array): Promise<void>;

    /**
     * Read content from a file as a string.
     * @param bucketName The name of the bucket
     * @param path Path to the file
     * @returns File content as string, or null if the file doesn't exist
     */
    read(bucketName: string, path: string): Promise<string | null>;

    /**
     * Read content from a file as binary data.
     * @param bucketName The name of the bucket
     * @param path Path to the file
     * @returns File content as Uint8Array, or null if the file doesn't exist
     */
    readBuffer(bucketName: string, path: string): Promise<Uint8Array | null>;

    /**
     * Delete a file.
     * @param bucketName The name of the bucket
     * @param path Path to the file
     */
    delete(bucketName: string, path: string): Promise<void>;

    /**
     * Move or rename a file.
     * @param bucketName The name of the bucket
     * @param oldPath The current path of the file
     * @param newPath The new path for the file
     */
    move(bucketName: string, oldPath: string, newPath: string): Promise<void>;

    /**
     * List files in a directory.
     * @param bucketName The name of the bucket
     * @param prefix Directory prefix to list files from (optional)
     * @returns Array of file paths
     */
    list(bucketName: string, prefix?: string): Promise<string[]>;

    /**
     * Check if a file exists.
     * @param bucketName The name of the bucket
     * @param path Path to the file
     * @returns True if file exists, false otherwise
     */
    exists(bucketName: string, path: string): Promise<boolean>;

    /**
     * Check authentication/connection to the bucket.
     * @param bucketName The name of the bucket
     * @returns True if authentication succeeds, false otherwise
     */
    checkAuth(bucketName: string): Promise<boolean>;
}

/**
 * Factory function type for creating plugin instances.
 * Plugins receive the full BucketConfig and are responsible for extracting
 * and validating their own required fields.
 */
export type PluginFactory = (config: {
    provider: string;
    bucketName: string;
    [key: string]: unknown;
}) => Promise<ProviderPlugin>;

/**
 * Plugin registry for managing storage provider plugins.
 * Handles lazy loading of plugins only when they are needed.
 */
class PluginRegistry {
    private plugins = new Map<string, PluginFactory>();
    private pluginInstances = new Map<string, ProviderPlugin>();

    /**
     * Register a plugin factory for a provider.
     * @param provider The provider name
     * @param factory The factory function that creates the plugin instance
     */
    register(provider: string, factory: PluginFactory): void {
        this.plugins.set(provider, factory);
    }

    /**
     * Get or create a plugin instance for a provider.
     * @param config The full bucket configuration
     * @returns The plugin instance
     */
    async getPlugin(config: {
        provider: string;
        bucketName: string;
        [key: string]: unknown;
    }): Promise<ProviderPlugin> {
        const { provider, bucketName } = config;
        const instanceKey = `${provider}:${bucketName}`;

        if (this.pluginInstances.has(instanceKey)) {
            return this.pluginInstances.get(instanceKey)!;
        }

        const factory = this.plugins.get(provider);
        if (!factory) {
            await this.loadPlugin(provider);
            const loadedFactory = this.plugins.get(provider);
            if (!loadedFactory) {
                throw new Error(`Plugin for provider "${provider}" not found`);
            }
            const instance = await loadedFactory(config);
            this.pluginInstances.set(instanceKey, instance);
            return instance;
        }

        const instance = await factory(config);
        this.pluginInstances.set(instanceKey, instance);
        return instance;
    }

    /**
     * Dynamically load a plugin module.
     * @param provider The provider name
     */
    private async loadPlugin(provider: string): Promise<void> {
        try {
            const pluginModule = await import(`./plugins/${provider}/index.ts`);
            if (pluginModule.createPlugin && typeof pluginModule.createPlugin === "function") {
                this.register(provider, pluginModule.createPlugin);
            } else {
                throw new Error(`Plugin "${provider}" does not export a createPlugin function`);
            }
        } catch (error) {
            throw new Error(`Failed to load plugin for provider "${provider}": ${error}`);
        }
    }

    /**
     * Check if a plugin is registered.
     * @param provider The provider name
     * @returns True if the plugin is registered
     */
    isRegistered(provider: string): boolean {
        return this.plugins.has(provider);
    }

    /**
     * Clear all plugin instances (useful for testing).
     */
    clearInstances(): void {
        this.pluginInstances.clear();
    }
}

/**
 * Global plugin registry instance.
 */
export const pluginRegistry = new PluginRegistry();
