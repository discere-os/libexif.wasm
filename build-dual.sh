#!/bin/bash
# build-dual.sh - Dual build system for libexif.wasm
#
# Copyright (c) 2001-2022 Lutz Mueller <lutz@users.sourceforge.net>
# Copyright (c) 2025 Superstruct Ltd, New Zealand
# Licensed under LGPL-2.1-or-later

set -euo pipefail

VARIANT="${1:-all}"
BUILD_DIR="${BUILD_DIR:-./build-dual}"
INSTALL_PREFIX="${INSTALL_PREFIX:-./install}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies and configure if needed
check_prerequisites() {
    log_info "Checking build prerequisites..."

    if ! command -v emcc &> /dev/null; then
        log_error "Emscripten not found. Please install and activate EMSDK."
        exit 1
    fi

    # Check if autotools files exist
    if [ ! -f "config.h" ] && [ -f "configure.ac" ]; then
        log_info "Configuring libexif for WASM build..."

        # Generate configure script if it doesn't exist
        if [ ! -f "configure" ]; then
            if command -v autoreconf &> /dev/null; then
                log_info "Running autoreconf to generate configure script..."
                autoreconf -fiv
            else
                log_warning "autoreconf not available, trying existing configure..."
            fi
        fi

        # Run configure with minimal settings for WASM
        if [ -f "configure" ]; then
            log_info "Running configure for WASM build..."
            emconfigure ./configure \
                --disable-shared \
                --enable-static \
                --disable-docs \
                --disable-nls \
                --without-libintl-prefix \
                --host=wasm32 \
                --prefix=/tmp/libexif-install
        else
            # Create minimal config.h for WASM build
            log_warning "Creating minimal config.h for WASM build..."
            cat > config.h << 'EOF'
#ifndef CONFIG_H
#define CONFIG_H

#define PACKAGE_NAME "libexif"
#define PACKAGE_VERSION "0.6.25"
#define VERSION "0.6.25"
#define GETTEXT_PACKAGE "libexif"

/* Define if you have localtime_r */
#define HAVE_LOCALTIME_R 1

/* Math functions */
#define HAVE_LIBM 1

/* Standard headers */
#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_MEMORY_H 1
#define STDC_HEADERS 1

/* For WASM build */
#define _GNU_SOURCE 1

#endif /* CONFIG_H */
EOF
        fi
    fi

    # libexif has no external dependencies - only needs standard math functions
    log_success "Prerequisites check completed"
}

# Get all source files for libexif
get_source_files() {
    local sources=""

    # Main library sources (use find to get actual files)
    if [ -d "../libexif" ]; then
        # Find all .c files in libexif directory and subdirectories
        while IFS= read -r -d '' file; do
            sources+=" $file"
        done < <(find ../libexif -name "*.c" -print0)
    else
        log_error "libexif source directory not found"
        exit 1
    fi

    echo "$sources"
}

# Build SIDE_MODULE (production)
build_side_module() {
    log_info "Building libexif-side.wasm for production..."
    mkdir -p "${BUILD_DIR}-side"
    cd "${BUILD_DIR}-side"

    local sources=$(get_source_files)
    local simd_sources=""

    # Add SIMD sources if they exist
    if [ -f "../wasm/libexif_simd.c" ]; then
        simd_sources="../wasm/libexif_simd.c"
    fi

    emcc ${sources} ${simd_sources} \
        -I.. \
        -I../libexif \
        -I../libexif/canon \
        -I../libexif/fuji \
        -I../libexif/olympus \
        -I../libexif/pentax \
        -O3 -flto -msimd128 \
        -sSIDE_MODULE=2 \
        -sSTANDALONE_WASM=1 \
        -sEXPORTED_FUNCTIONS='["_malloc","_free","_exif_data_new","_exif_data_new_from_data","_exif_data_ref","_exif_data_unref","_exif_data_free","_exif_data_load_data","_exif_data_save_data","_exif_data_get_byte_order","_exif_data_set_byte_order","_exif_content_get_entry","_exif_entry_get_value","_exif_loader_new","_exif_loader_ref","_exif_loader_unref","_exif_loader_write_file","_exif_loader_write","_exif_loader_reset","_exif_loader_get_data","_exif_tag_get_name","_exif_tag_get_title","_exif_tag_get_description"]' \
        -DLIBEXIF_SIDE_MODULE=1 \
        -DGETTEXT_PACKAGE=\"libexif\" \
        -o libexif-side.wasm

    # Install artifacts
    mkdir -p "../${INSTALL_PREFIX}/wasm"
    cp libexif-side.wasm "../${INSTALL_PREFIX}/wasm/"

    log_success "SIDE_MODULE: ../${INSTALL_PREFIX}/wasm/libexif-side.wasm ($(stat -c%s "../${INSTALL_PREFIX}/wasm/libexif-side.wasm" | numfmt --to=iec))"
    cd ..
}

