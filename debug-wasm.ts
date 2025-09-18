#!/usr/bin/env -S deno run --allow-read

// Debug WASM loading
async function debugWasm() {
  console.log("Loading WASM module factory...")

  try {
    const moduleFactory = (await import('./install/wasm/libexif-main.js')).default
    console.log("Module factory loaded:", typeof moduleFactory)

    console.log("Loading WASM binary...")
    const wasmPath = new URL('./install/wasm/libexif-main.wasm', import.meta.url).pathname
    const wasmBinary = await Deno.readFile(wasmPath)
    console.log("WASM binary loaded:", wasmBinary.length, "bytes")

    console.log("Creating module instance...")
    const module = await moduleFactory({
      wasmBinary: wasmBinary.buffer,
      locateFile: (path: string) => {
        console.log("locateFile called with:", path)
        if (path.endsWith('.wasm')) {
          return new URL('./install/wasm/' + path, import.meta.url).href
        }
        return path
      }
    })

    console.log("Module instance:", module)
    console.log("Module has cwrap:", !!module.cwrap)
    console.log("Module keys:", Object.keys(module))

    // Check for memory allocation functions
    console.log("Memory functions available:")
    console.log("  module._malloc:", typeof module._malloc)
    console.log("  module._free:", typeof module._free)
    console.log("  module.malloc:", typeof module.malloc)
    console.log("  module.free:", typeof module.free)
    console.log("  module.stackAlloc:", typeof module.stackAlloc)
    console.log("  module.stackSave:", typeof module.stackSave)
    console.log("  module.stackRestore:", typeof module.stackRestore)

    if (module.cwrap) {
      console.log("✅ cwrap is available")
      // Try to wrap a basic function
      try {
        const exif_tag_get_name = module.cwrap('exif_tag_get_name', 'string', ['number'])
        console.log("✅ Function wrapped successfully")

        // Try to call it
        const result = exif_tag_get_name(0x010f) // MAKE tag
        console.log("Function call result:", result)
      } catch (error) {
        console.log("❌ Function wrap/call failed:", error)
      }
    }

  } catch (error) {
    console.log("❌ Error:", error)
  }
}

if (import.meta.main) {
  await debugWasm()
}