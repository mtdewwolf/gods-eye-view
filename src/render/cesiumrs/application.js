/**
 * @module render/cesiumrs/application
 * @description The CesiumRS renderer plugin (`RendererPlugin`) for
 * `gods-eye-view`.
 */
import { createCesiumRsRenderer } from './renderer.js';

/**
 * Create a CesiumRS `RendererPlugin`.
 * @param {object} [defaults]
 */
export function createCesiumRsRendererPlugin(defaults = {}) {
  return Object.freeze({
    id: 'cesiumrs',
    async create(options) {
      return createCesiumRsRenderer({ ...defaults, ...options });
    },
  });
}

/** Default CesiumRS renderer plugin. */
export const cesiumRsRenderer = createCesiumRsRendererPlugin();
