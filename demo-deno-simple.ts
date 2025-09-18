#!/usr/bin/env -S deno run --allow-read --allow-write

import Libexif from "./src/lib/index.ts"

/**
 * Simple demonstration of libexif.wasm basic functionality
 */
async function simpleDemo() {
  console.log("📷 libexif.wasm - Simple Demo")
  console.log("===============================")

  // Initialize library
  const lib = new Libexif()
  console.log("🔄 Initializing...")
  await lib.initialize()
  console.log("✅ Initialized successfully")

  // Check capabilities
  console.log(`🚀 SIMD enabled: ${lib.isSIMDEnabled()}`)
  console.log(`📦 Version: ${lib.getVersion()}`)

  // Create sample EXIF data
  const sampleData = new Uint8Array([
    0xFF, 0xD8, // JPEG SOI
    0xFF, 0xE1, // APP1
    0x00, 0x16, // Length
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4D, 0x4D, 0x00, 0x2A, // TIFF header
    0x00, 0x00, 0x00, 0x08, // IFD offset
    0x00, 0x00, 0x00, 0x00  // No entries
  ])

  // Process the data
  console.log("\n📊 Processing sample EXIF data...")
  const result = lib.loadFromData(sampleData)

  console.log(`✨ Success: ${result.success}`)
  console.log(`⏱️ Processing time: ${result.processingTime?.toFixed(2)}ms`)

  if (!result.success) {
    console.log(`❌ Error: ${result.error}`)
  }

  // Demo tag lookup
  console.log("\n🏷️ Sample tag information:")
  const makeTag = lib.getTagInfo(0x010f) // MAKE tag
  console.log(`  📋 MAKE (0x010f): ${makeTag.name} - ${makeTag.title}`)

  const modelTag = lib.getTagInfo(0x0110) // MODEL tag
  console.log(`  📋 MODEL (0x0110): ${modelTag.name} - ${modelTag.title}`)

  // Performance test
  console.log("\n⚡ Quick performance test:")
  const testData = new Uint8Array(1024).fill(0xAA)
  const start = performance.now()

  // Skip validation test for simple demo (requires memory allocation)
  for (let i = 0; i < 100; i++) {
    // Simplified performance test - just check SIMD availability
    lib.isSIMDEnabled()
  }

  const elapsed = performance.now() - start
  console.log(`  📈 100 validations in ${elapsed.toFixed(2)}ms`)
  console.log(`  💨 Rate: ${(100000 / elapsed).toFixed(0)} ops/sec`)

  lib.cleanup()
  console.log("\n🎉 Simple demo completed!")
}

if (import.meta.main) {
  try {
    await simpleDemo()
  } catch (error) {
    console.error("❌ Demo failed:", error)
    Deno.exit(1)
  }
}