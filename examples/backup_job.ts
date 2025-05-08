import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";
import { fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

// Configuration for S3 source bucket
const sourceConfig = {
    provider: "s3" as const,
    bucketName: requireEnv("S3_BUCKET_NAME"),
    region: requireEnv("S3_REGION"),
    credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
};

// Configuration for R2 backup bucket
const backupConfig = {
    provider: "r2" as const,
    bucketName: requireEnv("R2_BUCKET_NAME"),
    accountId: requireEnv("R2_ACCOUNT_ID"),
    credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
};

// Set to false after initial file creation. This is just to create some test files for us to backup :)
const CREATE_SOURCE_FILES = true;

/**
 * Create test files in the source bucket
 */
async function createSourceFiles() {
    if (!CREATE_SOURCE_FILES) {
        console.log("Skipping source file creation...");
        return;
    }

    console.log("Creating source files in S3...");

    // Initialize source bucket
    initBucket(sourceConfig, "source");

    // Create test files
    const files = [
        { path: "copy_job/file1.txt", content: "This is file 1" },
        { path: "copy_job/file2.txt", content: "This is file 2" },
        { path: "copy_job/file3.txt", content: "This is file 3" },
    ];

    for (const file of files) {
        await writeFile(file.path, file.content, "source");
        console.log(`Created ${file.path}`);
    }
}

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
    await createSourceFiles();
    await copyFilesToR2();
    console.log("✅ Backup job completed successfully!");
} catch (error) {
    console.error("❌ Backup job failed:", error);
}
