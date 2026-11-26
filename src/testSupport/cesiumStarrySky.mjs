/**
 * @module testSupport/cesiumStarrySky
 * @description The sky box surface the effects tests read: the Milky Way
 * intensity, kept as the uniform the anime style dims.
 */
import { MILKY_WAY_INTENSITY } from '../sky/assets.js';

export { MILKY_WAY_INTENSITY };

export class StarrySky {
  constructor() {
    this._intensity = MILKY_WAY_INTENSITY;
    this._milkyWayUniforms = { u_intensity: () => this._intensity };
    this.show = true;
  }

  get milkyWayVisibility() {
    return this._intensity / MILKY_WAY_INTENSITY;
  }

  set milkyWayVisibility(value) {
    this._intensity = MILKY_WAY_INTENSITY * value;
  }

  destroy() {}
}
