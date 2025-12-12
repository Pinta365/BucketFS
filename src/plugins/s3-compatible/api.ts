/**
 * S3-compatible REST API client.
 * Direct HTTP calls
 * Works with AWS S3, Cloudflare R2, and DigitalOcean Spaces.
 */

import { type AWSCredentials, signRequest } from "./sigv4.ts";

/**
 * S3-compatible endpoint configuration
 */
export interface S3EndpointConfig {
    endpoint: string;
    region: string;
    forcePathStyle?: boolean;
}

/**
 * Options for S3 API requests
 */
export interface S3RequestOptions {
    method?: string;
    body?: Uint8Array | string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
}

/**
 * Make a signed request to S3-compatible API
 */
async function s3Request<T>(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
    options: S3RequestOptions = {},
): Promise<T> {
    const { method = "GET", body, headers = {}, queryParams = {} } = options;

    // Build URL
    let url: URL;
    if (
        config.forcePathStyle || endpoint.includes("digitaloceanspaces.com") ||
        endpoint.includes("r2.cloudflarestorage.com")
    ) {
        // Path-style: https://s3.amazonaws.com/bucket/key
        url = new URL(`${endpoint}/${bucketName}/${objectKey}`);
    } else {
        // Virtual-hosted-style: https://bucket.s3.region.amazonaws.com/key
        url = new URL(`${endpoint}/${objectKey}`);
        url.hostname = `${bucketName}.${url.hostname}`;
    }

    // Add query parameters
    for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
    }

    // Prepare headers
    const requestHeaders: Record<string, string> = {
        ...headers,
    };

    // Calculate payload hash for x-amz-content-sha256 header
    let payloadHash: string;
    if (body) {
        const bodyBytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
        const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bodyBytes));
        payloadHash = Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    } else {
        payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // Empty string hash to avoid unnecessary computation
    }
    requestHeaders["x-amz-content-sha256"] = payloadHash;

    // Sign request
    const signedHeaders = await signRequest(
        {
            method,
            url,
            headers: requestHeaders,
            body,
        },
        credentials,
        config.region,
        "s3",
    );

    // Make request
    const response = await fetch(url.toString(), {
        method,
        headers: signedHeaders,
        body: body as BodyInit | undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorData: unknown;
        try {
            // Try to parse XML error response
            const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
            const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
            if (codeMatch && messageMatch) {
                errorData = {
                    Code: codeMatch[1],
                    Message: messageMatch[1],
                };
            } else {
                // Try JSON
                errorData = JSON.parse(errorText);
            }
        } catch {
            errorData = errorText;
        }

        const error = errorData as { Code?: string; Message?: string };
        const errorCode = error.Code || "";
        const errorMessage = error.Message || errorText;

        // Only treat as "file not found" if it's actually a NoSuchKey error, not NoSuchBucket
        if (response.status === 404 && errorCode === "NoSuchKey") {
            throw new Error(`File not found: ${errorMessage}`);
        }

        // For other errors, throw with the actual error code and message
        throw new Error(
            `S3-compatible API error: ${response.status} ${response.statusText}${
                errorCode ? ` [${errorCode}]` : ""
            } - ${errorMessage}`,
        );
    }

    if (response.status === 204 || !response.body) {
        return {} as T;
    }

    // For binary responses, return as Uint8Array
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("application/xml") && !contentType.includes("application/json")) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer) as T;
    }

    return await response.text() as T;
}

/**
 * Upload an object to S3-compatible storage
 */
export async function uploadObject(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    content: string | Uint8Array,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<void> {
    const contentBytes = typeof content === "string" ? new TextEncoder().encode(content) : content;

    await s3Request(
        endpoint,
        bucketName,
        objectKey,
        credentials,
        config,
        {
            method: "PUT",
            body: contentBytes,
        },
    );
}

/**
 * Download an object from S3-compatible storage as string
 */
export async function downloadObjectAsString(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<string | null> {
    try {
        const response = await s3Request<string | Uint8Array>(
            endpoint,
            bucketName,
            objectKey,
            credentials,
            config,
            {
                method: "GET",
            },
        );

        if (response instanceof Uint8Array) {
            return new TextDecoder().decode(response);
        }
        return response;
    } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
            return null;
        }
        throw error;
    }
}

/**
 * Download an object from S3-compatible storage as buffer
 */
export async function downloadObjectAsBuffer(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<Uint8Array | null> {
    try {
        const response = await s3Request<Uint8Array | string>(
            endpoint,
            bucketName,
            objectKey,
            credentials,
            config,
            {
                method: "GET",
            },
        );

        if (response instanceof Uint8Array) {
            return response;
        }
        return new TextEncoder().encode(response);
    } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
            return null;
        }
        throw error;
    }
}

/**
 * Delete an object from S3-compatible storage
 */
export async function deleteObject(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<void> {
    await s3Request(
        endpoint,
        bucketName,
        objectKey,
        credentials,
        config,
        {
            method: "DELETE",
        },
    );
}

/**
 * Copy an object in S3-compatible storage
 */
export async function copyObject(
    endpoint: string,
    bucketName: string,
    sourceKey: string,
    destinationKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<void> {
    const copySource = `${bucketName}/${sourceKey}`;
    await s3Request(
        endpoint,
        bucketName,
        destinationKey,
        credentials,
        config,
        {
            method: "PUT",
            headers: {
                "x-amz-copy-source": copySource,
            },
        },
    );
}

/**
 * List objects in a bucket
 */
export async function listObjects(
    endpoint: string,
    bucketName: string,
    prefix: string | undefined,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<string[]> {
    const queryParams: Record<string, string> = {
        "list-type": "2",
    };
    if (prefix) {
        queryParams.prefix = prefix;
    }

    const response = await s3Request<string>(
        endpoint,
        bucketName,
        "",
        credentials,
        config,
        {
            method: "GET",
            queryParams,
        },
    );

    // Parse XML response
    const keyRegex = /<Key>(.*?)<\/Key>/g;
    const result: string[] = [];
    let match;
    while ((match = keyRegex.exec(response)) !== null) {
        if (match[1]) {
            result.push(match[1]);
        }
    }
    return result;
}

/**
 * Check if an object exists
 */
export async function objectExists(
    endpoint: string,
    bucketName: string,
    objectKey: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<boolean> {
    try {
        await s3Request(
            endpoint,
            bucketName,
            objectKey,
            credentials,
            config,
            {
                method: "HEAD",
            },
        );
        return true;
    } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
            return false;
        }
        throw error;
    }
}

/**
 * Check bucket access (for authentication)
 */
export async function checkBucketAccess(
    endpoint: string,
    bucketName: string,
    credentials: AWSCredentials,
    config: S3EndpointConfig,
): Promise<boolean> {
    try {
        await s3Request(
            endpoint,
            bucketName,
            "",
            credentials,
            config,
            {
                method: "HEAD",
                queryParams: {},
            },
        );
        return true;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("403") || error.message.includes("Forbidden")) {
                return false;
            }
            if (error.message.includes("401") || error.message.includes("Unauthorized")) {
                return false;
            }
        }
        return false;
    }
}
