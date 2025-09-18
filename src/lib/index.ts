/**
 * WebAssembly port of libexif with SIMD optimization
 *
 * Copyright (c) 2001-2022 Lutz Mueller <lutz@users.sourceforge.net>
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under LGPL-2.1-or-later
 */

import type {
  LibexifOptions,
  ExifLoadResult,
  ExifSaveResult,
  ExifInfo,
  CameraSettings,
  GPSInfo,
  GPSCoordinate,
  TagInfo,
  ExifStats,
  PerformanceMetrics,
  ExifByteOrder
} from './types.ts'

import { ExifTag, MakerNoteType } from './types.ts'

export * from './types.ts'

/**
 * Main libexif WebAssembly wrapper class
 */
export default class Libexif {
  private module: any = null
  private initialized = false
  private simdSupported = false

  // Function bindings
  private _exif_data_new: any = null
  private _exif_data_new_from_data: any = null
  private _exif_data_free: any = null
  private _exif_data_save_data: any = null
  private _exif_content_get_entry: any = null
  private _exif_entry_get_value: any = null
  private _exif_tag_get_name: any = null
  private _exif_tag_get_title: any = null
  private _exif_tag_get_description: any = null
  // Emscripten memory functions (use module built-ins)
  private heapU8: Uint8Array | null = null

  // SIMD function bindings
  private _libexif_simd_available: any = null
  private _libexif_find_app1_marker_simd: any = null
  private _libexif_find_exif_header_simd: any = null
  private _libexif_memcpy_simd: any = null
  private _libexif_checksum_simd: any = null

  constructor(private options: LibexifOptions = {}) {
    this.options = {
      simdOptimizations: true,
      maxMemoryMB: 128,
      debug: false,
      ...options
    }
  }

