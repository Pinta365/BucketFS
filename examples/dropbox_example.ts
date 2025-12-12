/**
 * This example demonstrates how to use BucketFS with Dropbox as the storage provider.
 *
 * Prerequisites:
 * 1. Create a Dropbox app at https://www.dropbox.com/developers/apps
 *    - You'll get an App Key and App Secret
 * 2. Configure app permissions:
 *    - In your app's settings, go to "Permissions" tab
 *    - Enable the following scopes:
 *      * files.content.write - Required for writing files
 *      * files.content.read - Required for reading files
 *      * files.metadata.read - Required for listing files and checking existence
 *      * files.metadata.write - Required for deleting and moving files
 * 3. Generate an access token:
 *    - In your app's settings, scroll to "OAuth 2" section
 *    - Click "Generate access token" (for development/testing)
 *    - Copy the new token immediately (you can't view it again later)
 *    - Or implement OAuth2 flow for production (see Dropbox docs)
 * 4. Set the DROPBOX_ACCESS_TOKEN environment variable with your access token
 *    - Update this variable whenever you generate a new token
 *
 * Note: The bucketName in Dropbox represents a folder path in your Dropbox account.
 * Files will be stored under /bucketName/path in your Dropbox.
 *
 * For production apps, you should implement the OAuth2 flow to get user access tokens.
 * For development/testing, you can use the "Generate access token" button in the app console.
 */

import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import {
    checkBucketAuth,
    deleteFile,
    fileExists,
    initBucket,
    listFiles,
    moveFile,
    readFile,
    writeFile,
} from "../mod.ts";

async function main() {
    // Initialize with Dropbox
    // Note: bucketName acts as a folder path in Dropbox
    await initBucket({
        provider: "dropbox",
        bucketName: "bucketfs", // This becomes a folder in Dropbox
        credentials: {
            accessToken: requireEnv("DROPBOX_ACCESS_TOKEN"),
        },
    });

    try {
        // Check authentication
        console.log("Checking Dropbox authentication...");
        const authOk = await checkBucketAuth();
        if (!authOk) throw new Error("Authentication failed for Dropbox");
        console.log("Dropbox authentication successful");

        // Write a file
        console.log("Writing file to Dropbox...");
        await writeFile("test.txt", "Hello from BucketFS and Dropbox!");

        // Check if file exists
        console.log("Checking if file exists...");
        const exists = await fileExists("test.txt");
        console.log("File exists:", exists);

        // Read the file
        console.log("Reading file from Dropbox...");
        const content = await readFile("test.txt");
        console.log("File content:", content);

        // Write a binary file
        console.log("Writing binary file...");
        const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in bytes
        await writeFile("binary.bin", binaryData);

        // Read binary file
        console.log("Reading binary file...");
        const binaryContent = await readFile("binary.bin");
        console.log("Binary content (as string):", binaryContent);

        // List files
        console.log("Listing files in Dropbox folder...");
        const files = await listFiles();
        console.log("Files in bucket:", files);

        // List files with prefix (subdirectory)
        console.log("Creating subdirectory structure...");
        await writeFile("subdir/nested.txt", "This is a nested file");

        console.log("Listing files in subdirectory...");
        const subdirFiles = await listFiles("subdir");
        console.log("Files in subdir:", subdirFiles);

        // Move/rename a file
        console.log("Moving/renaming file...");
        await writeFile("original.txt", "Original content");
        await moveFile("original.txt", "renamed.txt");
        const movedContent = await readFile("renamed.txt");
        console.log("Moved file content:", movedContent);

        // Delete files
        console.log("Deleting test files...");
        await deleteFile("test.txt");
        await deleteFile("binary.bin");
        await deleteFile("subdir/nested.txt");
        await deleteFile("renamed.txt");

        console.log("All operations completed successfully!");
    } catch (error) {
        console.error("Error:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Stack:", error.stack);
        }
    }
}

main();
