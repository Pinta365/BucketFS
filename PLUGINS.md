# Plugin System Guide

This document explains the BucketFS plugin architecture and how to create new storage provider plugins.

## Overview

BucketFS uses a plugin-based architecture where each storage provider (AWS S3, Google Cloud Storage, Memory, etc.) is
implemented as an isolated plugin. Plugins are lazy-loaded only when their provider is used, ensuring dependencies
aren't loaded unless needed.

## Architecture

```
┌─────────────────┐
│   initBucket()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Plugin Registry │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Plugin │ (lazy-loaded)
    └────────┘
         │
         ▼
┌─────────────────┐
│ bucketCore.ts   │
│ (delegates to   │
│  plugin methods)│
└─────────────────┘
```

### Key Components

1. **`ProviderPlugin` Interface** (`src/plugin.ts`): Defines the contract all plugins must implement
2. **`PluginRegistry`** (`src/plugin.ts`): Manages plugin registration and lazy loading
3. **Plugin Implementations** (`src/plugins/`): Individual provider plugins
4. **Core Operations** (`src/bucketCore.ts`): Delegates all operations to plugin methods

## ProviderPlugin Interface

All plugins must implement the `ProviderPlugin` interface, which defines these methods:

```typescript
interface ProviderPlugin {
    write(bucketName: string, path: string, content: string | Uint8Array): Promise<void>;
    read(bucketName: string, path: string): Promise<string | null>;
    readBuffer(bucketName: string, path: string): Promise<Uint8Array | null>;
    delete(bucketName: string, path: string): Promise<void>;
    move(bucketName: string, oldPath: string, newPath: string): Promise<void>;
    list(bucketName: string, prefix?: string): Promise<string[]>;
    exists(bucketName: string, path: string): Promise<boolean>;
    checkAuth(bucketName: string): Promise<boolean>;
}
```

### Method Descriptions

- **`write`**: Write content (string or binary) to a file at the specified path
- **`read`**: Read file content as a UTF-8 string, returns `null` if file doesn't exist
- **`readBuffer`**: Read file content as binary (`Uint8Array`), returns `null` if file doesn't exist
- **`delete`**: Delete a file at the specified path
- **`move`**: Move/rename a file from `oldPath` to `newPath` (typically implemented as copy + delete)
- **`list`**: List all file paths, optionally filtered by `prefix` (directory path)
- **`exists`**: Check if a file exists at the specified path
- **`checkAuth`**: Verify authentication/connection to the storage service

## Plugin Registration

Plugins are automatically discovered and loaded when needed. The registry:

1. Checks if a plugin factory is already registered
2. If not, dynamically imports the plugin from `src/plugins/{provider}/index.ts`
3. Expects the plugin module to export a `createPlugin` function
4. Caches plugin instances per `provider:bucketName` combination

## Creating a New Plugin

Follow these steps to add a new storage provider:

### Step 1: Create Plugin Directory

Create a new directory under `src/plugins/` with your provider name:

```
src/plugins/
  └── your-provider/
      └── index.ts
```

### Step 2: Implement the Plugin Class

Create a class that implements `ProviderPlugin`:

```typescript
import type { ProviderPlugin } from "../../plugin.ts";

class YourProviderPlugin implements ProviderPlugin {
    private client: YourSDKClient;

    constructor(client: YourSDKClient) {
        this.client = client;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        // Implement write logic
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        // Implement read logic
    }

    // ... implement all other methods
}
```

### Step 3: Create the Factory Function

Export a `createPlugin` function that:

1. Validates required configuration
2. Initializes the SDK client
3. Returns a new plugin instance

```typescript
export async function createPlugin(config: {
    provider: string;
    bucketName: string;
    [key: string]: unknown;
}): Promise<ProviderPlugin> {
    // Validate required fields
    if (!config.yourRequiredField) {
        throw new Error("Your required field is missing");
    }

    // Lazy load SDK (if using dynamic imports)
    const { YourSDKClient } = await import("your-sdk"); // Uses import map from deno.json

    // Initialize client
    const client = new YourSDKClient({
        // ... configuration
    });

    // Return plugin instance
    return new YourProviderPlugin(client);
}
```

### Step 4: Add Dependencies

If your plugin uses external dependencies:

1. Add them to `deno.json` under `imports`:

```json
{
    "imports": {
        "your-sdk": "npm:your-sdk@^1.0.0"
    }
}
```

2. Import using the import map key:

```typescript
import { YourSDKClient } from "your-sdk";
```

Or use dynamic imports for lazy loading:

```typescript
const { YourSDKClient } = await import("your-sdk");
```

### Step 5: Update Type Definitions

Add your provider to the `StorageProvider` type in `src/bucketConfig.ts`:

```typescript
export type StorageProvider =
    | "aws-s3"
    | "cf-r2"
    | "gcs"
    | "do-spaces"
    | "memory"
    | "fs"
    | "your-provider"; // Add your provider here
```

### Step 6: Update BucketConfig Interface

If your provider needs specific configuration fields, extend the `BucketConfig` interface:

```typescript
export interface BucketConfig {
    provider: StorageProvider;
    bucketName: string;
    // ... existing fields
    yourProviderField?: string; // Add your provider-specific fields
}
```

**Note**: The plugin's `createPlugin` function receives the full `BucketConfig` object and is responsible for extracting
and validating its own required fields. You don't need to add provider-specific validation in `bucketConfig.ts`.

## Plugin Examples

### Simple Plugin (Memory)

The memory plugin is the simplest example - no external dependencies, no configuration needed:

