/**
 * Google Cloud Storage OAuth 2.0 authentication.
 * Uses Web Crypto API for JWT signing - runtime agnostic.
 */

/**
 * Service account credentials
 */
export interface ServiceAccountCredentials {
    clientEmail: string;
    privateKey: string;
    scope?: string;
}

/**
 * Cached access token with expiration
 */
interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

/**
 * Token cache (in-memory, per instance)
 */
let tokenCache: CachedToken | null = null;

/**
 * OAuth 2.0 token endpoint
 */
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * GCS API scopes
 * - devstorage.read_write: Read and write access to objects and buckets
 * - devstorage.full_control: Full control (read, write, delete, list, etc.)
 *
 * Note: Actual permissions are controlled by IAM roles assigned to the service account.
 * The scope only determines what the token can request, but IAM enforces what's allowed.
 */
const DEFAULT_GCS_SCOPE = "https://www.googleapis.com/auth/devstorage.read_write";

/**
 * Base64 URL encode (without padding)
 */
function base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Create JWT header
 */
function createJWTHeader(): string {
    return base64UrlEncode(
        new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    );
}

/**
 * Create JWT claims
 */
function createJWTClaims(clientEmail: string, scope: string): string {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        iss: clientEmail,
        scope: scope,
        aud: TOKEN_ENDPOINT,
        exp: now + 3600, // 1 hour
        iat: now,
    };
    return base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
}

/**
 * Import private key for signing
 */
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
    // Remove PEM headers and whitespace
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKeyPem
        .replace(pemHeader, "")
        .replace(pemFooter, "")
        .replace(/\s/g, "");

    // Decode base64
    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    // Import key
    return await crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        false,
        ["sign"],
    );
}

/**
 * Sign JWT with private key
 */
async function signJWT(header: string, claims: string, privateKey: CryptoKey): Promise<string> {
    const unsignedToken = `${header}.${claims}`;
    const data = new TextEncoder().encode(unsignedToken);

    const signature = await crypto.subtle.sign(
        {
            name: "RSASSA-PKCS1-v1_5",
        },
        privateKey,
        data,
    );

    const signatureB64 = base64UrlEncode(new Uint8Array(signature));
    return `${unsignedToken}.${signatureB64}`;
}

/**
 * Exchange JWT for access token
 */
async function exchangeJWTForToken(jwt: string): Promise<string> {
    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    return data.access_token;
}

/**
 * Get access token for service account.
 * Caches token until expiration (1 hour).
 */
export async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
    const scope = credentials.scope || DEFAULT_GCS_SCOPE;

    // Check cache (invalidate if scope changed)
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
        // Return cached token if it has more than 1 minute left
        return tokenCache.accessToken;
    }

    // Create JWT
    const header = createJWTHeader();
    const claims = createJWTClaims(credentials.clientEmail, scope);

    // Import and sign
    const privateKey = await importPrivateKey(credentials.privateKey);
    const jwt = await signJWT(header, claims, privateKey);

    // Exchange for access token
    const accessToken = await exchangeJWTForToken(jwt);

    // Cache token (expires in 1 hour, but we'll refresh after 59 minutes)
    tokenCache = {
        accessToken,
        expiresAt: Date.now() + 3540000, // 59 minutes
    };

    return accessToken;
}
