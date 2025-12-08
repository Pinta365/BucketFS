/**
 * This example demostrate how to duplicate the same file on two buckets (two different
 * providers). It utilizing the resetBucket() api to reset the bucket between the uses.
 *
 * @cross/env is only used in these examples to easily read a .env file and at the same
 * time make sure that required environment variables are supplied as they will throw an error
 * if they are missing when using requireEnv().
 */

import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import { fileExists, initBucket, readFile, resetBucket, writeFile } from "../mod.ts";

async function main() {
    try {
        // Initialize S3 instance
        console.log("Initializing S3 connection...");
        await initBucket({
            provider: "aws-s3",
            bucketName: requireEnv("S3_BUCKET_NAME"),
            region: requireEnv("S3_REGION"),
            credentials: {
                accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
            },
        });

        // Create a test file in S3
        const testFile = "test/s3_to_r2.txt";
        const testContent = "This file will be copied from S3 to R2!";

        console.log("Writing test file to S3...");
        await writeFile(testFile, testContent);

        // Verify the file exists in S3
        const existsInS3 = await fileExists(testFile);
        console.log("File exists in S3:", existsInS3);

        // Read the file from S3
        console.log("Reading file from S3...");
        const s3Content = await readFile(testFile);
        console.log("S3 file content:", s3Content);

        // Reset the instance to prepare for R2
        console.log("\nResetting instance for R2...");
        resetBucket();

        // Initialize R2 instance
        console.log("Initializing R2 connection...");
        await initBucket({
            provider: "cf-r2",
            bucketName: requireEnv("R2_BUCKET_NAME"),
            accountId: requireEnv("R2_ACCOUNT_ID"),
            credentials: {
                accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
            },
        });

        // Write the same file to R2
        console.log("Writing file to R2...");
        await writeFile(testFile, testContent);

        // Verify the file exists in R2
        const existsInR2 = await fileExists(testFile);
        console.log("File exists in R2:", existsInR2);

        // Read the file from R2
        console.log("Reading file from R2...");
        const r2Content = await readFile(testFile);
        console.log("R2 file content:", r2Content);

        // Verify the contents match
        console.log("\nVerifying file contents...");
        if (s3Content === r2Content) {
            console.log("✅ Success: File contents match between S3 and R2!");
        } else {
            console.log("❌ Error: File contents do not match!");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
