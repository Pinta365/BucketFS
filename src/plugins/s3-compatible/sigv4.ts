/**
 * AWS Signature Version 4 (SigV4) signing implementation.
 * Uses Web Crypto API for HMAC-SHA256 - runtime agnostic.
 */

/**
 * AWS credentials
 */
export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
}

/**
 * Request to sign
 */
export interface RequestToSign {
    method: string;
    url: URL;
    headers: Record<string, string>;
    body?: Uint8Array | string;
}

/**
 * Create HMAC-SHA256 signature
 */
async function hmacSha256(key: Uint8Array | CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    let cryptoKey: CryptoKey;
    if (key instanceof CryptoKey) {
        cryptoKey = key;
    } else {
        const keyArray = new Uint8Array(key);
        cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyArray,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );
    }

    const dataArray = new Uint8Array(data);
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataArray);
    return new Uint8Array(signature);
}

/**
 * Create signing key for SigV4
 */
async function getSigningKey(
    secretKey: string,
    date: string,
    region: string,
    service: string,
): Promise<CryptoKey> {
    const kDate = await hmacSha256(
        new TextEncoder().encode(`AWS4${secretKey}`),
        new TextEncoder().encode(date),
    );
    const kRegion = await hmacSha256(kDate, new TextEncoder().encode(region));
    const kService = await hmacSha256(kRegion, new TextEncoder().encode(service));
    const kSigning = await hmacSha256(kService, new TextEncoder().encode("aws4_request"));

    const keyArray = new Uint8Array(kSigning);
    return await crypto.subtle.importKey(
        "raw",
        keyArray,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
}

/**
 * Hash data using SHA-256
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const dataArray = new Uint8Array(data);
    const hash = await crypto.subtle.digest("SHA-256", dataArray);
    return new Uint8Array(hash);
}

/**
 * Hex encode bytes
 */
function hexEncode(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Normalize header name (lowercase)
 */
function normalizeHeaderName(name: string): string {
    return name.toLowerCase();
}

/**
 * Create canonical headers string
 */
function createCanonicalHeaders(headers: Record<string, string>): { headers: string; signedHeaders: string } {
    const normalized: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(headers)) {
        const normalizedKey = normalizeHeaderName(key);
        normalized.push([normalizedKey, value.trim().replace(/\s+/g, " ")]);
    }
    normalized.sort((a, b) => a[0].localeCompare(b[0]));

    const headerString = normalized.map(([key, value]) => `${key}:${value}`).join("\n");
    const signedHeaders = normalized.map(([key]) => key).join(";");

    return { headers: headerString, signedHeaders };
}

/**
 * Create canonical query string
 */
function createCanonicalQueryString(url: URL): string {
    const params: Array<[string, string]> = [];
    for (const [key, value] of url.searchParams.entries()) {
        params.push([key, value]);
    }
    params.sort((a, b) => {
        if (a[0] !== b[0]) {
            return a[0].localeCompare(b[0]);
        }
        return a[1].localeCompare(b[1]);
    });

    return params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

/**
 * Create canonical URI
 */
function createCanonicalUri(url: URL): string {
    const pathname = url.pathname || "/";
    // Encode each path segment separately
    return pathname
        .split("/")
        .map((segment) => encodeURIComponent(segment).replace(/%2F/g, "/"))
        .join("/");
}

/**
 * Create canonical request
 */
async function createCanonicalRequest(request: RequestToSign): Promise<string> {
    const method = request.method;
    const canonicalUri = createCanonicalUri(request.url);
    const canonicalQueryString = createCanonicalQueryString(request.url);
    const { headers: canonicalHeaders, signedHeaders } = createCanonicalHeaders(request.headers);

    // Hash payload
    let payloadHash: string;
    if (request.body) {
        const bodyBytes = typeof request.body === "string" ? new TextEncoder().encode(request.body) : request.body;
        const hash = await sha256(bodyBytes);
        payloadHash = hexEncode(hash);
    } else {
        payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // Empty string hash to avoid unnecessary computation
    }

    return [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        "",
        signedHeaders,
        payloadHash,
    ].join("\n");
}

/**
 * Create string to sign
 */
async function createStringToSign(
    canonicalRequest: string,
    date: string,
    credentialScope: string,
): Promise<string> {
    const hashedRequest = await sha256(new TextEncoder().encode(canonicalRequest));
    const requestHash = hexEncode(hashedRequest);

    return [
        "AWS4-HMAC-SHA256",
        date,
        credentialScope,
        requestHash,
    ].join("\n");
}

/**
 * Sign a request using AWS Signature Version 4
 */
export async function signRequest(
    request: RequestToSign,
    credentials: AWSCredentials,
    region: string,
    service: string = "s3",
): Promise<Record<string, string>> {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toISOString().slice(11, 19).replace(/:/g, "");
    const dateTime = `${date}T${time}Z`;

    // Ensure required headers
    const headers: Record<string, string> = {
        ...request.headers,
        host: request.url.host,
    };

    if (!headers["x-amz-date"]) {
        headers["x-amz-date"] = dateTime;
    }

    // Create canonical request
    const canonicalRequest = await createCanonicalRequest({ ...request, headers });

    // Create credential scope
    const credentialScope = `${date}/${region}/${service}/aws4_request`;

    // Create string to sign
    const stringToSign = await createStringToSign(canonicalRequest, dateTime, credentialScope);

    // Get signing key
    const signingKey = await getSigningKey(credentials.secretAccessKey, date, region, service);

    // Sign string to sign
    const signatureBytes = await crypto.subtle.sign(
        "HMAC",
        signingKey,
        new TextEncoder().encode(stringToSign),
    );
    const signature = hexEncode(new Uint8Array(signatureBytes));

    // Create authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${
        createCanonicalHeaders(headers).signedHeaders
    }, Signature=${signature}`;

    return {
        ...headers,
        Authorization: authorization,
    };
}
