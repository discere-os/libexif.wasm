/**
 * TypeScript definitions for libexif.wasm
 *
 * Copyright (c) 2001-2022 Lutz Mueller <lutz@users.sourceforge.net>
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under LGPL-2.1-or-later
 */

/**
 * EXIF byte order enumeration
 */
export enum ExifByteOrder {
  /** Little endian byte order */
  LITTLE_ENDIAN = 0,
  /** Big endian byte order */
  BIG_ENDIAN = 1
}

/**
 * EXIF data options
 */
export enum ExifDataOption {
  /** Follow specification */
  FOLLOW_SPECIFICATION = 0,
  /** Don't follow specification */
  DONT_FOLLOW_SPECIFICATION = 1
}

/**
 * EXIF IFD enumeration
 */
export enum ExifIfd {
  IFD_0 = 0,
  IFD_1 = 1,
  IFD_EXIF = 2,
  IFD_GPS = 3,
  IFD_INTEROPERABILITY = 4,
  IFD_COUNT = 5
}

/**
 * EXIF tag enumeration (common tags)
 */
export enum ExifTag {
  MAKE = 0x010f,
  MODEL = 0x0110,
  ORIENTATION = 0x0112,
  X_RESOLUTION = 0x011a,
  Y_RESOLUTION = 0x011b,
  RESOLUTION_UNIT = 0x0128,
  SOFTWARE = 0x0131,
  DATE_TIME = 0x0132,
  WHITE_POINT = 0x013e,
  PRIMARY_CHROMATICITIES = 0x013f,
  EXIF_IFD_POINTER = 0x8769,
  GPS_INFO_IFD_POINTER = 0x8825,
  EXPOSURE_TIME = 0x829a,
  FNUMBER = 0x829d,
  ISO_SPEED_RATINGS = 0x8827,
  EXIF_VERSION = 0x9000,
  DATE_TIME_ORIGINAL = 0x9003,
  DATE_TIME_DIGITIZED = 0x9004,
  PIXEL_X_DIMENSION = 0xa002,
  PIXEL_Y_DIMENSION = 0xa003
}

/**
 * EXIF format enumeration
 */
export enum ExifFormat {
  BYTE = 1,
  ASCII = 2,
  SHORT = 3,
  LONG = 4,
  RATIONAL = 5,
  UNDEFINED = 7,
  SLONG = 9,
  SRATIONAL = 10
}

/**
 * Library configuration options
 */
export interface LibexifOptions {
  /** Enable SIMD optimizations for data processing */
  simdOptimizations?: boolean
  /** Maximum memory usage in MB */
  maxMemoryMB?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * EXIF data structure
 */
export interface ExifData {
  /** Number of IFDs */
  ifd_count: number
  /** Byte order of the data */
  byte_order: ExifByteOrder
  /** Data options */
  options: ExifDataOption[]
}

/**
 * EXIF entry structure
 */
export interface ExifEntry {
  /** Tag identifier */
  tag: number
  /** Data format */
  format: ExifFormat
  /** Number of components */
  components: number
  /** Raw data */
  data: Uint8Array
  /** Size of data in bytes */
  size: number
}

/**
 * EXIF content (IFD) structure
 */
export interface ExifContent {
  /** Parent EXIF data */
  parent: ExifData
  /** Array of entries */
  entries: ExifEntry[]
  /** Number of entries */
  count: number
}

/**
 * EXIF loader result
 */
export interface ExifLoadResult {
  /** Success status */
  success: boolean
  /** Parsed EXIF data */
  data?: ExifData
  /** Error message if failed */
  error?: string
  /** Processing time in milliseconds */
  processingTime?: number
  /** Whether SIMD was used */
  simdUsed?: boolean
}

/**
 * EXIF save result
 */
export interface ExifSaveResult {
  /** Success status */
  success: boolean
  /** Saved EXIF data as Uint8Array */
  data?: Uint8Array
  /** Error message if failed */
  error?: string
  /** Processing time in milliseconds */
  processingTime?: number
  /** Whether SIMD was used */
  simdUsed?: boolean
}

/**
 * Tag information structure
 */
export interface TagInfo {
  /** Tag identifier */
  tag: number
  /** Tag name */
  name: string
  /** Tag title */
  title: string
  /** Tag description */
  description: string
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total processing time in milliseconds */
  totalTime: number
  /** Memory usage in bytes */
  memoryUsage: number
  /** Number of entries processed */
  entriesProcessed: number
  /** Whether SIMD optimizations were used */
  simdUsed: boolean
  /** Throughput in MB/s */
  throughputMBs: number
}

/**
 * EXIF parsing statistics
 */
export interface ExifStats {
  /** Total number of tags found */
  totalTags: number
  /** Number of maker note tags */
  makerNoteTags: number
  /** Number of GPS tags */
  gpsTags: number
  /** File size in bytes */
  fileSize: number
  /** EXIF data size in bytes */
  exifDataSize: number
  /** Processing performance metrics */
  performance: PerformanceMetrics
}

/**
 * Camera maker note types
 */
export enum MakerNoteType {
  NONE = 0,
  CANON = 1,
  FUJI = 2,
  OLYMPUS = 3,
  PENTAX = 4
}

/**
 * GPS coordinate structure
 */
export interface GPSCoordinate {
  /** Degrees */
  degrees: number
  /** Minutes */
  minutes: number
  /** Seconds */
  seconds: number
  /** Reference (N/S for latitude, E/W for longitude) */
  reference: string
  /** Decimal degree value */
  decimal: number
}

/**
 * GPS information structure
 */
export interface GPSInfo {
  /** Latitude coordinate */
  latitude?: GPSCoordinate
  /** Longitude coordinate */
  longitude?: GPSCoordinate
  /** Altitude in meters */
  altitude?: number
  /** Timestamp */
  timestamp?: string
  /** Processing method */
  processingMethod?: string
}

/**
 * Camera settings extracted from EXIF
 */
export interface CameraSettings {
  /** Camera make */
  make?: string
  /** Camera model */
  model?: string
  /** Software used */
  software?: string
  /** Date and time */
  dateTime?: string
  /** Orientation */
  orientation?: number
  /** ISO speed */
  iso?: number
  /** Exposure time */
  exposureTime?: number
  /** F-number */
  fnumber?: number
  /** Focal length */
  focalLength?: number
  /** Flash setting */
  flash?: number
  /** White balance */
  whiteBalance?: string
  /** Image dimensions */
  dimensions?: {
    width: number
    height: number
  }
}

/**
 * Complete EXIF information structure
 */
export interface ExifInfo {
  /** Basic camera settings */
  camera: CameraSettings
  /** GPS information if available */
  gps?: GPSInfo
  /** Maker note type */
  makerNoteType: MakerNoteType
  /** All raw entries */
  entries: ExifEntry[]
  /** Processing statistics */
  stats: ExifStats
}