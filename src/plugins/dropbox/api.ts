/**
 * Dropbox API client for direct REST API calls.
 */

/**
 * API endpoint constants
 */
export const API_ENDPOINTS = {
    FILES_UPLOAD: "https://content.dropboxapi.com/2/files/upload",
    FILES_DOWNLOAD: "https://content.dropboxapi.com/2/files/download",
    FILES_DELETE: "https://api.dropboxapi.com/2/files/delete_v2",
    FILES_MOVE: "https://api.dropboxapi.com/2/files/move_v2",
    FILES_LIST_FOLDER: "https://api.dropboxapi.com/2/files/list_folder",
    FILES_LIST_FOLDER_CONTINUE: "https://api.dropboxapi.com/2/files/list_folder/continue",
    FILES_GET_METADATA: "https://api.dropboxapi.com/2/files/get_metadata",
    USERS_GET_CURRENT_ACCOUNT: "https://api.dropboxapi.com/2/users/get_current_account",
} as const;

/**
 * Options for API requests
 */
export interface ApiRequestOptions {
    method?: string;
    body?: BodyInit;
    apiArg?: unknown;
}

/**
 * Make a request to the Dropbox API.
 * @param accessToken The Dropbox access token
 * @param endpoint The API endpoint URL
 * @param options Request options
 * @returns The response data
 */
export async function apiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { method = "POST", body, apiArg } = options;

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${accessToken}`,
    };

    let requestBody: BodyInit | undefined;

    if (endpoint.includes("content.dropboxapi.com")) {
        headers["Content-Type"] = "application/octet-stream";
        if (!apiArg) {
            throw new Error("Dropbox content endpoints require apiArg parameter");
        }
        headers["Dropbox-API-Arg"] = JSON.stringify(apiArg);
        requestBody = body;
    } else {
        if (apiArg !== undefined && apiArg !== null) {
            headers["Content-Type"] = "application/json";
            requestBody = JSON.stringify(apiArg);
        } else {
            requestBody = undefined;
        }
    }

    const response = await fetch(endpoint, {
        method,
        headers,
        body: requestBody,
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorData: unknown;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            errorData = errorText;
        }

        const error = errorData as { error?: { ".tag"?: string }; error_summary?: string };
        if (error.error?.[".tag"] === "path" || error.error?.[".tag"] === "not_found") {
            throw new Error(`File not found: ${error.error_summary || "Unknown error"}`);
        }
        throw new Error(
            `Dropbox API error: ${response.status} ${response.statusText} - ${error.error_summary || errorText}`,
        );
    }

    if (endpoint.includes("content.dropboxapi.com") && endpoint.includes("/download")) {
        const apiArgHeader = response.headers.get("dropbox-api-result");
        if (apiArgHeader) {
            const metadata = JSON.parse(apiArgHeader) as T;
            const content = await response.arrayBuffer();
            return { ...metadata, fileBinary: new Uint8Array(content) } as T;
        }
        const content = await response.arrayBuffer();
        return { fileBinary: new Uint8Array(content) } as T;
    }

    if (response.status === 204 || !response.body) {
        return {} as T;
    }

    return await response.json() as T;
}
