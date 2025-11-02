/**
 * This example demonstrates the memory bucket provider - an in-memory only storage
 * that doesn't persist data. Useful for testing, development, or temporary storage.
 *
 * Note: The memory provider doesn't require any credentials or cloud account setup.
 */

import { deleteFile, fileExists, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

async function main() {
    console.log("=== Memory Bucket Provider Demo ===\n");

    // Initialize memory bucket - no credentials needed!
    initBucket({
        provider: "memory",
        bucketName: "test-bucket",
    });

    try {
        // Write files
        console.log("1. Writing files to memory bucket...");
        await writeFile("file1.txt", "Hello from memory bucket!");
        await writeFile("folder/file2.txt", "This is in a subfolder");
        await writeFile("data.json", JSON.stringify({ message: "Memory storage works!" }));
        console.log("   ✓ Files written\n");

        // Check if files exist
        console.log("2. Checking if files exist...");
        console.log(`   file1.txt exists: ${await fileExists("file1.txt")}`);
        console.log(`   folder/file2.txt exists: ${await fileExists("folder/file2.txt")}`);
        console.log(`   nonexistent.txt exists: ${await fileExists("nonexistent.txt")}\n`);

        // Read files
        console.log("3. Reading files...");
        const content1 = await readFile("file1.txt");
        const content2 = await readFile("folder/file2.txt");
        const content3 = await readFile("data.json");
        console.log(`   file1.txt: ${content1}`);
        console.log(`   folder/file2.txt: ${content2}`);
        console.log(`   data.json: ${content3}\n`);

        // List files
        console.log("4. Listing all files...");
        const allFiles = await listFiles();
        console.log(`   All files: ${allFiles.join(", ")}\n`);

        // List files in folder
        console.log("5. Listing files in 'folder/'...");
        const folderFiles = await listFiles("folder/");
        console.log(`   Files in folder/: ${folderFiles.join(", ")}\n`);

        // Update a file
        console.log("6. Updating file1.txt...");
        await writeFile("file1.txt", "Updated content!");
        const updated = await readFile("file1.txt");
        console.log(`   Updated content: ${updated}\n`);

        // Delete a file
        console.log("7. Deleting data.json...");
        await deleteFile("data.json");
        const stillExists = await fileExists("data.json");
        console.log(`   data.json still exists: ${stillExists}\n`);

        console.log("=== Demo Complete ===");
        console.log("\nNote: All data is stored in memory only.");
        console.log("When the process exits, all data will be lost.");
        console.log("This makes it perfect for testing and temporary storage!");
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
