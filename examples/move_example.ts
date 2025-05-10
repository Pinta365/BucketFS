/**
 * This example demonstrates how to use the moveFile API to move and/or rename files
 * in the configured bucket. It will configure a bucket, write
 * a test file, move/rename it, verify the old path is gone and the new path exists,
 * and finally delete the moved file.
 *
 * @cross/env is only used in these examples to easily read a .env file and at the same
 * time make sure that required environment variables are supplied as they will throw an error
 * if they are missing when using requireEnv().
 */

import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import { fileExists, initBucket, moveFile, writeFile } from "../mod.ts";

async function main() {
    // Initialize with Google Cloud Storage
    // You can swap this with any other provider config supported by BucketFS
    initBucket({
        provider: "cf-r2",
        bucketName: requireEnv("R2_BUCKET_NAME"),
        accountId: requireEnv("R2_ACCOUNT_ID"),
        credentials: {
            accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
    });

    const oldPath = "test_move.txt";
    const newPath = "moved_files/test_move_renamed.txt";
    const fileContent = "This file will be moved and renamed!";

    try {
        // Write an initial file
        console.log(`Writing initial file: ${oldPath}...`);
        await writeFile(oldPath, fileContent);

        // Check if initial file exists
        console.log(`Checking if initial file exists: ${oldPath}...`);
        const existsBeforeMove = await fileExists(oldPath);
        console.log("Initial file exists:", existsBeforeMove);

        // Move/rename the file
        console.log(`Moving/renaming file from ${oldPath} to ${newPath}...`);
        await moveFile(oldPath, newPath);
        console.log("Move/rename operation completed.");

        // Check if the old file still exists
        console.log(`Checking if old file still exists: ${oldPath}...`);
        const existsAfterMoveOld = await fileExists(oldPath);
        console.log("Old file exists:", existsAfterMoveOld); // Should be false

        // Check if the new file exists
        console.log(`Checking if new file exists: ${newPath}...`);
        const existsAfterMoveNew = await fileExists(newPath);
        console.log("New file exists:", existsAfterMoveNew); // Should be true
    } catch (error) {
        console.error("Error during move example:", error);
    }
}

main();
