# BucketFS

A flexible file system abstraction that supports multiple cloud storage providers like AWS S3, Cloudflare R2, and Google
Cloud Storage. BucketFS provides a unified interface for working with different cloud storage services, making it easy
to switch between providers or acting as a bridge between providers without changing your application code.

Can also be used to persist storage in serverless environments (e.g., Deno Deploy or Cloudflare Workers)

## Features

- Support for multiple storage providers (AWS S3, Cloudflare R2, Google Cloud Storage)
- Simple and consistent API for file operations
- TypeScript support with full type definitions
- Easy provider switching without code changes

## Installation

See JSR package page for information on how to add the library to your code base.

## Quick Start

```typescript
import { initBucket, readFile, writeFile } from "@pinta365/bucketfs";

// Initialize with AWS S3
await initBucket({
    provider: "s3",
    bucketName: "my-bucket",
    region: "us-east-1",
    credentials: {
        accessKeyId: "YOUR_ACCESS_KEY",
        secretAccessKey: "YOUR_SECRET_KEY",
    },
});

// Write a file
await writeFile("test.txt", "Hello, World!");

// Read a file
const content = await readFile("test.txt");
console.log(content); // "Hello, World!"
```

## Supported Providers

### AWS S3

```typescript
await initBucket({
    provider: "s3",
    bucketName: "my-bucket",
    region: "us-east-1",
    credentials: {
        accessKeyId: "YOUR_ACCESS_KEY",
        secretAccessKey: "YOUR_SECRET_KEY",
    },
});
```

### Cloudflare R2

```typescript
await initBucket({
    provider: "r2",
    bucketName: "my-bucket",
    accountId: "YOUR_ACCOUNT_ID",
    credentials: {
        accessKeyId: "YOUR_ACCESS_KEY",
        secretAccessKey: "YOUR_SECRET_KEY",
    },
});
```

### Google Cloud Storage

```typescript
await initBucket({
    provider: "gcs",
    bucketName: "my-bucket",
    projectId: "YOUR_PROJECT_ID",
    credentials: {
        clientEmail: "YOUR_SERVICE_ACCOUNT_EMAIL",
        privateKey: "YOUR_PRIVATE_KEY",
    },
});
```

## API Reference

### Configuration

```typescript
interface BucketConfig {
    provider: "s3" | "r2" | "gcs";
    bucketName: string;
    region?: string; // Required for S3 provider
    accountId?: string; // Required for R2 provider
    projectId?: string; // Required for GCS provider
    credentials: {
        accessKeyId: string; // Required for S3 and R2
        secretAccessKey: string; // Required for S3 and R2
        clientEmail?: string; // Required for GCS
        privateKey?: string; // Required for GCS
    };
}
```

### Core Functions

#### `initBucket(config: BucketConfig): Promise<void>`

Initialize BucketFS with the specified configuration.

#### `getBucket(): BucketInstance`

Get the current BucketFS instance.

#### `resetBucket(): void`

Reset the BucketFS instance.

#### `listBuckets(): string[]`

List all active bucket instances.

### File Operations

#### `writeFile(key: string, content: string | Uint8Array): Promise<void>`

Write content to a file in the bucket.

#### `readFile(key: string): Promise<string>`

Read content from a file in the bucket. Throws an error if the file is not found.

#### `deleteFile(key: string): Promise<void>`

Delete a file from the bucket.

#### `listFiles(prefix?: string): Promise<string[]>`

List files in a directory in the bucket. Returns an array of file paths.

#### `fileExists(key: string): Promise<boolean>`

Check if a file exists in the bucket.

## Examples

See the `/examples`-folder.
More examples will be added soon™

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open Issues.

## License

MIT
