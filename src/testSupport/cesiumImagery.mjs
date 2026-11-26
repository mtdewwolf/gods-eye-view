/**
 * @module testSupport/cesiumImagery
 * @description The imagery helpers tests read from the default renderer's
 * adapter. Only the engine-free `layerOptions` is needed.
 */

/** A contract imagery spec as the provider's layer options. */
export function layerOptions(spec) {
  if (!spec.hiddenBelowMinLevel || !(spec.minLevel > 0)) return undefined;
  const tiling =
    spec.tiling ?? (spec.kind === 'canvas' ? 'geographic' : 'webMercator');
  const shift = tiling === 'geographic' ? 0 : 1;
  return { minimumTerrainLevel: Math.max(0, spec.minLevel - shift) };
}
