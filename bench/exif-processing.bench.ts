import Libexif from "../src/lib/index.ts"

let lib: Libexif
let libNoSIMD: Libexif
let testData1KB: Uint8Array
let testData4KB: Uint8Array
let testData16KB: Uint8Array
let sampleExifData: Uint8Array

// Setup before benchmarks
await (async () => {
  // Initialize libraries
  lib = new Libexif({ simdOptimizations: true, debug: false })
  libNoSIMD = new Libexif({ simdOptimizations: false, debug: false })

  await lib.initialize()
  await libNoSIMD.initialize()

  // Create test data
  testData1KB = new Uint8Array(1024).map((_, i) => i % 256)
  testData4KB = new Uint8Array(4096).map((_, i) => i % 256)
  testData16KB = new Uint8Array(16384).map((_, i) => i % 256)

  sampleExifData = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x20,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ])

  console.log(`🚀 SIMD enabled: ${lib.isSIMDEnabled()}`)
  console.log(`📏 Test data sizes: 1KB, 4KB, 16KB`)
  console.log(`📊 Sample EXIF data: ${sampleExifData.length} bytes`)
})()

// EXIF Processing Benchmarks
Deno.bench("EXIF Processing - Load sample data (SIMD)", () => {
  lib.loadFromData(sampleExifData)
})

Deno.bench("EXIF Processing - Load sample data (No SIMD)", () => {
  libNoSIMD.loadFromData(sampleExifData)
})

// Data validation benchmarks
Deno.bench("Data Validation - 1KB (SIMD)", () => {
  lib.validateData(testData1KB)
})

Deno.bench("Data Validation - 1KB (No SIMD)", () => {
  libNoSIMD.validateData(testData1KB)
})

Deno.bench("Data Validation - 4KB (SIMD)", () => {
  lib.validateData(testData4KB)
})

Deno.bench("Data Validation - 4KB (No SIMD)", () => {
  libNoSIMD.validateData(testData4KB)
})

Deno.bench("Data Validation - 16KB (SIMD)", () => {
  lib.validateData(testData16KB)
})

Deno.bench("Data Validation - 16KB (No SIMD)", () => {
  libNoSIMD.validateData(testData16KB)
})

// Tag information benchmarks
Deno.bench("Tag Info - Single tag lookup", () => {
  lib.getTagInfo(0x010f) // MAKE tag
})

Deno.bench("Tag Info - Multiple tag lookups", () => {
  const tags = [0x010f, 0x0110, 0x0112, 0x0131, 0x0132, 0x8769]
  for (const tag of tags) {
    lib.getTagInfo(tag)
  }
})

Deno.bench("Tag Info - Get all supported tags", () => {
  lib.getAllTags()
})

// Performance calculation benchmarks
Deno.bench("Throughput Calculation - Various sizes", () => {
  lib.calculateThroughput(1024, 10)
  lib.calculateThroughput(4096, 25)
  lib.calculateThroughput(16384, 100)
  lib.calculateThroughput(65536, 400)
})

// Memory allocation patterns
Deno.bench("Memory Pattern - Repeated small operations", () => {
  const smallData = new Uint8Array(64).fill(0xFF)
  for (let i = 0; i < 10; i++) {
    lib.validateData(smallData)
  }
})

Deno.bench("Memory Pattern - Single large operation", () => {
  const largeData = new Uint8Array(640).fill(0xFF)
  lib.validateData(largeData)
})

// Real-world simulation benchmarks
Deno.bench("Simulation - JPEG EXIF processing", () => {
  // Simulate processing a typical JPEG EXIF block
  const jpegExifSim = new Uint8Array(512)
  // Add some realistic EXIF patterns
  jpegExifSim[0] = 0xFF
  jpegExifSim[1] = 0xE1
  jpegExifSim[4] = 0x45 // E
  jpegExifSim[5] = 0x78 // x
  jpegExifSim[6] = 0x69 // i
  jpegExifSim[7] = 0x66 // f

  lib.loadFromData(jpegExifSim)
})

Deno.bench("Simulation - Multiple images batch", () => {
  // Simulate processing multiple small images
  const images = [
    new Uint8Array(256),
    new Uint8Array(512),
    new Uint8Array(384),
    new Uint8Array(128)
  ]

  for (const imageData of images) {
    // Add basic EXIF structure
    if (imageData.length > 10) {
      imageData[0] = 0xFF
      imageData[1] = 0xE1
      imageData[4] = 0x45
      imageData[5] = 0x78
      imageData[6] = 0x69
      imageData[7] = 0x66
    }
    lib.loadFromData(imageData)
  }
})

// Stress test benchmarks
Deno.bench("Stress Test - High frequency operations", () => {
  const microData = new Uint8Array(32).fill(0xAA)
  for (let i = 0; i < 100; i++) {
    lib.validateData(microData)
  }
})

// Clean up after benchmarks
globalThis.addEventListener("unload", () => {
  lib?.cleanup()
  libNoSIMD?.cleanup()
  console.log("🧹 Benchmark cleanup completed")
})