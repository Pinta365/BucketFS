import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";
import { deleteFile, fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

async function main() {
    // Initialize BucketFS with AWS S3
    initBucket({
        provider: "s3",
        bucketName: requireEnv("S3_BUCKET_NAME"),
        region: requireEnv("S3_REGION"),
        credentials: {
            accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
        },
    });

    /*
    // Initialize with Cloudflare R2
    initBucket({
        provider: "r2",
        bucketName: requireEnv("R2_BUCKET_NAME"),
        accountId: requireEnv("R2_ACCOUNT_ID"),
        credentials: {
            accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
    });

    // Initialize with Google Cloud Storage
    initBucket({
        provider: "gcs",
        bucketName: requireEnv("GCS_BUCKET_NAME"),
        projectId: requireEnv("GCS_PROJECT_ID"),
        credentials: {
            clientEmail: requireEnv("GCS_CLIENT_EMAIL"),
            privateKey: requireEnv("GCS_PRIVATE_KEY").replace(/\\n/g, "\n"),
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
