/**
 * @module testSupport/cesiumInternals
 * @description The renderer internals the Cesium-shaped test ports read,
 * in one place, as the default renderer's adapter had them.
 */

export const webglContext = (scene) => scene?.context?._gl;

export const usesGlobeDepthFramebuffer = (scene) =>
  scene?._environmentState?.useGlobeDepthFramebuffer;

export const rawFramebuffer = (framebuffer) => framebuffer?._framebuffer;

export const rawTexture = (texture) => texture?._texture;

/** The entity Cesium's EntityView tracks, when it has started framing it. */
export const trackedEntityViewEntity = (widget) =>
  (widget?._cesiumWidget ?? widget)?._entityView?.entity ?? null;

/** Whether a Cesium camera has a flight under way. */
export const cameraFlightActive = (camera) => camera?._currentFlight != null;