# Build MAIN_MODULE (testing/NPM)
build_main_module() {
    log_info "Building libexif-main.js for testing..."
    mkdir -p "${BUILD_DIR}-main"
    cd "${BUILD_DIR}-main"

    local sources=$(get_source_files)
    local simd_sources=""

    # Add SIMD sources if they exist
    if [ -f "../wasm/libexif_simd.c" ]; then
        simd_sources="../wasm/libexif_simd.c"
    fi

    emcc ${sources} ${simd_sources} \
        -I.. \
        -I../libexif \
        -I../libexif/canon \
        -I../libexif/fuji \
        -I../libexif/olympus \
        -I../libexif/pentax \
        -O3 -flto -msimd128 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="LibexifModule" \
        -sEXPORTED_FUNCTIONS='["_malloc","_free","_exif_data_new","_exif_data_new_from_data","_exif_data_ref","_exif_data_unref","_exif_data_free","_exif_data_load_data","_exif_data_save_data","_exif_data_get_byte_order","_exif_data_set_byte_order","_exif_content_get_entry","_exif_entry_get_value","_exif_loader_new","_exif_loader_ref","_exif_loader_unref","_exif_loader_write_file","_exif_loader_write","_exif_loader_reset","_exif_loader_get_data","_exif_tag_get_name","_exif_tag_get_title","_exif_tag_get_description"]' \
        -sEXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","stringToUTF8","HEAPU8","HEAP32","getValue","setValue"]' \
        -sALLOW_MEMORY_GROWTH=1 \
        -sINITIAL_MEMORY=33554432 \
        -sMAXIMUM_MEMORY=134217728 \
        -sNO_FILESYSTEM=1 \
        -sENVIRONMENT=web,webview,worker \
        -sNODEJS_CATCH_EXIT=0 \
        -sNODEJS_CATCH_REJECTION=0 \
        -DGETTEXT_PACKAGE=\"libexif\" \
        -o libexif-main.js

    # Install artifacts
    mkdir -p "../${INSTALL_PREFIX}/wasm"
    cp libexif-main.js "../${INSTALL_PREFIX}/wasm/"
    cp libexif-main.wasm "../${INSTALL_PREFIX}/wasm/"

    log_success "MAIN_MODULE: ../${INSTALL_PREFIX}/wasm/libexif-main.js ($(stat -c%s "../${INSTALL_PREFIX}/wasm/libexif-main.js" | numfmt --to=iec))"
    log_success "MAIN_MODULE: ../${INSTALL_PREFIX}/wasm/libexif-main.wasm ($(stat -c%s "../${INSTALL_PREFIX}/wasm/libexif-main.wasm" | numfmt --to=iec))"
    cd ..
}

case "$VARIANT" in
    side) check_prerequisites && build_side_module ;;
    main) check_prerequisites && build_main_module ;;
    all) check_prerequisites && build_side_module && build_main_module ;;
    clean)
        log_info "Cleaning build directories..."
        rm -rf "${BUILD_DIR}"* "${INSTALL_PREFIX}"
        log_success "Clean completed"
        ;;
    *)
        echo "Usage: $0 [side|main|all|clean]"
        echo "  side  - Build SIDE_MODULE for production"
        echo "  main  - Build MAIN_MODULE for testing"
        echo "  all   - Build both variants (default)"
        echo "  clean - Remove build artifacts"
        exit 1
        ;;
esac