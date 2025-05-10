# BucketFS

A simple file system abstraction that supports multiple cloud storage providers like Amazon S3, Cloudflare R2, Google
Cloud Storage, and DigitalOcean Spaces. BucketFS provides a interface for working with different cloud storage services,
making it easy to switch between providers or acting as a bridge between providers without changing your application
code.

Can also be used to persist storage in serverless environments (e.g., Deno Deploy or Cloudflare Workers)

## Features

- Support for multiple storage providers (Amazon S3, Cloudflare R2, Google Cloud Storage, DigitalOcean Spaces)
- Simple and consistent API for file operations
- TypeScript support with full type definitions
- Easy provider switching without code changes

**Important Note on Costs:** Using BucketFS involves interacting with third-party cloud storage providers (Amazon S3, Cloudflare R2, Google Cloud Storage, DigitalOcean Spaces). These providers typically charge for storage, data transfer, and operations. While most providers offer a free tier, it is the user's responsibility to understand and monitor the pricing of their chosen provider to avoid unexpected costs.

## Installation

See JSR package page for information on how to add the library to your code base.

## Quick Start

```typescript
import { initBucket, readFile, writeFile } from "@pinta365/bucketfs";

// Initialize with Amazon S3
await initBucket({
    provider: "aws-s3",
    bucketName: "my-bucket",
    region: "us-east-1",
    credentials: {
        accessKeyId: "your-access-key",
        secretAccessKey: "your-secret-key",
    },
});

// Write a file
await writeFile("test.txt", "Hello, World!");

// Read a file
const content = await readFile("test.txt");
console.log(content); // "Hello, World!"
```

## Supported Providers

### Amazon S3

```typescript
await initBucket({
    provider: "aws-s3",
    bucketName: "my-bucket",
    region: "us-east-1",
    credentials: {
        accessKeyId: "your-access-key",
        secretAccessKey: "your-secret-key",
    },
});
```

### Cloudflare R2

```typescript
await initBucket({
    provider: "cf-r2",
    bucketName: "my-bucket",
    accountId: "YOUR_ACCOUNT_ID",
    credentials: {
        accessKeyId: "your-access-key",
        secretAccessKey: "your-secret-key",
    },
});
```

### Google Cloud Storage

```typescript
await initBucket({
    provider: "gcs",
    bucketName: "my-bucket",
    projectId: "your-project-id",
    credentials: {
        clientEmail: "your-service-account",
        privateKey: "your-private-key",
    },
});
```

### DigitalOcean Spaces

```typescript
await initBucket({
    provider: "do-spaces",
    bucketName: "my-bucket",
    region: "nyc3",
    credentials: {
        accessKeyId: "your-access-key",
        secretAccessKey: "your-secret-key",
    },
});
```

## API Reference

### Configuration

```typescript
interface BucketConfig {
    provider: "aws-s3" | "cf-r2" | "gcs" | "do-spaces";
    bucketName: string;
    region?: string; // Required for AWS S3 and DigitalOcean Spaces
    accountId?: string; // Required for Cloudflare R2
    projectId?: string; // Required for Google Cloud Storage
    credentials: {
        accessKeyId: string; // Required for AWS S3, Cloudflare R2, and DigitalOcean Spaces
        secretAccessKey: string; // Required for AWS S3, Cloudflare R2, and DigitalOcean Spaces
        clientEmail?: string; // Required for Google Cloud Storage
        privateKey?: string; // Required for Google Cloud Storage
    };
}
```

### Core Functions

#### `initBucket(config: BucketConfig, name?: string): string`

Initialize a bucket with the specified configuration. Optionally provides a custom `name` for the bucket instance,
allowing you to manage multiple buckets simultaneously. Returns the name of the initialized bucket instance.

#### `getBucket(name?: string): BucketInstance`

Get a specific bucket instance by its `name`. If no name is provided, it returns the first initialized bucket instance.
Throws an error if the bucket instance doesn't exist.

#### `resetBucket(name?: string): void`

Reset a specific bucket instance identified by its `name`. If no name is provided, all active bucket instances are
reset.

#### `listBuckets(): string[]`

List the names of all currently active bucket instances. Returns an array of strings.

### File Operations

#### `writeFile(path: string, content: string | Uint8Array, bucketName?: string): Promise<void>`

Write content to a file at the specified `path` in the bucket. The `content` can be a string or a `Uint8Array`. An
optional `bucketName` can be provided to write to a specific initialized bucket instance.

#### `readFile(path: string, bucketName?: string): Promise<string | null>`

Read content from a file at the specified `path` in the bucket. Returns the file content as a string. Returns `null` if
the file does not exist at the given path. Throws an error for other read operation failures. An optional `bucketName`
can be provided to read from a specific initialized bucket instance.

#### `deleteFile(path: string, bucketName?: string): Promise<void>`

Delete a file at the specified `path` from the bucket. An optional `bucketName` can be provided to delete from a
specific initialized bucket instance.

#### `moveFile(oldPath: string, newPath: string, bucketName?: string): Promise<void>`

Move or rename a file in the bucket. This operation moves a file from an `oldPath` to a `newPath`. If the new path
specifies a different directory, the file is moved. If the new path specifies the same directory but a different name,
the file is renamed. If both the directory and name change, the file is moved and renamed. This is typically implemented
as a copy to the new path followed by a deletion of the old path. An optional `bucketName` can be provided to perform
the operation on a specific initialized bucket instance.

#### `listFiles(prefix?: string, bucketName?: string): Promise<string[]>`

List files in the bucket. Returns an array of file paths. An optional `prefix` can be provided to list files within a
specific virtual directory (e.g., `"my-folder/"`). An optional `bucketName` can be provided to list files from a
specific initialized bucket instance.

#### `fileExists(path: string, bucketName?: string): Promise<boolean>`

Check if a file exists at the specified `path` in the bucket. Returns `true` if the file exists, `false` otherwise.
Throws an error if the check operation fails (other than the file not being found). An optional `bucketName` can be
provided to check within a specific initialized bucket instance.

## Examples

See the `/examples`-folder.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open Issues.

## License

MIT
