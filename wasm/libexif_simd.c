/*
 * libexif SIMD optimizations for WebAssembly
 *
 * Copyright (c) 2001-2022 Lutz Mueller <lutz@users.sourceforge.net>
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under LGPL-2.1-or-later
 */

#include <wasm_simd128.h>
#include <emscripten.h>
#include <stdbool.h>
#include <string.h>
#include <stdint.h>

// SIMD feature detection
EMSCRIPTEN_KEEPALIVE
bool libexif_simd_available() {
#ifdef __wasm_simd128__
    return true;
#else
    return false;
#endif
}

// Fast EXIF data copying for IFD processing
EMSCRIPTEN_KEEPALIVE
void libexif_memcpy_simd(uint8_t* dest, const uint8_t* src, size_t len) {
    // Handle unaligned prefix
    while (((uintptr_t)dest & 15) && len > 0) {
        *dest++ = *src++;
        len--;
    }

    // SIMD copy for aligned data (64 bytes per iteration)
    while (len >= 64) {
        v128_t v0 = wasm_v128_load(&src[0]);
        v128_t v1 = wasm_v128_load(&src[16]);
        v128_t v2 = wasm_v128_load(&src[32]);
        v128_t v3 = wasm_v128_load(&src[48]);

        wasm_v128_store(&dest[0], v0);
        wasm_v128_store(&dest[16], v1);
        wasm_v128_store(&dest[32], v2);
        wasm_v128_store(&dest[48], v3);

        src += 64;
        dest += 64;
        len -= 64;
    }

    // Handle remainder
    while (len--) {
        *dest++ = *src++;
    }
}

// Fast search for EXIF markers (0xFF 0xE1 for APP1 segment)
EMSCRIPTEN_KEEPALIVE
const uint8_t* libexif_find_app1_marker_simd(const uint8_t* data, size_t len) {
    if (len < 4) return NULL;

    v128_t marker_0xff = wasm_i8x16_splat(0xFF);
    v128_t marker_0xe1 = wasm_i8x16_splat(0xE1);

    // Process 16 bytes per iteration, but check 15 positions for 2-byte pattern
    size_t i = 0;
    for (; i + 16 < len; i += 16) {
        v128_t chunk = wasm_v128_load(&data[i]);
        v128_t next_chunk = wasm_v128_load(&data[i + 1]);

        // Find 0xFF bytes
        v128_t ff_matches = wasm_i8x16_eq(chunk, marker_0xff);
        // Find 0xE1 bytes in next position
        v128_t e1_matches = wasm_i8x16_eq(next_chunk, marker_0xe1);

        // AND the results to find FF E1 patterns
        v128_t combined = wasm_v128_and(ff_matches, e1_matches);
        int32_t mask = wasm_i8x16_bitmask(combined);

        if (mask) {
            // Found potential match - verify byte by byte
            for (int j = 0; j < 15; j++) { // Only check first 15 positions
                if ((mask & (1 << j)) && i + j + 1 < len) {
                    if (data[i + j] == 0xFF && data[i + j + 1] == 0xE1) {
                        return &data[i + j];
                    }
                }
            }
        }
    }

    // Scalar fallback for remainder
    for (; i + 1 < len; i++) {
        if (data[i] == 0xFF && data[i + 1] == 0xE1) {
            return &data[i];
        }
    }
    return NULL;
}

// Fast search for EXIF header "Exif\0\0" in APP1 segment
EMSCRIPTEN_KEEPALIVE
const uint8_t* libexif_find_exif_header_simd(const uint8_t* data, size_t len) {
    if (len < 6) return NULL;

    // Create SIMD vectors for "Exif\0\0" pattern
    v128_t pattern = wasm_i8x16_make(
        'E', 'x', 'i', 'f', 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0
    );

    size_t i = 0;
    for (; i + 16 < len; i += 16) {
        v128_t chunk = wasm_v128_load(&data[i]);

        // Compare first 6 bytes with pattern
        // This is a simplified check - we verify with scalar code
        v128_t cmp = wasm_i8x16_eq(chunk, pattern);
        int32_t mask = wasm_i8x16_bitmask(cmp) & 0x3F; // Only first 6 bits

        if (mask == 0x3F) { // All 6 bytes match
            // Verify the match manually
            if (i + 5 < len &&
                data[i] == 'E' && data[i + 1] == 'x' &&
                data[i + 2] == 'i' && data[i + 3] == 'f' &&
                data[i + 4] == 0 && data[i + 5] == 0) {
                return &data[i];
            }
        }
    }

    // Scalar fallback
    for (; i + 5 < len; i++) {
        if (data[i] == 'E' && data[i + 1] == 'x' &&
            data[i + 2] == 'i' && data[i + 3] == 'f' &&
            data[i + 4] == 0 && data[i + 5] == 0) {
            return &data[i];
        }
    }
    return NULL;
}

