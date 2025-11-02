// deno-lint-ignore-file no-import-prefix
/**
 * This example demonstrates BucketFS caching capabilities. It shows how to enable caching,
 * demonstrates cache performance improvements, and shows cache management features.
 *
 * @cross/env is only used in these examples to easily read a .env file and at the same
 * time make sure that required environment variables are supplied as they will throw an error
 * if they are missing when using requireEnv().
 */

import "jsr:@cross/env@^1.0.2/load";
import { requireEnv } from "jsr:@cross/env@^1.0.2";

import { clearCache, fileExists, getCacheStats, initBucket, listFiles, readFile, writeFile } from "../mod.ts";

async function main() {
    // Initialize with Google Cloud Storage - with caching enabled
    initBucket({
        provider: "gcs",
        bucketName: requireEnv("GCS_BUCKET_NAME"),
        projectId: requireEnv("GCS_PROJECT_ID"),
        credentials: {
            clientEmail: requireEnv("GCS_CLIENT_EMAIL"),
            privateKey: requireEnv("GCS_PRIVATE_KEY").replace(/\\n/g, "\n"),
        },
        cache: {
            enabled: true,
            maxSize: 1000, // Cache up to 1000 files
            ttl: 3600000, // Cache entries expire after 1 hour (3600000ms)
            includeReads: true, // Cache read operations
            includeWrites: true, // Cache write operations
        },
    });
    /*
    // You can also enable caching for other providers:

    // Initialize BucketFS with AWS S3 (with caching)
    initBucket({
        provider: "aws-s3",
        bucketName: requireEnv("S3_BUCKET_NAME"),
        region: requireEnv("S3_REGION"),
        credentials: {
            accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
        },
        cache: {
            enabled: true,
            maxSize: 2000,
            ttl: 1800000,  // 30 minutes
        },
    });

    // Initialize with Cloudflare R2 (with caching)
    initBucket({
        provider: "cf-r2",
        bucketName: requireEnv("R2_BUCKET_NAME"),
        accountId: requireEnv("R2_ACCOUNT_ID"),
        credentials: {
            accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
        cache: {
            enabled: true,
        },
    });
    */

    try {
        console.log("=== BucketFS Caching Demo ===\n");

        // Write a file (will be cached)
        console.log("1. Writing file...");
        await writeFile("cache-demo.txt", "Hello from BucketFS with caching!");
        console.log("   ✓ File written (now cached)\n");

        // Check cache stats
        const cacheStats = getCacheStats();
        console.log("2. Cache stats after write:");
        console.log(`   Size: ${cacheStats?.size || 0}/${cacheStats?.maxSize || 0} entries\n`);

        // Check if file exists
        console.log("3. Checking if file exists...");
        const exists = await fileExists("cache-demo.txt");
        console.log(`   File exists: ${exists}\n`);

        // Read the file (first read - from cloud)
        console.log("4. First read (from cloud storage)...");
        const start1 = performance.now();
        const content1 = await readFile("cache-demo.txt");
        const time1 = performance.now() - start1;
        console.log(`   Content: ${content1}`);
        console.log(`   Time: ${time1.toFixed(2)}ms\n`);

        // Read the file again (second read - from cache)
        console.log("5. Second read (from cache - should be faster)...");
        const start2 = performance.now();
        const content2 = await readFile("cache-demo.txt");
        const time2 = performance.now() - start2;
        console.log(`   Content: ${content2}`);
        console.log(`   Time: ${time2.toFixed(2)}ms ${time2 < time1 ? "✓ (faster!)" : ""}\n`);

        // Check cache stats again
        const cacheStatsAfterReads = getCacheStats();
        console.log("6. Cache stats after reads:");
        console.log(`   Size: ${cacheStatsAfterReads?.size || 0}/${cacheStatsAfterReads?.maxSize || 0} entries\n`);

        // Update file (cache will be updated automatically)
        console.log("7. Updating file (cache will be updated)...");
        await writeFile("cache-demo.txt", "Hello from BucketFS - Updated with caching!");
        const content3 = await readFile("cache-demo.txt");
        console.log(`   Updated content: ${content3}\n`);

        // Read updated file (should be from cache)
        console.log("8. Reading updated file (from cache)...");
        const start3 = performance.now();
        const content4 = await readFile("cache-demo.txt");
        const time3 = performance.now() - start3;
        console.log(`   Content: ${content4}`);
        console.log(`   Time: ${time3.toFixed(2)}ms (cached)\n`);

        // List files
        console.log("9. Listing files in bucket...");
        const files = await listFiles();
        console.log(`   Files: ${files.length > 0 ? files.join(", ") : "none"}\n`);

        // Clear cache manually
        console.log("10. Clearing cache manually...");
        clearCache();
        const cacheStatsAfterClear = getCacheStats();
        console.log(
            `    Cache stats: ${cacheStatsAfterClear?.size || 0}/${cacheStatsAfterClear?.maxSize || 0} entries\n`,
        );

        // Read again (from cloud since cache was cleared)
        console.log("11. Reading file after cache clear (from cloud)...");
        const start4 = performance.now();
        const content5 = await readFile("cache-demo.txt");
        const time4 = performance.now() - start4;
        console.log(`    Content: ${content5}`);
        console.log(`    Time: ${time4.toFixed(2)}ms (from cloud)\n`);

        console.log("=== Demo Complete ===");
        console.log("\nSummary:");
        console.log("  - First read (cloud):  " + time1.toFixed(2) + "ms");
        console.log("  - Second read (cache): " + time2.toFixed(2) + "ms");
        console.log("  - After clear (cloud):  " + time4.toFixed(2) + "ms");
        if (time2 < time1) {
            const speedup = ((time1 - time2) / time1 * 100).toFixed(1);
            console.log(`  - Cache speedup: ${speedup}% faster`);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
