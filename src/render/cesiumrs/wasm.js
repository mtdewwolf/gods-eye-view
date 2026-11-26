/**
 * @module render/cesiumrs/wasm
 * @description Lazy singleton loader for the `cesium-rs-browser` WebAssembly
 * module (`BrowserScene`). Initialises the WASM binary once per page and
 * reuses it across renderers.
 */

let modulePromise = null;

/**
 * Load and initialise the `cesium-rs-browser` WASM module.
 * @returns {Promise<{ BrowserScene: any }>}
 */
export function loadCesiumRsWasm() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const mod = await import('cesium-rs-browser');
      if (typeof mod.default === 'function') {
        await mod.default();
      }
      return mod;
    })().catch((error) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}
