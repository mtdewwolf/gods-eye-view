/**
 * @module testSupport/cesiumGlobe
 * @description A globe port over a Cesium-shaped scene double, for tests
 * that read whether the globe is shown and drive the sky settings. The
 * imagery and terrain side of the default renderer's adapter is not
 * reproduced here.
 */
import { provideUnboundGlobe } from '../render/rendererOf.js';

/**
 * The sky settings the globe port keeps, written through to the scene.
 * @param {object} scene
 */
function skyPort(scene) {
  const read = () => ({
    atmosphere:
      scene.skyAtmosphere?.show ?? scene.globe?.showGroundAtmosphere ?? false,
    stars: scene.skyBox?.show ?? false,
    milkyWay: scene.skyBox?.milkyWayVisibility ?? 0,
    sun: scene.sun?.show ?? true,
  });
  return {
    get() {
      return read();
    },
    set(settings = {}) {
      const current = read();
      const next = { ...current, ...settings };
      if ('atmosphere' in settings) {
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = next.atmosphere;
        if (scene.globe) scene.globe.showGroundAtmosphere = next.atmosphere;
      }
      if ('stars' in settings && scene.skyBox && 'show' in scene.skyBox)
        scene.skyBox.show = next.stars;
      if (
        'milkyWay' in settings &&
        scene.skyBox?.milkyWayVisibility !== undefined
      )
        scene.skyBox.milkyWayVisibility = next.milkyWay;
      if ('sun' in settings && scene.sun) scene.sun.show = next.sun;
      return read();
    },
  };
}

/**
 * @param {object} viewer
 * @param {{capabilities?: ReadonlySet<string>, requestRender?: Function}} [options]
 */
export function createCesiumGlobe(viewer, { requestRender = () => {} } = {}) {
  const scene = viewer.scene;
  const port = {
    sky: skyPort(scene),
    isGlobeVisible: () => (scene?.globe ? scene.globe.show === true : null),
    setGlobeVisible(visible) {
      if (scene?.globe) scene.globe.show = Boolean(visible);
      requestRender('globe');
    },
    isSettled() {
      const primitives = scene?.primitives;
      if (!primitives) return true;
      for (let i = 0; i < (primitives.length ?? 0); i += 1) {
        const tileset = primitives.get?.(i);
        if (
          tileset &&
          tileset.show !== false &&
          typeof tileset.tilesLoaded === 'boolean' &&
          !tileset.tilesLoaded
        )
          return false;
      }
      return true;
    },
    on: () => () => {},
    imagery: {
      add() {
        throw new Error('imagery is not available on the test globe port');
      },
      list: () => [],
      getSplit: () => 0,
      setSplit() {},
    },
  };
  return { port };
}

// A Cesium-shaped viewer with no renderer bound gets a globe port when code
// first asks `findGlobe` for one.
provideUnboundGlobe((viewer) => {
  const scene = viewer?.scene;
  if (!scene || typeof scene !== 'object') return null;
  return { port: createCesiumGlobe(viewer).port, dispose() {}, release() {} };
});
