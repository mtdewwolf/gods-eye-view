/**
 * @module testSupport/cesiumHeights
 * @description The height service over a Cesium-shaped scene double, ported
 * from the default renderer's adapter for tests of the query port. No
 * engine: the double's own `sampleHeight`, `clampToHeight` and
 * `globe.getHeight` answer.
 */
import * as Cesium from './cesiumrsCompat.mjs';

const services = new WeakMap();
const scratch = new Cesium.Cartographic();
const NO_OPTIONS = Object.freeze({});

const SUPPORT = [
  [
    Object.freeze({ surface: false, clamp: false }),
    Object.freeze({ surface: false, clamp: true }),
  ],
  [
    Object.freeze({ surface: true, clamp: false }),
    Object.freeze({ surface: true, clamp: true }),
  ],
];

const metres = (height) => (Number.isFinite(height) ? height : null);

function cartographicOf(point, result = scratch) {
  if (Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude))
    return point;
  const lon = Number(point?.lon);
  const lat = Number(point?.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return Cesium.Cartographic.fromDegrees(lon, lat, 0, result);
}

/**
 * The scene's height service, made on first use.
 * @param {object} scene A Cesium-shaped scene (or a test double).
 */
export function heightsFor(scene) {
  let service = services.get(scene);
  if (!service) {
    service = createHeights(scene);
    services.set(scene, service);
  }
  return service;
}

function createHeights(scene) {
  return {
    now(point, { against = 'surface', exclude } = NO_OPTIONS) {
      const carto = cartographicOf(point);
      if (!carto) return null;
      try {
        if (against === 'terrain')
          return metres(scene.globe?.getHeight?.(carto));
        return metres(scene.sampleHeight?.(carto, exclude));
      } catch {
        return null;
      }
    },

    clampNow(position, { exclude } = NO_OPTIONS) {
      if (!position) return null;
      try {
        return scene.clampToHeight?.(position, exclude) ?? null;
      } catch {
        return null;
      }
    },

    async batch(points, { against = 'surface', exclude } = NO_OPTIONS) {
      const cartos = points.map((point) => {
        const carto = cartographicOf(point, new Cesium.Cartographic());
        return (
          carto && new Cesium.Cartographic(carto.longitude, carto.latitude, 0)
        );
      });
      try {
        if (against === 'terrain') {
          return cartos.map((carto) =>
            carto ? metres(scene.globe?.getHeight?.(carto)) : null,
          );
        }
        if (typeof scene.sampleHeightMostDetailed === 'function') {
          const result = await scene.sampleHeightMostDetailed(cartos, exclude);
          return result.map((carto) => metres(carto?.height));
        }
        return cartos.map((carto) =>
          carto ? metres(scene.sampleHeight?.(carto, exclude)) : null,
        );
      } catch (error) {
        throw error;
      }
    },

    async clampBatch(positions, { exclude } = NO_OPTIONS) {
      if (typeof scene.clampToHeightMostDetailed === 'function')
        return scene.clampToHeightMostDetailed(positions, exclude);
      return positions.map(
        (position) => this.clampNow(position, { exclude }) ?? null,
      );
    },

    supported() {
      const surface = Boolean(scene.sampleHeightSupported);
      return SUPPORT[surface ? 1 : 0][scene.clampToHeightSupported ? 1 : 0];
    },
  };
}
