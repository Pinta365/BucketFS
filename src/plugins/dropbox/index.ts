import type { ProviderPlugin } from "../../plugin.ts";
import { API_ENDPOINTS, apiRequest } from "./api.ts";

/**
 * Dropbox storage plugin implementation.
 * Uses Dropbox REST API v2 directly via fetch
 */
class DropboxPlugin implements ProviderPlugin {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private getDropboxPath(bucketName: string, path: string): string {
        const cleanBucket = bucketName.startsWith("/") ? bucketName.slice(1) : bucketName;
        const cleanPath = path.startsWith("/") ? path.slice(1) : path;
        return `/${cleanBucket}/${cleanPath}`;
    }

    async write(bucketName: string, path: string, content: string | Uint8Array): Promise<void> {
        const dropboxPath = this.getDropboxPath(bucketName, path);
        const contentBytes = typeof content === "string" ? new TextEncoder().encode(content) : content;

        await apiRequest(this.accessToken, API_ENDPOINTS.FILES_UPLOAD, {
            body: contentBytes as BodyInit,
            apiArg: {
                path: dropboxPath,
                mode: { ".tag": "overwrite" },
                autorename: false,
            },
        });
    }

    async read(bucketName: string, path: string): Promise<string | null> {
        try {
            const dropboxPath = this.getDropboxPath(bucketName, path);
            const response = await apiRequest<{ fileBinary?: Uint8Array }>(
                this.accessToken,
                API_ENDPOINTS.FILES_DOWNLOAD,
                {
                    apiArg: { path: dropboxPath },
                },
            );

            if (response.fileBinary) {
                return new TextDecoder().decode(response.fileBinary);
            }
            return null;
        } catch (error) {
            if (error instanceof Error && error.message.includes("File not found")) {
                return null;
            }
            throw error;
        }
    }

    async readBuffer(bucketName: string, path: string): Promise<Uint8Array | null> {
        try {
            const dropboxPath = this.getDropboxPath(bucketName, path);
            const response = await apiRequest<{ fileBinary?: Uint8Array }>(
                this.accessToken,
                API_ENDPOINTS.FILES_DOWNLOAD,
                {
                    apiArg: { path: dropboxPath },
                },
            );

            if (response.fileBinary) {
                return new Uint8Array(response.fileBinary);
            }
            return null;
        } catch (error) {
            if (error instanceof Error && error.message.includes("File not found")) {
                return null;
            }
            throw error;
        }
    }

    async delete(bucketName: string, path: string): Promise<void> {
        try {
            const dropboxPath = this.getDropboxPath(bucketName, path);
            await apiRequest(this.accessToken, API_ENDPOINTS.FILES_DELETE, {
                apiArg: { path: dropboxPath },
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes("File not found")) {
                return;
            }
            throw error;
        }
    }

    async move(bucketName: string, oldPath: string, newPath: string): Promise<void> {
        const fromPath = this.getDropboxPath(bucketName, oldPath);
        const toPath = this.getDropboxPath(bucketName, newPath);

        await apiRequest(this.accessToken, API_ENDPOINTS.FILES_MOVE, {
            apiArg: {
                from_path: fromPath,
                to_path: toPath,
                autorename: false,
            },
        });
    }

    async list(bucketName: string, prefix?: string): Promise<string[]> {
        const bucketPath = `/${bucketName.startsWith("/") ? bucketName.slice(1) : bucketName}`;
        const dropboxPath = prefix ? this.getDropboxPath(bucketName, prefix) : bucketPath;

        try {
            let response = await apiRequest<{
                entries: Array<{ path_display?: string; ".tag": string }>;
                has_more: boolean;
                cursor?: string;
            }>(this.accessToken, API_ENDPOINTS.FILES_LIST_FOLDER, {
                apiArg: {
                    path: dropboxPath,
                    recursive: true,
                },
            });

            const bucketPrefix = `${bucketPath}/`;
            const files: string[] = [];

            const processEntries = (entries: Array<{ path_display?: string; ".tag": string }>) => {
                for (const entry of entries) {
                    if (entry[".tag"] === "file" && entry.path_display) {
                        const fullPath = entry.path_display;
                        if (fullPath.startsWith(bucketPrefix)) {
                            files.push(fullPath.slice(bucketPrefix.length));
                        } else {
                            files.push(fullPath);
                        }
                    }
                }
            };

            processEntries(response.entries);

            while (response.has_more && response.cursor) {
                response = await apiRequest<{
                    entries: Array<{ path_display?: string; ".tag": string }>;
                    has_more: boolean;
                    cursor?: string;
                }>(this.accessToken, API_ENDPOINTS.FILES_LIST_FOLDER_CONTINUE, {
                    apiArg: { cursor: response.cursor },
                });
                processEntries(response.entries);
            }

            if (prefix) {
                const normalizedPrefix = prefix.replace(/^\/+/, "").replace(/\\/g, "/");
                return files.filter((file) => file.startsWith(normalizedPrefix));
            }

            return files;
        } catch (error) {
            if (error instanceof Error && error.message.includes("File not found")) {
                return [];
            }
            throw error;
        }
    }

    async exists(bucketName: string, path: string): Promise<boolean> {
        try {
            const dropboxPath = this.getDropboxPath(bucketName, path);
            const response = await apiRequest<{ ".tag": string }>(
                this.accessToken,
                API_ENDPOINTS.FILES_GET_METADATA,
                {
                    apiArg: { path: dropboxPath },
                },
            );

            return response[".tag"] === "file";
        } catch (error) {
            if (error instanceof Error && error.message.includes("File not found")) {
                return false;
            }
            return false;
        }
    }

    async checkAuth(_bucketName: string): Promise<boolean> {
        try {
            await apiRequest(this.accessToken, API_ENDPOINTS.USERS_GET_CURRENT_ACCOUNT);
            return true;
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("401") || error.message.includes("expired_access_token")) {
                    return false;
                }
                if (error.message.includes("403") || error.message.includes("invalid_access_token")) {
                    return false;
                }
            }
            return false;
        }
    }
}

/**
 * Create a Dropbox storage plugin instance.
 * @param config Full bucket configuration
 * @returns A new DropboxPlugin instance
 */
export function createPlugin(config: {
    provider: string;
    bucketName: string;
    region?: string;
    accountId?: string;
    projectId?: string;
    rootDirectory?: string;
    credentials?: unknown;
    cache?: unknown;
    [key: string]: unknown;
}): Promise<ProviderPlugin> {
    const credentials = config.credentials as { accessToken?: string } | undefined;
    if (!credentials?.accessToken) {
        throw new Error("Access token is required for Dropbox provider. Provide it in credentials.accessToken");
    }

    return Promise.resolve(new DropboxPlugin(credentials.accessToken));
}
