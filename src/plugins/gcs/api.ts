/**
 * Google Cloud Storage JSON API client.
 * Direct REST API calls
 */

import { getAccessToken, type ServiceAccountCredentials } from "./auth.ts";

/**
 * GCS API base URL
 */
const GCS_API_BASE = "https://storage.googleapis.com/storage/v1";

/**
 * GCS upload base URL
 */
const GCS_UPLOAD_BASE = "https://storage.googleapis.com/upload/storage/v1";

/**
 * Options for API requests
 */
export interface ApiRequestOptions {
    method?: string;
    body?: BodyInit;
    queryParams?: Record<string, string>;
}

/**
 * Make a request to the GCS API.
 */
async function apiRequest<T>(
    credentials: ServiceAccountCredentials,
    endpoint: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { method = "GET", body, queryParams } = options;

    const accessToken = await getAccessToken(credentials);

    const url = new URL(endpoint);
    if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
            url.searchParams.set(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        method,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": body
                ? (typeof body === "string" ? "text/plain" : "application/octet-stream")
                : "application/json",
        },
        body: body as BodyInit | undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorData: unknown;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            errorData = errorText;
        }

        const error = errorData as { error?: { message?: string; code?: number } };
        if (response.status === 404) {
            throw new Error(`File not found: ${error.error?.message || errorText}`);
        }
        throw new Error(
            `GCS API error: ${response.status} ${response.statusText} - ${error.error?.message || errorText}`,
        );
    }

    if (response.status === 204 || !response.body) {
        return {} as T;
    }

    return await response.json() as T;
}

/**
 * Upload an object to GCS
 */
export async function uploadObject(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    objectName: string,
    content: string | Uint8Array,
): Promise<void> {
    const contentBytes = typeof content === "string" ? new TextEncoder().encode(content) : content;

    await apiRequest(
        credentials,
        `${GCS_UPLOAD_BASE}/b/${bucketName}/o`,
        {
            method: "POST",
            queryParams: {
                uploadType: "media",
                name: objectName,
            },
            body: contentBytes as BodyInit,
        },
    );
}

/**
 * Download an object from GCS as string
 */
export async function downloadObjectAsString(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    objectName: string,
): Promise<string | null> {
    try {
        const accessToken = await getAccessToken(credentials);
        const url = new URL(
            `${GCS_API_BASE}/b/${bucketName}/o/${encodeURIComponent(objectName)}`,
        );
        url.searchParams.set("alt", "media");

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            const errorText = await response.text();
            throw new Error(`GCS API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new TextDecoder().decode(new Uint8Array(arrayBuffer));
    } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
            return null;
        }
        throw error;
    }
}

/**
 * Download an object from GCS as buffer
 */
export async function downloadObjectAsBuffer(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    objectName: string,
): Promise<Uint8Array | null> {
    try {
        const accessToken = await getAccessToken(credentials);
        const url = new URL(
            `${GCS_API_BASE}/b/${bucketName}/o/${encodeURIComponent(objectName)}`,
        );
        url.searchParams.set("alt", "media");

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            const errorText = await response.text();
            throw new Error(`GCS API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
            return null;
        }
        throw error;
    }
}

/**
 * Delete an object from GCS
 */
export async function deleteObject(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    objectName: string,
): Promise<void> {
    await apiRequest(
        credentials,
        `${GCS_API_BASE}/b/${bucketName}/o/${encodeURIComponent(objectName)}`,
        {
            method: "DELETE",
        },
    );
}

/**
 * Copy an object in GCS
 */
export async function copyObject(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    sourceObjectName: string,
    destinationObjectName: string,
): Promise<void> {
    await apiRequest(
        credentials,
        `${GCS_API_BASE}/b/${bucketName}/o/${encodeURIComponent(sourceObjectName)}/copyTo/b/${bucketName}/o/${
            encodeURIComponent(destinationObjectName)
        }`,
        {
            method: "POST",
        },
    );
}

/**
 * List objects in a bucket
 */
export async function listObjects(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    prefix?: string,
): Promise<string[]> {
    const queryParams: Record<string, string> = {};
    if (prefix) {
        queryParams.prefix = prefix;
    }

    const response = await apiRequest<{ items?: Array<{ name: string }> }>(
        credentials,
        `${GCS_API_BASE}/b/${bucketName}/o`,
        {
            method: "GET",
            queryParams,
        },
    );

    return (response.items || []).map((item) => item.name);
}

/**
 * Check if an object exists in GCS
 */
export async function objectExists(
    credentials: ServiceAccountCredentials,
    bucketName: string,
    objectName: string,
): Promise<boolean> {
    try {
        await apiRequest(
            credentials,
            `${GCS_API_BASE}/b/${bucketName}/o/${encodeURIComponent(objectName)}`,
            {
                method: "GET",
                queryParams: {
                    fields: "name",
                },
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
 * Get bucket metadata (for authentication check)
 */
export async function getBucketMetadata(
    credentials: ServiceAccountCredentials,
    bucketName: string,
): Promise<void> {
    await apiRequest(
        credentials,
        `${GCS_API_BASE}/b/${bucketName}`,
        {
            method: "GET",
            queryParams: {
                fields: "name",
            },
        },
    );
}
