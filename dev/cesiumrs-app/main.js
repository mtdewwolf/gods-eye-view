/**
 * Entry point running the full gods-eye-view application on the Phase 1
 * CesiumRS WebGL2/WASM renderer (`src/render/cesiumrs/application.js`),
 * without loading any CesiumJS module or asset.
 */
import { createStandaloneApplication } from '../../src/standalone/application.js';
import { createCesiumRsRendererPlugin } from '../../src/render/cesiumrs/application.js';

const renderers = [];
const basePlugin = createCesiumRsRendererPlugin();
const plugin = Object.freeze({
  id: basePlugin.id,
  async create(options) {
    let ref = null;
    ref = await basePlugin.create({
      ...options,
      onDestroy: () => {
        const i = renderers.indexOf(ref);
        if (i >= 0) renderers.splice(i, 1);
      },
    });
    renderers.push(ref);
    return ref;
  },
});

const application = createStandaloneApplication({
  renderer: plugin,
  allowQaRegistration: true,
});

window.__cesiumRsBoot = {
  application,
  renderers,
  started: application.start().then(
    () => ({ ok: true }),
    (error) => {
      console.error('CesiumRS application failed to start:', error);
      return { ok: false, error: String(error?.stack || error) };
    },
  ),
};
