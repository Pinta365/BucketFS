/**
 * To enable/disable provider tests, set the following environment variables to '1', 'true', or 'yes':
 *   TEST_GCS, TEST_S3, TEST_R2, TEST_DO, TEST_DROPBOX
 * If the variable is not set, the default value below is used.
 */
import "jsr:@cross/env@^1.0.2/load";
import { getEnv, requireEnv } from "jsr:@cross/env@^1.0.2";
import { checkBucketAuth, initBucket, resetBucket } from "../mod.ts";

function envFlag(name: string, fallback: boolean): boolean {
    const val = getEnv(name);
    if (val === undefined) return fallback;
    return ["1", "true", "yes"].includes(val.toLowerCase());
}

const TEST_GCS = envFlag("TEST_GCS", true);
const TEST_S3 = envFlag("TEST_S3", true);
const TEST_R2 = envFlag("TEST_R2", true);
const TEST_DO = envFlag("TEST_DO", false);
const TEST_DROPBOX = envFlag("TEST_DROPBOX", false);

Deno.test({
    name: "BucketFS initBucket and authentication: Google Cloud Storage",
    ignore: !TEST_GCS,
    async fn() {
        await initBucket({
            provider: "gcs",
            bucketName: requireEnv("GCS_BUCKET_NAME"),
            projectId: requireEnv("GCS_PROJECT_ID"),
            credentials: {
                clientEmail: requireEnv("GCS_CLIENT_EMAIL"),
                privateKey: requireEnv("GCS_PRIVATE_KEY").replace(/\\n/g, "\n"),
            },
        });
        const ok = await checkBucketAuth();
        if (!ok) throw new Error("Authentication failed for GCS");
        resetBucket();
    },
});

Deno.test({
    name: "BucketFS initBucket and authentication: AWS S3",
    ignore: !TEST_S3,
    async fn() {
        await initBucket({
            provider: "aws-s3",
            bucketName: requireEnv("S3_BUCKET_NAME"),
            region: requireEnv("S3_REGION"),
            credentials: {
                accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
            },
        });
        const ok = await checkBucketAuth();
        if (!ok) throw new Error("Authentication failed for AWS S3");
        resetBucket();
    },
});

Deno.test({
    name: "BucketFS initBucket and authentication: Cloudflare R2",
    ignore: !TEST_R2,
    async fn() {
        await initBucket({
            provider: "cf-r2",
            bucketName: requireEnv("R2_BUCKET_NAME"),
            accountId: requireEnv("R2_ACCOUNT_ID"),
            credentials: {
                accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
            },
        });
        const ok = await checkBucketAuth();
        if (!ok) throw new Error("Authentication failed for Cloudflare R2");
        resetBucket();
    },
});

Deno.test({
    name: "BucketFS initBucket and authentication: DigitalOcean Spaces",
    ignore: !TEST_DO,
    async fn() {
        await initBucket({
            provider: "do-spaces",
            bucketName: requireEnv("DO_SPACES_BUCKET_NAME"),
            region: requireEnv("DO_SPACES_REGION"),
            credentials: {
                accessKeyId: requireEnv("DO_SPACES_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("DO_SPACES_SECRET_ACCESS_KEY"),
            },
        });
        const ok = await checkBucketAuth();
        if (!ok) throw new Error("Authentication failed for DigitalOcean Spaces");
        resetBucket();
    },
});

Deno.test({
    name: "BucketFS initBucket and authentication: Dropbox",
    ignore: !TEST_DROPBOX,
    async fn() {
        await initBucket({
            provider: "dropbox",
            bucketName: requireEnv("DROPBOX_BUCKET_NAME"),
            credentials: {
                accessToken: requireEnv("DROPBOX_ACCESS_TOKEN"),
            },
        });
        const ok = await checkBucketAuth();
        if (!ok) throw new Error("Authentication failed for Dropbox");
        resetBucket();
    },
});