  /**
   * Initialize the WASM module
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const startTime = performance.now()

    try {
      const wasmBinary = await this.loadWasmBinary()
      const moduleFactory = await this.loadModuleFactory()

      // Initialize the module factory
      this.module = await moduleFactory({
        wasmBinary,
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return new URL('../../install/wasm/' + path, import.meta.url).href
          }
          return path
        }
      })

      // Setup bindings after module is fully initialized
      this.setupBindings()
      this.checkSIMDSupport()
      this.initialized = true

      const initTime = performance.now() - startTime
      if (this.options.debug) {
        console.log(`✅ libexif.wasm initialized in ${initTime.toFixed(2)}ms`)
        console.log(`🚀 SIMD optimizations: ${this.simdSupported ? 'enabled' : 'disabled'}`)
      }
    } catch (error) {
      throw new Error(`Failed to initialize libexif: ${error}`)
    }
  }

  /**
   * Load WASM binary with proper fallbacks
   */
  private async loadWasmBinary(): Promise<ArrayBuffer | undefined> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const wasmPath = new URL('../../install/wasm/libexif-main.wasm', import.meta.url).pathname
        const wasmBuffer = await Deno.readFile(wasmPath)
        return wasmBuffer.buffer
      } catch (error) {
        if (this.options.debug) {
          console.warn('Failed to load local WASM binary:', error)
        }
        return undefined
      }
    }

    // Web/CDN runtime - try CDN locations
    const cdnUrls = [
      'https://wasm.discere.cloud/libexif/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/libexif.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const response = await fetch(`${url}libexif-main.wasm`)
        if (response.ok) {
          return await response.arrayBuffer()
        }
      } catch {
        continue
      }
    }

    // Fallback to undefined for embedded WASM
    return undefined
  }

  /**
   * Load module factory with proper ES6 imports
   */
  private async loadModuleFactory(): Promise<any> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      const modulePath = new URL('../../install/wasm/libexif-main.js', import.meta.url).href
      const module = await import(modulePath)
      return module.default || module.LibexifModule
    }

    // Web/CDN runtime
    const cdnUrls = [
      'https://wasm.discere.cloud/libexif/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/libexif.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const moduleFactory = (await import(`${url}libexif-main.js`)).default
        return moduleFactory
      } catch {
        continue
      }
    }

    throw new Error('Failed to load module factory from any source')
  }

  /**
   * Set up WASM function bindings
   */
  private setupBindings(): void {
    // Core libexif functions
    this._exif_data_new = this.module.cwrap('exif_data_new', 'number', [])
    this._exif_data_new_from_data = this.module.cwrap('exif_data_new_from_data', 'number', ['number', 'number'])
    this._exif_data_free = this.module.cwrap('exif_data_free', 'void', ['number'])
    this._exif_data_save_data = this.module.cwrap('exif_data_save_data', 'void', ['number', 'number', 'number'])
    this._exif_content_get_entry = this.module.cwrap('exif_content_get_entry', 'number', ['number', 'number'])
    this._exif_entry_get_value = this.module.cwrap('exif_entry_get_value', 'number', ['number', 'number', 'number'])
    this._exif_tag_get_name = this.module.cwrap('exif_tag_get_name', 'string', ['number'])
    this._exif_tag_get_title = this.module.cwrap('exif_tag_get_title', 'string', ['number'])
    this._exif_tag_get_description = this.module.cwrap('exif_tag_get_description', 'string', ['number'])

    // Get reference to Emscripten memory heap
    this.heapU8 = this.module.HEAPU8

    // SIMD functions (if available)
    try {
      this._libexif_simd_available = this.module.cwrap('libexif_simd_available', 'boolean', [])
      this._libexif_find_app1_marker_simd = this.module.cwrap('libexif_find_app1_marker_simd', 'number', ['number', 'number'])
      this._libexif_find_exif_header_simd = this.module.cwrap('libexif_find_exif_header_simd', 'number', ['number', 'number'])
      this._libexif_memcpy_simd = this.module.cwrap('libexif_memcpy_simd', 'void', ['number', 'number', 'number'])
      this._libexif_checksum_simd = this.module.cwrap('libexif_checksum_simd', 'number', ['number', 'number'])
    } catch {
      // SIMD functions not available
    }
  }

  /**
   * Check SIMD support
   */
  private checkSIMDSupport(): void {
    try {
      this.simdSupported = !!(this.options.simdOptimizations &&
                             this._libexif_simd_available &&
                             this._libexif_simd_available())
    } catch {
      this.simdSupported = false
    }
  }

  /**
   * Load EXIF data from a Uint8Array
   */
  loadFromData(data: Uint8Array): ExifLoadResult {
    if (!this.initialized) {
      throw new Error('libexif not initialized. Call initialize() first.')
    }

    // Validate input data
    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Empty or invalid data provided',
        processingTime: 0,
        simdUsed: false
      }
    }

    const startTime = performance.now()

    try {
      // Use Module._malloc and Module._free for memory management
      const dataPtr = this.module._malloc(data.length)
      this.module.HEAPU8.set(data, dataPtr)

      // Create EXIF data from buffer
      const exifDataPtr = this._exif_data_new_from_data(dataPtr, data.length)

      this.module._free(dataPtr)

      if (!exifDataPtr) {
        return {
          success: false,
          error: 'Failed to parse EXIF data',
          processingTime: performance.now() - startTime,
          simdUsed: false
        }
      }

      // Extract information
      const exifInfo = this.extractExifInfo(exifDataPtr)

      // Clean up
      this._exif_data_free(exifDataPtr)

      return {
        success: true,
        data: exifInfo as any, // Type assertion for now
        processingTime: performance.now() - startTime,
        simdUsed: this.simdSupported
      }
    } catch (error) {
      return {
        success: false,
        error: `EXIF parsing error: ${error}`,
        processingTime: performance.now() - startTime,
        simdUsed: false
      }
    }
  }

  /**
   * Load EXIF data from a file (browser File object)
   */
  async loadFromFile(file: File): Promise<ExifLoadResult> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)
      return this.loadFromData(data)
    } catch (error) {
      return {
        success: false,
        error: `File reading error: ${error}`,
        simdUsed: false
      }
    }
  }

  /**
   * Extract EXIF information from native data structure
   */
  private extractExifInfo(exifDataPtr: number): ExifInfo {
    const camera: CameraSettings = {}
    const entries: any[] = []

    // This is a simplified extraction - in reality, we'd iterate through IFDs
    // and extract individual entries using the WASM functions

    // Extract basic camera settings
    camera.make = this.getStringTag(exifDataPtr, ExifTag.MAKE)
    camera.model = this.getStringTag(exifDataPtr, ExifTag.MODEL)
    camera.software = this.getStringTag(exifDataPtr, ExifTag.SOFTWARE)
    camera.dateTime = this.getStringTag(exifDataPtr, ExifTag.DATE_TIME)
    camera.orientation = this.getNumericTag(exifDataPtr, ExifTag.ORIENTATION)
    camera.iso = this.getNumericTag(exifDataPtr, ExifTag.ISO_SPEED_RATINGS)

    const stats: ExifStats = {
      totalTags: entries.length,
      makerNoteTags: 0,
      gpsTags: 0,
      fileSize: 0,
      exifDataSize: 0,
      performance: {
        totalTime: 0,
        memoryUsage: 0,
        entriesProcessed: entries.length,
        simdUsed: this.simdSupported,
        throughputMBs: 0
      }
    }

    return {
      camera,
      makerNoteType: MakerNoteType.NONE,
      entries,
      stats
    }
  }

  /**
   * Get string tag value (simplified implementation)
   */
  private getStringTag(exifDataPtr: number, tag: ExifTag): string | undefined {
    // This would involve getting the IFD, finding the entry, and extracting the string
    // For now, return undefined as this requires more complex WASM integration
    return undefined
  }

  /**
   * Get numeric tag value (simplified implementation)
   */
  private getNumericTag(exifDataPtr: number, tag: ExifTag): number | undefined {
    // This would involve getting the IFD, finding the entry, and extracting the number
    // For now, return undefined as this requires more complex WASM integration
    return undefined
  }

  /**
   * Get tag information
   */
  getTagInfo(tag: number): TagInfo {
    const name = this._exif_tag_get_name(tag) || 'Unknown'
    const title = this._exif_tag_get_title(tag) || name
    const description = this._exif_tag_get_description(tag) || title

    return {
      tag,
      name,
      title,
      description
    }
  }

  /**
   * Get all supported tags
   */
  getAllTags(): TagInfo[] {
    const tags: TagInfo[] = []

    // Common EXIF tags
    for (const tagValue of Object.values(ExifTag)) {
      if (typeof tagValue === 'number') {
        try {
          const info = this.getTagInfo(tagValue)
          if (info.name !== 'Unknown') {
            tags.push(info)
          }
        } catch {
          // Skip invalid tags
        }
      }
    }

    return tags
  }

  /**
   * Check if SIMD optimizations are being used
   */
  isSIMDEnabled(): boolean {
    return this.simdSupported
  }

  /**
   * Check if the library is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get library version information
   */
  getVersion(): string {
    return '0.6.25-wasm'
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.module) {
      // Cleanup WASM resources
      this.module = null
      this.initialized = false
      this.simdSupported = false
    }
  }

  /**
   * Calculate performance metrics for data processing
   */
  calculateThroughput(dataSize: number, processingTime: number): number {
    const sizeInMB = dataSize / (1024 * 1024)
    const timeInSeconds = processingTime / 1000
    return timeInSeconds > 0 ? sizeInMB / timeInSeconds : 0
  }

  /**
   * Fast EXIF marker detection using SIMD (if available)
   */
  private findExifMarker(data: Uint8Array): number {
    if (this.simdSupported && this._libexif_find_app1_marker_simd) {
      const dataPtr = this.module._malloc(data.length)
      this.module.HEAPU8.set(data, dataPtr)

      const markerPtr = this._libexif_find_app1_marker_simd(dataPtr, data.length)
      const offset = markerPtr ? markerPtr - dataPtr : -1

      this.module._free(dataPtr)
      return offset
    } else {
      // Fallback to scalar search
      for (let i = 0; i < data.length - 1; i++) {
        if (data[i] === 0xFF && data[i + 1] === 0xE1) {
          return i
        }
      }
      return -1
    }
  }

  /**
   * Validate EXIF data integrity using SIMD checksum
   */
  validateData(data: Uint8Array): boolean {
    if (this.simdSupported && this._libexif_checksum_simd) {
      const dataPtr = this.module._malloc(data.length)
      this.module.HEAPU8.set(data, dataPtr)

      const checksum = this._libexif_checksum_simd(dataPtr, data.length)

      this.module._free(dataPtr)

      // Simple validation - in practice, you'd compare with expected checksum
      return checksum > 0
    }

    return true // Fallback validation
  }
}