// Fast byte order conversion for multi-byte values in EXIF data
EMSCRIPTEN_KEEPALIVE
void libexif_convert_endian_16_simd(uint16_t* data, size_t count) {
    size_t simd_count = count & ~7; // Process 8 uint16s at a time

    for (size_t i = 0; i < simd_count; i += 8) {
        v128_t values = wasm_v128_load(&data[i]);

        // Swap bytes: (AB CD) -> (BA DC)
        v128_t swapped = wasm_i8x16_shuffle(values, values,
            1, 0, 3, 2, 5, 4, 7, 6,   // First 8 bytes
            9, 8, 11, 10, 13, 12, 15, 14  // Second 8 bytes
        );

        wasm_v128_store(&data[i], swapped);
    }

    // Handle remainder
    for (size_t i = simd_count; i < count; i++) {
        uint16_t val = data[i];
        data[i] = ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
    }
}

// Fast byte order conversion for 32-bit values
EMSCRIPTEN_KEEPALIVE
void libexif_convert_endian_32_simd(uint32_t* data, size_t count) {
    size_t simd_count = count & ~3; // Process 4 uint32s at a time

    for (size_t i = 0; i < simd_count; i += 4) {
        v128_t values = wasm_v128_load(&data[i]);

        // Swap bytes: (ABCD) -> (DCBA)
        v128_t swapped = wasm_i8x16_shuffle(values, values,
            3, 2, 1, 0, 7, 6, 5, 4,      // First two uint32s
            11, 10, 9, 8, 15, 14, 13, 12  // Second two uint32s
        );

        wasm_v128_store(&data[i], swapped);
    }

    // Handle remainder
    for (size_t i = simd_count; i < count; i++) {
        uint32_t val = data[i];
        data[i] = ((val & 0xFF) << 24) | (((val >> 8) & 0xFF) << 16) |
                  (((val >> 16) & 0xFF) << 8) | ((val >> 24) & 0xFF);
    }
}

// Fast comparison for EXIF tag processing
EMSCRIPTEN_KEEPALIVE
int libexif_memcmp_simd(const void* s1, const void* s2, size_t n) {
    const uint8_t* p1 = (const uint8_t*)s1;
    const uint8_t* p2 = (const uint8_t*)s2;

    size_t i = 0;
    for (; i + 15 < n; i += 16) {
        v128_t v1 = wasm_v128_load(&p1[i]);
        v128_t v2 = wasm_v128_load(&p2[i]);
        v128_t cmp = wasm_i8x16_eq(v1, v2);
        int32_t mask = wasm_i8x16_bitmask(cmp);

        if (mask != 0xFFFF) {
            // Found difference - locate it
            for (int j = 0; j < 16; j++) {
                if (p1[i + j] != p2[i + j]) {
                    return p1[i + j] - p2[i + j];
                }
            }
        }
    }

    // Scalar remainder
    for (; i < n; i++) {
        if (p1[i] != p2[i]) {
            return p1[i] - p2[i];
        }
    }
    return 0;
}

// Fast ASCII-only validation for EXIF string tags
EMSCRIPTEN_KEEPALIVE
bool libexif_validate_ascii_simd(const uint8_t* str, size_t len) {
    v128_t ascii_max = wasm_i8x16_splat(0x7F);

    size_t i = 0;
    for (; i + 15 < len; i += 16) {
        v128_t chunk = wasm_v128_load(&str[i]);
        v128_t is_ascii = wasm_i8x16_le(chunk, ascii_max);
        int32_t mask = wasm_i8x16_bitmask(is_ascii);

        if (mask != 0xFFFF) {
            return false; // Found non-ASCII character
        }
    }

    // Check remainder
    for (; i < len; i++) {
        if (str[i] > 0x7F) {
            return false;
        }
    }
    return true;
}

// SIMD-optimized checksum calculation for EXIF data integrity
EMSCRIPTEN_KEEPALIVE
uint32_t libexif_checksum_simd(const uint8_t* data, size_t len) {
    v128_t sum_vec = wasm_i32x4_splat(0);

    // Process 64 bytes per iteration for better instruction-level parallelism
    while (len >= 64) {
        // Load 4x16 bytes
        v128_t d0 = wasm_v128_load(&data[0]);
        v128_t d1 = wasm_v128_load(&data[16]);
        v128_t d2 = wasm_v128_load(&data[32]);
        v128_t d3 = wasm_v128_load(&data[48]);

        // Widen to 32-bit and accumulate
        v128_t sum0 = wasm_i32x4_add(
            wasm_u32x4_extend_low_u16x8(wasm_u16x8_extend_low_u8x16(d0)),
            wasm_u32x4_extend_high_u16x8(wasm_u16x8_extend_low_u8x16(d0))
        );
        v128_t sum1 = wasm_i32x4_add(
            wasm_u32x4_extend_low_u16x8(wasm_u16x8_extend_high_u8x16(d0)),
            wasm_u32x4_extend_high_u16x8(wasm_u16x8_extend_high_u8x16(d0))
        );

        sum_vec = wasm_i32x4_add(sum_vec, wasm_i32x4_add(sum0, sum1));

        data += 64;
        len -= 64;
    }

    // Extract horizontal sum
    uint32_t sum = 0;
    uint32_t temp[4];
    wasm_v128_store(temp, sum_vec);
    sum = temp[0] + temp[1] + temp[2] + temp[3];

    // Scalar remainder
    while (len--) {
        sum += *data++;
    }

    return sum;
}