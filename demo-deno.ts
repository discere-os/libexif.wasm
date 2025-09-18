#!/usr/bin/env -S deno run --allow-read --allow-write

import Libexif from "./src/lib/index.ts"
import type { ExifTag } from "./src/lib/types.ts"

/**
 * Comprehensive demo of libexif.wasm functionality
 */
async function demo() {
  console.log("📷 libexif.wasm Demo - EXIF Metadata Processing")
  console.log("=" + "=".repeat(60))

  const lib = new Libexif({
    simdOptimizations: true,
    maxMemoryMB: 128,
    debug: true
  })

  console.log("🔄 Initializing libexif.wasm...")
  await lib.initialize()
  console.log("✅ Library initialized successfully")
  console.log(`🚀 SIMD optimizations: ${lib.isSIMDEnabled() ? 'enabled' : 'disabled'}`)
  console.log(`📦 Version: ${lib.getVersion()}`)

  // Create sample EXIF data for demonstration
  const sampleExifData = createSampleExifData()

  console.log("\n📊 Processing Sample EXIF Data")
  console.log("-".repeat(40))

  const startTime = performance.now()
  const result = lib.loadFromData(sampleExifData)
  const processingTime = performance.now() - startTime

  console.log(`📈 Processing time: ${processingTime.toFixed(2)}ms`)
  console.log(`🔧 SIMD used: ${result.simdUsed ? 'Yes' : 'No'}`)
  console.log(`✨ Success: ${result.success ? 'Yes' : 'No'}`)

  if (!result.success) {
    console.log(`❌ Error: ${result.error}`)
  }

  // Demo tag information
  console.log("\n🏷️ EXIF Tag Information")
  console.log("-".repeat(40))

  const commonTags = [
    0x010f, // MAKE
    0x0110, // MODEL
    0x0112, // ORIENTATION
    0x0131, // SOFTWARE
    0x0132, // DATE_TIME
    0x8769, // EXIF_IFD_POINTER
  ]

  for (const tagValue of commonTags) {
    try {
      const tagInfo = lib.getTagInfo(tagValue)
      console.log(`📋 Tag 0x${tagValue.toString(16).padStart(4, '0')}: ${tagInfo.name} - ${tagInfo.title}`)
    } catch (error) {
      console.log(`⚠️ Tag 0x${tagValue.toString(16).padStart(4, '0')}: ${error}`)
    }
  }

  // Performance benchmarking
  console.log("\n⚡ Performance Benchmarks")
  console.log("-".repeat(40))

  await performanceBenchmarks(lib)

  // SIMD validation test
  console.log("\n🧮 SIMD Validation Tests")
  console.log("-".repeat(40))

  const testData = new Uint8Array(1024).map((_, i) => i % 256)
  const isValid = lib.validateData(testData)
  console.log(`✅ Data validation: ${isValid ? 'passed' : 'failed'}`)

  // Calculate throughput
  const throughput = lib.calculateThroughput(sampleExifData.length, processingTime)
  console.log(`🚀 Throughput: ${throughput.toFixed(2)} MB/s`)

  // Memory usage estimation
  const memoryUsed = sampleExifData.length + (lib.isSIMDEnabled() ? 1024 : 512) // Rough estimate
  console.log(`💾 Estimated memory usage: ${(memoryUsed / 1024).toFixed(2)} KB`)

  console.log("\n📝 All Supported Tags")
  console.log("-".repeat(40))

  const allTags = lib.getAllTags()
  console.log(`📊 Total supported tags: ${allTags.length}`)

  // Show first 10 tags
  for (let i = 0; i < Math.min(10, allTags.length); i++) {
    const tag = allTags[i]
    console.log(`  ${(i + 1).toString().padStart(2)}: ${tag.name} (0x${tag.tag.toString(16).toUpperCase()})`)
  }

  if (allTags.length > 10) {
    console.log(`  ... and ${allTags.length - 10} more tags`)
  }

  lib.cleanup()
  console.log("\n🧹 Cleanup complete")
  console.log("\n🎉 Demo completed successfully!")
}

/**
 * Create sample EXIF data for demonstration
 */
function createSampleExifData(): Uint8Array {
  // Create a minimal EXIF structure for demo purposes
  // This would normally be read from a JPEG file
  const exifHeader = new Uint8Array([
    // JPEG SOI marker
    0xFF, 0xD8,
    // APP1 marker
    0xFF, 0xE1,
    // APP1 length (high byte, low byte)
    0x00, 0x20, // 32 bytes
    // EXIF identifier
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    // TIFF header
    0x4D, 0x4D, // Big endian
    0x00, 0x2A, // TIFF magic number
    0x00, 0x00, 0x00, 0x08, // Offset to first IFD
    // IFD0 entry count
    0x00, 0x01, // 1 entry
    // Sample entry (Orientation tag)
    0x01, 0x12, // Tag: Orientation
    0x00, 0x03, // Type: SHORT
    0x00, 0x00, 0x00, 0x01, // Count: 1
    0x00, 0x01, 0x00, 0x00, // Value: 1 (normal orientation)
    // Next IFD offset
    0x00, 0x00, 0x00, 0x00, // No next IFD
  ])

  return exifHeader
}

/**
 * Performance benchmarking suite
 */
async function performanceBenchmarks(lib: Libexif) {
  const sizes = [1024, 4096, 16384, 65536] // 1KB, 4KB, 16KB, 64KB
  const iterations = 100

  for (const size of sizes) {
    const testData = new Uint8Array(size).map((_, i) => i % 256)

    console.log(`📏 Testing with ${(size / 1024).toFixed(0)}KB data:`)

    // Warm up
    for (let i = 0; i < 10; i++) {
      lib.validateData(testData)
    }

    // Benchmark validation
    const startTime = performance.now()
    for (let i = 0; i < iterations; i++) {
      lib.validateData(testData)
    }
    const endTime = performance.now()

    const avgTime = (endTime - startTime) / iterations
    const throughput = lib.calculateThroughput(size, avgTime)

    console.log(`  ⏱️  Average time: ${avgTime.toFixed(3)}ms`)
    console.log(`  🚀 Throughput: ${throughput.toFixed(2)} MB/s`)
    console.log(`  💨 Operations/sec: ${(1000 / avgTime).toFixed(0)}`)
  }
}

// Run demo if this is the main module
if (import.meta.main) {
  try {
    await demo()
  } catch (error) {
    console.error("❌ Demo failed:", error)
    Deno.exit(1)
  }
}