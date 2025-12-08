/**
 * Test file for the local filesystem (fs) provider.
 *
 *
 */
import { assertEquals, assertExists } from "@std/assert";
import { mktempdir } from "@cross/fs/ops";
import {
    checkBucketAuth,
    deleteFile,
    fileExists,
    initBucket,
    listFiles,
    moveFile,
    readBuffer,
    readFile,
    resetBucket,
    writeFile,
} from "../mod.ts";

Deno.test({
    name: "BucketFS fs provider: Full file operations test",
    async fn() {
        // Create a temporary directory for testing
        const tempDir = await mktempdir("bucketfs-test-");
        console.log(`Using temp directory: ${tempDir}`);

        try {
            // Initialize the fs provider
            await initBucket({
                provider: "fs",
                bucketName: "test-bucket",
                rootDirectory: tempDir,
            });

            // Test authentication/access check
            const authOk = await checkBucketAuth();
            assertEquals(authOk, true, "Filesystem provider should be accessible");

            // Test writeFile with string content
            await writeFile("test.txt", "Hello, World!");
            console.log("✓ writeFile (string)");

            // Test writeFile with binary content
            const binaryData = new Uint8Array([1, 2, 3, 4, 5, 255]);
            await writeFile("test.bin", binaryData);
            console.log("✓ writeFile (binary)");

            // Test fileExists
            const exists1 = await fileExists("test.txt");
            assertEquals(exists1, true, "test.txt should exist");
            const exists2 = await fileExists("nonexistent.txt");
            assertEquals(exists2, false, "nonexistent.txt should not exist");
            console.log("✓ fileExists");

            // Test readFile (string)
            const content = await readFile("test.txt");
            assertEquals(content, "Hello, World!", "readFile should return correct string content");
            console.log("✓ readFile (string)");

            // Test readBuffer (binary)
            const buffer = await readBuffer("test.bin");
            assertExists(buffer, "readBuffer should return a buffer");
            assertEquals(buffer!.length, 6, "Buffer should have correct length");
            assertEquals(buffer![0], 1, "First byte should be 1");
            assertEquals(buffer![5], 255, "Last byte should be 255");
            console.log("✓ readBuffer (binary)");

            // Test readBuffer on text file (should return raw bytes)
            const textBuffer = await readBuffer("test.txt");
            assertExists(textBuffer, "readBuffer should return buffer for text file");
            const decodedText = new TextDecoder().decode(textBuffer!);
            assertEquals(decodedText, "Hello, World!", "Decoded buffer should match original text");
            console.log("✓ readBuffer (text file)");

            // Test listFiles
            let files = await listFiles();
            assertEquals(files.length, 2, "Should list 2 files");
            assertEquals(files.includes("test.txt"), true, "Should include test.txt");
            assertEquals(files.includes("test.bin"), true, "Should include test.bin");
            console.log("✓ listFiles (root)");

            // Test writeFile in subdirectory
            await writeFile("subdir/nested.txt", "Nested content");
            files = await listFiles();
            assertEquals(files.length, 3, "Should list 3 files including nested");
            console.log("✓ writeFile (subdirectory)");

            // Test listFiles with prefix
            const subdirFiles = await listFiles("subdir/");
            assertEquals(subdirFiles.length, 1, "Should list 1 file in subdir");
            assertEquals(subdirFiles[0], "subdir/nested.txt", "Should include nested.txt");
            console.log("✓ listFiles (with prefix)");

            // Test moveFile (rename)
            await moveFile("test.txt", "renamed.txt");
            const renamedExists = await fileExists("renamed.txt");
            assertEquals(renamedExists, true, "Renamed file should exist");
            const oldExists = await fileExists("test.txt");
            assertEquals(oldExists, false, "Old file should not exist");
            const renamedContent = await readFile("renamed.txt");
            assertEquals(renamedContent, "Hello, World!", "Renamed file should have same content");
            console.log("✓ moveFile (rename)");

            // Test moveFile (move to different directory)
            await moveFile("renamed.txt", "subdir/moved.txt");
            const movedExists = await fileExists("subdir/moved.txt");
            assertEquals(movedExists, true, "Moved file should exist in subdir");
            const oldRenamedExists = await fileExists("renamed.txt");
            assertEquals(oldRenamedExists, false, "Old file should not exist");
            console.log("✓ moveFile (move to subdirectory)");

            // Test deleteFile
            await deleteFile("test.bin");
            const deletedExists = await fileExists("test.bin");
            assertEquals(deletedExists, false, "Deleted file should not exist");
            console.log("✓ deleteFile");

            // Verify final file list
            files = await listFiles();
            assertEquals(files.length, 2, "Should have 2 files remaining");
            assertEquals(files.includes("subdir/nested.txt"), true, "Should include nested.txt");
            assertEquals(files.includes("subdir/moved.txt"), true, "Should include moved.txt");
            console.log("✓ Final file list verification");

            // Clean up
            resetBucket();
            console.log("✓ All tests passed!");
        } catch (error) {
            resetBucket();
            throw error;
        }
    },
});

Deno.test({
    name: "BucketFS fs provider: Error handling",
    async fn() {
        const tempDir = await mktempdir("bucketfs-error-test-");

        try {
            await initBucket({
                provider: "fs",
                bucketName: "error-test-bucket",
                rootDirectory: tempDir,
            });

            // Test reading non-existent file
            const content = await readFile("nonexistent.txt");
            assertEquals(content, null, "readFile should return null for non-existent file");

            const buffer = await readBuffer("nonexistent.txt");
            assertEquals(buffer, null, "readBuffer should return null for non-existent file");

            // Test deleting non-existent file (should not throw)
            await deleteFile("nonexistent.txt");

            resetBucket();
        } catch (error) {
            resetBucket();
            throw error;
        }
    },
});

