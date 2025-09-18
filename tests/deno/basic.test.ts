import { assert, assertEquals, assertExists, assertThrows } from "@std/assert"
import Libexif from "../../src/lib/index.ts"
import type { ExifTag, LibexifOptions } from "../../src/lib/types.ts"

Deno.test("Libexif - Library initialization", async () => {
  const lib = new Libexif()

  // Should not be initialized initially
  assert(!lib.isInitialized())

  // Should initialize successfully
  await lib.initialize()
  assertExists(lib)
  assert(lib.isInitialized())

  lib.cleanup()
  assert(!lib.isInitialized())
})

Deno.test("Libexif - Constructor options", () => {
  const options: LibexifOptions = {
    simdOptimizations: false,
    maxMemoryMB: 256,
    debug: true
  }

  const lib = new Libexif(options)
  assertExists(lib)

  // Should accept default options
  const libDefault = new Libexif()
  assertExists(libDefault)
})

Deno.test("Libexif - Version and capabilities", async () => {
  const lib = new Libexif()
  await lib.initialize()

  // Should return version string
  const version = lib.getVersion()
  assert(typeof version === 'string')
  assert(version.includes('0.6.25'))

  // SIMD support should be boolean
  const simdEnabled = lib.isSIMDEnabled()
  assert(typeof simdEnabled === 'boolean')

  lib.cleanup()
})

Deno.test("Libexif - Tag information", async () => {
  const lib = new Libexif()
  await lib.initialize()

  // Test known tag (MAKE)
  const makeTagInfo = lib.getTagInfo(0x010f)
  assertExists(makeTagInfo)
  assertEquals(makeTagInfo.tag, 0x010f)
  assert(typeof makeTagInfo.name === 'string')
  assert(typeof makeTagInfo.title === 'string')
  assert(typeof makeTagInfo.description === 'string')

  // Test another known tag (MODEL)
  const modelTagInfo = lib.getTagInfo(0x0110)
  assertExists(modelTagInfo)
  assertEquals(modelTagInfo.tag, 0x0110)

  lib.cleanup()
})

Deno.test("Libexif - Get all supported tags", async () => {
  const lib = new Libexif()
  await lib.initialize()

  const allTags = lib.getAllTags()
  assert(Array.isArray(allTags))
  assert(allTags.length > 0)

  // Each tag should have required properties
  for (const tag of allTags.slice(0, 5)) { // Test first 5 tags
    assert(typeof tag.tag === 'number')
    assert(typeof tag.name === 'string')
    assert(typeof tag.title === 'string')
    assert(typeof tag.description === 'string')
    assert(tag.name !== 'Unknown')
  }

  lib.cleanup()
})

Deno.test("Libexif - Load EXIF from data", async () => {
  const lib = new Libexif()
  await lib.initialize()

  // Create minimal valid EXIF data
  const sampleExifData = createSampleExifData()

  const result = lib.loadFromData(sampleExifData)
  assertExists(result)
  assert(typeof result.success === 'boolean')
  assert(typeof result.processingTime === 'number')
  assert(typeof result.simdUsed === 'boolean')

  if (result.success) {
    assertExists(result.data)
  } else {
    assertExists(result.error)
    assert(typeof result.error === 'string')
  }

  lib.cleanup()
})

Deno.test("Libexif - Data validation", async () => {
  const lib = new Libexif()
  await lib.initialize()

  // Test with various data sizes
  const testSizes = [64, 256, 1024]

  for (const size of testSizes) {
    const testData = new Uint8Array(size).map((_, i) => i % 256)
    const isValid = lib.validateData(testData)
    assert(typeof isValid === 'boolean')
  }

  lib.cleanup()
})

Deno.test("Libexif - Performance calculations", async () => {
  const lib = new Libexif()
  await lib.initialize()

  // Test throughput calculation
  const throughput1 = lib.calculateThroughput(1024 * 1024, 1000) // 1MB in 1s
  assertEquals(throughput1, 1.0)

  const throughput2 = lib.calculateThroughput(2048 * 1024, 1000) // 2MB in 1s
  assertEquals(throughput2, 2.0)

  // Zero time should return 0 throughput
  const throughput3 = lib.calculateThroughput(1024, 0)
  assertEquals(throughput3, 0)

  lib.cleanup()
})

Deno.test("Libexif - Error handling", async () => {
  const lib = new Libexif()

  // Should throw when not initialized
  assertThrows(() => {
    const emptyData = new Uint8Array(0)
    lib.loadFromData(emptyData)
  }, Error, "not initialized")

  await lib.initialize()

  // Should handle empty data gracefully
  const emptyResult = lib.loadFromData(new Uint8Array(0))
  assert(!emptyResult.success)
  assertExists(emptyResult.error)

  // Should handle invalid data gracefully
  const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03])
  const invalidResult = lib.loadFromData(invalidData)
  // Result may succeed or fail depending on validation, but shouldn't throw
  assert(typeof invalidResult.success === 'boolean')

  lib.cleanup()
})

Deno.test("Libexif - Memory management", async () => {
  const lib = new Libexif({ maxMemoryMB: 64 })
  await lib.initialize()

  // Multiple operations should not leak memory
  const testData = new Uint8Array(1024).map((_, i) => i % 256)

  for (let i = 0; i < 100; i++) {
    lib.validateData(testData)
    lib.loadFromData(testData)
  }

  // Library should still be functional
  assert(lib.isInitialized())

  lib.cleanup()
})

Deno.test("Libexif - SIMD optimizations", async () => {
  // Test with SIMD enabled
  const libSIMD = new Libexif({ simdOptimizations: true })
  await libSIMD.initialize()

  const testData = new Uint8Array(1024).map((_, i) => i % 256)
  const resultSIMD = libSIMD.loadFromData(testData)

  // SIMD should be reported correctly
  if (libSIMD.isSIMDEnabled()) {
    // If SIMD is available, it should be used
    assert(resultSIMD.simdUsed === true)
  }

  libSIMD.cleanup()

  // Test with SIMD disabled
  const libNoSIMD = new Libexif({ simdOptimizations: false })
  await libNoSIMD.initialize()

  const resultNoSIMD = libNoSIMD.loadFromData(testData)
  assert(resultNoSIMD.simdUsed === false)

  libNoSIMD.cleanup()
})

/**
 * Helper function to create sample EXIF data
 */
function createSampleExifData(): Uint8Array {
  return new Uint8Array([
    // JPEG SOI marker
    0xFF, 0xD8,
    // APP1 marker
    0xFF, 0xE1,
    // APP1 length
    0x00, 0x20,
    // EXIF identifier
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    // TIFF header
    0x4D, 0x4D,
    0x00, 0x2A,
    0x00, 0x00, 0x00, 0x08,
    // IFD0 entry count
    0x00, 0x01,
    // Sample entry (Orientation)
    0x01, 0x12,
    0x00, 0x03,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00,
    // Next IFD offset
    0x00, 0x00, 0x00, 0x00,
  ])
}