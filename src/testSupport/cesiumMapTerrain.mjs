/**
 * @module testSupport/cesiumMapTerrain
 * @description The map stacks' keyless terrain resource over the
 * Cesium-shaped test namespace, ported from the default renderer's adapter
 * for tests of the tile retry policy.
 */
import * as Cesium from './cesiumrsCompat.mjs';
import { createTerrainRetryPolicy } from '../maps/terrainRetry.js';
import { KEYLESS_TERRAIN_URL } from '../maps/keylessTerrain.js';

export { KEYLESS_TERRAIN_URL };

function logThrottle({ statusCode, delayMs, inWindow }) {
  if (inWindow !== 1) return;
  console.warn(
    `[MapStack] Re:Earth terrain answered ${statusCode}; retrying throttled tiles after ${Math.round(delayMs)} ms`,
  );
}

/** The Re:Earth resource with the tile retry policy attached. */
export function createKeylessTerrainResource(
  policy = createTerrainRetryPolicy({ onThrottle: logThrottle }),
) {
  return new Cesium.Resource({
    url: KEYLESS_TERRAIN_URL,
    retryCallback: policy.retryCallback,
    retryAttempts: policy.retryAttempts,
  });
}
