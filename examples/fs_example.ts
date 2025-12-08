/**
 * This example demonstrates the filesystem (fs) bucket provider - a local filesystem storage
 * that persists data to disk. Perfect for local development, testing, or when you need
 * persistent storage without cloud services.
 *
 * Note: The filesystem provider uses @cross/fs for cross-runtime compatibility (Deno, Node.js, Bun).
 * No credentials needed, just a root directory path!
 */

import { mktempdir } from "jsr:@cross/fs@^0.1/ops";
import { deleteFile, fileExists, initBucket, listFiles, readBuffer, readFile, writeFile } from "../mod.ts";

async function main() {
    // Create a temporary directory for this demo
    const tempDir = await mktempdir("bucketfs-demo-");
    console.log(`Using storage directory: ${tempDir}\n`);

    try {
        // Initialize filesystem bucket
        await initBucket({
            provider: "fs",
            bucketName: "demo-bucket",
            rootDirectory: tempDir,
        });
        console.log("✓ Bucket initialized\n");

        // Write files
        console.log("1. Writing files to filesystem bucket...");
        await writeFile("file1.txt", "Hello from filesystem bucket!");
        await writeFile("folder/file2.txt", "This is in a subfolder");
        await writeFile("data.json", JSON.stringify({ message: "Filesystem storage works!" }));

        // Write binary data
        const binaryData = new Uint8Array([1, 2, 3, 4, 5, 255]);
        await writeFile("binary.bin", binaryData);
        console.log("   ✓ Files written\n");

        // Check if files exist
        console.log("2. Checking if files exist...");
        console.log(`   file1.txt exists: ${await fileExists("file1.txt")}`);
        console.log(`   folder/file2.txt exists: ${await fileExists("folder/file2.txt")}`);
        console.log(`   binary.bin exists: ${await fileExists("binary.bin")}`);
        console.log(`   nonexistent.txt exists: ${await fileExists("nonexistent.txt")}\n`);

        // Read text files
        console.log("3. Reading text files...");
        const content1 = await readFile("file1.txt");
        const content2 = await readFile("folder/file2.txt");
        const content3 = await readFile("data.json");
        console.log(`   file1.txt: ${content1}`);
        console.log(`   folder/file2.txt: ${content2}`);
        console.log(`   data.json: ${content3}\n`);

        // Read binary file
        console.log("4. Reading binary file...");
        const buffer = await readBuffer("binary.bin");
        if (buffer) {
            console.log(`   binary.bin: [${Array.from(buffer).join(", ")}]`);
            console.log(`   Length: ${buffer.length} bytes\n`);
        }

        // List files
        console.log("5. Listing all files...");
        const allFiles = await listFiles();
        console.log(`   All files: ${allFiles.join(", ")}\n`);

        // List files in folder
        console.log("6. Listing files in 'folder/'...");
        const folderFiles = await listFiles("folder/");
        console.log(`   Files in folder/: ${folderFiles.join(", ")}\n`);

        // Update a file
        console.log("7. Updating file1.txt...");
        await writeFile("file1.txt", "Updated content!");
        const updated = await readFile("file1.txt");
        console.log(`   Updated content: ${updated}\n`);

        // Delete a file
        console.log("8. Deleting data.json...");
        await deleteFile("data.json");
        const stillExists = await fileExists("data.json");
        console.log(`   data.json still exists: ${stillExists}\n`);

        console.log("=== Demo Complete ===");
        console.log(`\nAll files are stored in: ${tempDir}`);
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
