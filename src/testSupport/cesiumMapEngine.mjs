/**
 * @module testSupport/cesiumMapEngine
 * @description The map engine over a Cesium-shaped viewer double, for tests
 * of the map source controller and the layers that switch stacks. The
 * scene operations are the viewer's own; the imagery and terrain factories
 * are the tests' (`createDefaultMapSources` overrides them), so they are
 * not provided here.
 */
import { provideMapEngine } from '../maps/engine.js';

/** The viewer behind `host`: itself (a double), or its renderer's. */
const viewerOf = (host) => host;

export const cesiumMapEngine = Object.freeze({
  imagery: Object.freeze({}),
  terrain: Object.freeze({}),
  createImageryLayer: (provider) => ({ provider }),
  requestRender(host) {
    viewerOf(host)?.scene?.requestRender?.();
  },
  globeShown: (host) => viewerOf(host)?.scene?.globe?.show === true,
  setGlobeShown(host, shown) {
    viewerOf(host).scene.globe.show = shown;
  },
  addTileset(host, tileset) {
    viewerOf(host).scene.primitives.add(tileset);
  },
  removeTileset(host, tileset) {
    viewerOf(host).scene.primitives.remove(tileset);
  },
  tilesetShown: (tileset) => tileset?.show === true,
  showTileset(tileset, shown) {
    tileset.show = shown;
  },
  addImageryLayer(host, layer, index) {
    viewerOf(host).imageryLayers.add(layer, index);
  },
  removeImageryLayer(host, layer) {
    viewerOf(host).imageryLayers.remove(layer, true);
  },
  applyTerrain(host, result) {
    const viewer = viewerOf(host);
    if (result.terrain) viewer.scene.setTerrain(result.terrain);
    else viewer.terrainProvider = result.provider;
  },
  onTileError(provider, listener) {
    const errorEvent = provider?.errorEvent;
    if (!errorEvent?.addEventListener) return null;
    return errorEvent.addEventListener((error) =>
      listener({ timesRetried: error?.timesRetried }),
    );
  },
  isDestroyed: (value) => value?.isDestroyed?.() === true,
  release(value) {
    if (typeof value?.destroy === 'function' && !value.isDestroyed?.())
      value.destroy();
  },
  async loadPhotoreal() {
    return { tileset: null, route: 'osm', errors: [] };
  },
});

provideMapEngine(cesiumMapEngine);
