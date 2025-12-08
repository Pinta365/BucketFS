/**
 * This example demostrate the most basic BucketFS API. It will configure a bucket, write
 * a test-file, check that it exist, read the file, list files in the bucket root directory and
 * finally delete the test-file.
 *
 * @cross/env is only used in these examples to easily read a .env file and at the same
 * time make sure that required environment variables are supplied as they will throw an error
 * if they are missing when using requireEnv().
 */

import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import { deleteFile, fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

async function main() {
    // Initialize with Google Cloud Storage
    await initBucket({
        provider: "gcs",
        bucketName: requireEnv("GCS_BUCKET_NAME"),
        projectId: requireEnv("GCS_PROJECT_ID"),
        credentials: {
            clientEmail: requireEnv("GCS_CLIENT_EMAIL"),
            privateKey: requireEnv("GCS_PRIVATE_KEY").replace(/\\n/g, "\n"),
        },
    });
    /*
    // Initialize BucketFS with AWS S3
    await initBucket({
        provider: "aws-s3",
        bucketName: requireEnv("S3_BUCKET_NAME"),
        region: requireEnv("S3_REGION"),
        credentials: {
            accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
        },
    });

    // Initialize with Cloudflare R2
    await initBucket({
        provider: "cf-r2",
        bucketName: requireEnv("R2_BUCKET_NAME"),
        accountId: requireEnv("R2_ACCOUNT_ID"),
        credentials: {
            accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
    });

    // Initialize with Google Cloud Storage
    await initBucket({
        provider: "gcs",
        bucketName: requireEnv("GCS_BUCKET_NAME"),
        projectId: requireEnv("GCS_PROJECT_ID"),
        credentials: {
            clientEmail: requireEnv("GCS_CLIENT_EMAIL"),
            privateKey: requireEnv("GCS_PRIVATE_KEY").replace(/\\n/g, "\n"),
        },
    });

    // Initialize with DigitalOcean Spaces
    await initBucket({
        provider: "do-spaces",
        bucketName: requireEnv("DO_SPACES_BUCKET_NAME"),
        region: requireEnv("DO_SPACES_REGION"),
        credentials: {
            accessKeyId: requireEnv("DO_SPACES_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("DO_SPACES_SECRET_ACCESS_KEY"),
        },
    });
    */

    try {
        // Write a file
        console.log("Writing file...");
        await writeFile("test.txt", "Hello from BucketFS!");

        // Check if file exists
        console.log("Checking if file exists...");
        const exists = await fileExists("test.txt");
        console.log("File exists:", exists);

        // Read the file
        console.log("Reading file...");
        const content = await readFile("test.txt");
        console.log("File content:", content);

        // List files
        console.log("Listing files...");
        const files = await listFiles();
        console.log("Files in bucket:", files);

        // Delete the file
        console.log("Deleting file...");
        await deleteFile("test.txt");
        console.log("File deleted successfully");
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
