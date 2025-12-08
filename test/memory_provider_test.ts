/**
 * Test file for the in-memory provider.
 */
import { assertEquals, assertExists } from "@std/assert";
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
    name: "BucketFS memory provider: Full file operations test",
    async fn() {
        try {
            // Initialize the memory provider
            await initBucket({
                provider: "memory",
                bucketName: "test-bucket",
            });

            // Test authentication/access check
            const authOk = await checkBucketAuth();
            assertEquals(authOk, true, "Memory provider should always be accessible");
            console.log("✓ checkBucketAuth");

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
    name: "BucketFS memory provider: Error handling",
    async fn() {
        try {
            await initBucket({
                provider: "memory",
                bucketName: "error-test-bucket",
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

Deno.test({
    name: "BucketFS memory provider: Multiple buckets isolation",
    async fn() {
        try {
            // Initialize first bucket
            await initBucket({
                provider: "memory",
                bucketName: "bucket1",
            }, "bucket1");

            // Initialize second bucket
            await initBucket({
                provider: "memory",
                bucketName: "bucket2",
            }, "bucket2");

            // Write to first bucket
            await writeFile("file1.txt", "Bucket 1 content", "bucket1");

            // Write to second bucket
            await writeFile("file1.txt", "Bucket 2 content", "bucket2");

            // Verify isolation - each bucket has its own file
            const content1 = await readFile("file1.txt", "bucket1");
            assertEquals(content1, "Bucket 1 content", "Bucket 1 should have its own content");

            const content2 = await readFile("file1.txt", "bucket2");
            assertEquals(content2, "Bucket 2 content", "Bucket 2 should have its own content");

            // Verify files don't leak between buckets
            const files1 = await listFiles(undefined, "bucket1");
            const files2 = await listFiles(undefined, "bucket2");
            assertEquals(files1.length, 1, "Bucket 1 should have 1 file");
            assertEquals(files2.length, 1, "Bucket 2 should have 1 file");

            resetBucket();
            console.log("✓ Multiple buckets isolation test passed!");
        } catch (error) {
            resetBucket();
            throw error;
        }
    },
});

Deno.test({
    name: "BucketFS memory provider: Large binary data",
    async fn() {
        try {
            await initBucket({
                provider: "memory",
                bucketName: "large-data-bucket",
            });

            // Create a large binary array (1MB)
            const largeData = new Uint8Array(1024 * 1024);
            for (let i = 0; i < largeData.length; i++) {
                largeData[i] = i % 256;
            }

            // Write large binary data
            await writeFile("large.bin", largeData);
            console.log("✓ writeFile (large binary data)");

            // Read it back
            const readData = await readBuffer("large.bin");
            assertExists(readData, "Should read large binary data");
            assertEquals(readData!.length, 1024 * 1024, "Should have correct size");
            assertEquals(readData![0], 0, "First byte should be 0");
            assertEquals(readData![readData!.length - 1], 255, "Last byte should be 255");

            // Verify integrity - check a few random positions
            assertEquals(readData![1000], 1000 % 256, "Byte at position 1000 should be correct");
            assertEquals(readData![50000], 50000 % 256, "Byte at position 50000 should be correct");
            assertEquals(readData![1000000], 1000000 % 256, "Byte at position 1000000 should be correct");

            resetBucket();
            console.log("✓ Large binary data test passed!");
        } catch (error) {
            resetBucket();
            throw error;
        }
    },
});