```typescript
// src/plugins/memory/index.ts
import type { ProviderPlugin } from "../../plugin.ts";
import { MemoryStorage } from "../../memoryStorage.ts";

class MemoryPlugin implements ProviderPlugin {
    private storage: MemoryStorage;

    constructor() {
        this.storage = new MemoryStorage();
    }

    write(_bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        this.storage.write(path, content);
        return Promise.resolve();
    }

    // ... other methods
}

export async function createPlugin(config: {
    provider: string;
    bucketName: string;
    [key: string]: unknown;
}): Promise<ProviderPlugin> {
    return new MemoryPlugin();
}
```

### Plugin with Configuration (Filesystem)

The filesystem plugin shows how to validate configuration:

```typescript
// src/plugins/fs/index.ts
export async function createPlugin(config: {
    provider: string;
    bucketName: string;
    rootDirectory?: string;
    [key: string]: unknown;
}): Promise<ProviderPlugin> {
    if (!config.rootDirectory) {
        throw new Error("Root directory is required for filesystem provider");
    }
    return new FSPlugin(config.rootDirectory);
}
```

### Plugin with SDK (AWS S3)

The AWS S3 plugin demonstrates:

- Using external SDKs
- Lazy loading SDK commands
- Handling SDK-specific errors

```typescript
// src/plugins/aws-s3/index.ts
import type { ProviderPlugin } from "../../plugin.ts";
import type { S3Client } from "@aws-sdk/client-s3";

class AWSS3Plugin implements ProviderPlugin {
    private client: S3Client;

    constructor(client: S3Client) {
        this.client = client;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: path,
            Body: content,
        });
        await this.client.send(command);
    }

    // ... other methods
}

export async function createPlugin(config: {
    provider: string;
    bucketName: string;
    region?: string;
    credentials?: {
        accessKeyId?: string;
        secretAccessKey?: string;
    };
    [key: string]: unknown;
}): Promise<ProviderPlugin> {
    if (!config.region) {
        throw new Error("Region is required for AWS S3 provider");
    }
    if (!config.credentials?.accessKeyId || !config.credentials?.secretAccessKey) {
        throw new Error("Access key and secret key are required for AWS S3 provider");
    }

    const { S3Client } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
        region: config.region,
        credentials: {
            accessKeyId: config.credentials.accessKeyId,
            secretAccessKey: config.credentials.secretAccessKey,
        },
    });
    return new AWSS3Plugin(client);
}
```

## Best Practices

### 1. Configuration Validation

Always validate required configuration in your `createPlugin` function:

```typescript
export async function createPlugin(config: YourPluginConfig): Promise<ProviderPlugin> {
    if (!config.requiredField) {
        throw new Error("Required field is missing");
    }
    // ...
}
```

### 2. Error Handling

Handle provider-specific errors appropriately:

```typescript
async checkAuth(bucketName: string): Promise<boolean> {
    try {
        // Test connection
        return true;
    } catch (error) {
        if (error && typeof error === "object") {
            if ("name" in error && error.name === "Forbidden") {
                return false;
            }
            // Handle other error types
        }
        throw error;
    }
}
```

### 3. Unused Parameters

If your plugin doesn't use the `bucketName` parameter (e.g., memory or filesystem plugins), prefix it with `_`:

```typescript
write(_bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
    // bucketName not used
}
```

### 4. Async vs Sync Operations

- If your operations are synchronous, return `Promise.resolve()` instead of using `async`:

```typescript
write(_bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
    this.storage.write(path, content);
    return Promise.resolve();
}
```

- If your operations are asynchronous, use `async/await`:

```typescript
async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
    await this.client.upload(path, content);
}
```

### 5. Lazy Loading

For large SDKs, consider lazy loading commands/classes:

```typescript
private async getSDKCommands() {
    if (!this.sdkCommands) {
        const sdkModule = await import("your-sdk");
        this.sdkCommands = {
            Command1: sdkModule.Command1,
            Command2: sdkModule.Command2,
        };
    }
    return this.sdkCommands;
}
```

### 6. Type Safety

Use TypeScript types for better type safety:

```typescript
import type { ProviderPlugin } from "../../plugin.ts";
import type { YourSDKClient } from "your-sdk";
```

## Testing Your Plugin

Create a test file in the `test/` directory:

```typescript
// test/your_provider_test.ts
import { assertEquals } from "@std/assert";
import { deleteFile, fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

Deno.test("Your Provider - Basic Operations", async () => {
    await initBucket({
        provider: "your-provider",
        bucketName: "test-bucket",
        // ... your configuration
    });

    await writeFile("test.txt", "Hello World");
    assertEquals(await fileExists("test.txt"), true);
    assertEquals(await readFile("test.txt"), "Hello World");

    const files = await listFiles();
    assertEquals(files.includes("test.txt"), true);

    await deleteFile("test.txt");
    assertEquals(await fileExists("test.txt"), false);
});
```

## Summary

To add a new provider plugin:

1. ✅ Create `src/plugins/{provider}/index.ts`
2. ✅ Implement `ProviderPlugin` interface
3. ✅ Export `createPlugin` function
4. ✅ Add dependencies to `deno.json` (if needed)
5. ✅ Update `StorageProvider` type in `bucketConfig.ts`
6. ✅ Add configuration fields to `BucketConfig` (if needed)
7. ✅ Write tests
8. ✅ Update README.md with usage examples

The plugin system handles the rest automatically - your plugin will be discovered and loaded when users initialize a
bucket with your provider!
