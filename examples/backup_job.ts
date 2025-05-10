/**
 * This example demostrate how BucketFS could be used to read the contents of a directory on
 * AWS S3 and backup it on CF R2 with utilizing the multi bucket capabilities of the
 * library.
 *
 * @cross/env is only used in these examples to easily read a .env file and at the same
 * time make sure that required environment variables are supplied as they will throw an error
 * if they are missing when using requireEnv().
 */
import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import { fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

// Configuration for S3 source bucket
const sourceConfig = {
    provider: "aws-s3" as const,
    bucketName: requireEnv("S3_BUCKET_NAME"),
    region: requireEnv("S3_REGION"),
    credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
};

// Configuration for R2 backup bucket
const backupConfig = {
    provider: "cf-r2" as const,
    bucketName: requireEnv("R2_BUCKET_NAME"),
    accountId: requireEnv("R2_ACCOUNT_ID"),
    credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
};

/**
 * Copy files from source to backup bucket with date-based structure
 */
async function copyFilesToR2() {
    console.log("Starting backup process...");

    // Initialize both buckets
    initBucket(sourceConfig, "source");
    initBucket(backupConfig, "backup");

    // List files in source directory
    const files = await listFiles("copy_job/", "source");
    console.log(`Found ${files.length} files to backup`);

    // Create date for directory structure (YYYYMMDD)
    const datePath = new Date().toISOString().split("T")[0].replace(/-/g, "");

    // Copy each file to backup bucket
    for (const file of files) {
        try {
            // Read file from source
            const content = await readFile(file, "source");
            if (!content) {
                throw new Error(`Source file ${file} not found`);
            }

            // Create backup path with date
            const backupPath = `${datePath}/${file}`;

            // Write to backup bucket
            await writeFile(backupPath, content, "backup");

            // Verify backup
            const exists = await fileExists(backupPath, "backup");
            if (exists) {
                console.log(`Successfully backed up ${file} to ${backupPath}`);
            } else {
                throw new Error(`Backup verification failed for ${file}`);
            }
        } catch (error) {
            console.error(`Failed to backup ${file}:`, error);
        }
    }
}

// Run the backup job
try {
    await copyFilesToR2();
    console.log("✅ Backup job completed successfully!");
} catch (error) {
    console.error("❌ Backup job failed:", error);
}
