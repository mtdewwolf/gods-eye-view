/**
 * @module testSupport/cesiumScreenModulation
 * @description The screen-mod modulation pass is not part of the test
 * namespace: a renderer without the capability never asks for it.
 */

export const SCREEN_MODULATION_CESIUM_VERSION = '1.138.0';

export const screenModulationSupported = () => false;

export function createCesiumScreenModulation() {
  throw new Error('screen modulation is not available in tests');
}
