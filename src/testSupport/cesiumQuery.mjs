/**
 * @module testSupport/cesiumQuery
 * @description The query port over a Cesium-shaped scene double, ported
 * from the default renderer's adapter for tests of code that picks,
 * projects or samples heights through the scene. No engine: the double's
 * own `pick`, `drillPick`, `pickPosition`, `sampleHeight` and
 * `scene.pickFromRay` answer, and the maths comes from `cesiumrsCompat`.
 */
import * as Cesium from './cesiumrsCompat.mjs';
import { heightsFor } from './cesiumHeights.mjs';
import { findDraw, provideUnboundQuery } from '../render/rendererOf.js';
import { pickEllipsoidAt, pickRayAt, toCartesian } from './cesiumCommon.mjs';
import { drawHitOf } from './drawHit.mjs';
import { rememberPick } from './pickMemo.mjs';
import { createSceneOcclusionTest } from './cesiumSceneOcclusionProbe.mjs';

const DRILL_DEPTH = 16;

export function queryCapabilities(scene) {
  const found = [];
  if (scene.pickPositionSupported) found.push('pickPosition', 'occlusionTest');
  if (scene.sampleHeightSupported)
    found.push('sampleHeight', 'finestHeights', 'rayCast');
  return found;
}

const NO_DRAW = Object.freeze({ sets: new Map(), version: () => 0 });

/**
 * @param {{scene: object, camera?: object, draw?: {sets: Map<string, object>,
 *   version: () => number}, capabilities: ReadonlySet<string>}} options
 */
export function createCesiumQuery({
  scene,
  camera = scene.camera,
  draw: drawPart = NO_DRAW,
  capabilities,
}) {
  const screen = (x, y) => new Cesium.Cartesian2(x, y);
  const ecef = (c) => (c ? { x: c.x, y: c.y, z: c.z } : null);
  const finite = (p) =>
    Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z);
  const cesiumRay = (ray) =>
    new Cesium.Ray(toCartesian(ray.origin), toCartesian(ray.direction));

  function ownerOf(picked) {
    const id = picked?.id;
    if (!id || typeof id.set !== 'string') return null;
    const record = drawPart.sets?.get(id.set);
    const item = record?.items?.get?.(id.id);
    return record && item ? { record, item, id } : null;
  }

  const pickable = ({ record, item }) =>
    record.host?.show !== false &&
    record.spec?.pickable !== false &&
    item.show !== false &&
    item.pickable !== false;

  const hitOf = ({ id }) => drawHitOf({ id });

  function hitsOf(owner) {
    const cluster = owner.id.cluster;
    if (!cluster) return pickable(owner) ? [hitOf(owner)] : [];
    const { record } = owner;
    const hits = [];
    for (const id of cluster.ids) {
      const item = record.items.get(id);
      if (!item || !pickable({ record, item })) continue;
      hits.push({
        set: record.spec.id,
        id,
        ...(item.meta === undefined ? {} : { meta: item.meta }),
        surface: false,
        position: { ...cluster.position },
      });
    }
    return hits;
  }

  const quietly = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  function surfaceHit(x, y, picked) {
    const ellipsoid = quietly(() => query.pickEllipsoid(x, y));
    if (!ellipsoid) {
      if (
        picked == null &&
        !quietly(() => query.pickGlobe(query.pickRay(x, y)))
      )
        return null;
      const position = quietly(() => query.pickPosition(x, y));
      return position ? { set: '', id: '', surface: true, position } : null;
    }
    let position;
    const hit = { set: '', id: '', surface: true };
    Object.defineProperty(hit, 'position', {
      enumerable: true,
      configurable: true,
      get() {
        position ??= quietly(() => query.pickPosition(x, y)) ?? ellipsoid;
        return position;
      },
    });
    return hit;
  }

  function drill(
    x,
    y,
    { width = 3, height = 3, limit, untilForeign, unbounded = false } = {},
  ) {
    const hits = [];
    if (limit === 0) return hits;
    if (typeof scene.drillPick !== 'function') return hits;
    const seen = new Set();
    for (const picked of scene.drillPick(
      screen(x, y),
      limit === undefined || unbounded
        ? undefined
        : Math.max(limit, DRILL_DEPTH),
      width,
      height,
    ) ?? []) {
      const owner = ownerOf(picked);
      if (!owner) {
        if (untilForeign) break;
        continue;
      }
      let full = false;
      for (const hit of hitsOf(owner)) {
        const key = `${hit.set}\u0000${hit.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(hit);
        if (limit !== undefined && hits.length >= limit) {
          full = true;
          break;
        }
      }
      if (full) break;
    }
    return hits;
  }

  const seeThrough = (exclude, { allSets = false } = {}) => {
    const out = [];
    for (const record of drawPart.sets?.values?.() ?? [])
      if (
        allSets ||
        !record.spec?.includeInHeightQueries ||
        exclude?.includes(record.spec?.id)
      )
        for (const id of record.pickIds ?? []) out.push(id);
    return out;
  };

  const heights = () => heightsFor(scene);
  const can = (capability) => capabilities.has(capability);
  const globeShown = () => Boolean(scene.globe?.show);

  function withoutGlobe(fn) {
    if (!globeShown()) return fn();
    scene.globe.show = false;
    try {
      return fn();
    } finally {
      scene.globe.show = true;
    }
  }

  const query = {
    pick(x, y, window = {}) {
      const width = window.width ?? 3;
      const height = window.height ?? 3;
      if (typeof scene.pick !== 'function') return null;
      const picked = scene.pick(screen(x, y), width, height);
      rememberPick(scene, x, y, width, height, picked);
      const owner = ownerOf(picked);
      const [hit] = owner ? hitsOf(owner) : [];
      if (hit) return hit;
      if (owner) {
        const [under] = drill(x, y, {
          ...window,
          limit: 1,
          untilForeign: true,
          unbounded: true,
        });
        if (under) return under;
      }
      return surfaceHit(x, y, picked);
    },
    drillPick: (x, y, options = {}) =>
      drill(x, y, { ...options, untilForeign: false }),
    pickPosition(x, y) {
      if (!can('pickPosition') || !scene.pickPositionSupported) return null;
      return ecef(scene.pickPosition(screen(x, y)));
    },
    pickEllipsoid(x, y) {
      return ecef(pickEllipsoidAt(scene, camera, x, y));
    },
    pickGlobe(ray) {
      return ecef(scene.globe?.pick?.(cesiumRay(ray), scene));
    },
    pickRay(x, y) {
      const ray = pickRayAt(scene, camera, x, y);
      if (!ray) return null;
      return { origin: ecef(ray.origin), direction: ecef(ray.direction) };
    },
    project(position) {
      const s = Cesium.SceneTransforms.worldToWindowCoordinates(
        scene,
        position,
      );
      return s ? { x: s.x, y: s.y } : null;
    },
    projectMany(source, out) {
      for (let i = 0, j = 0; i + 2 < source.length; i += 3, j += 2) {
        const s = this.project({
          x: source[i],
          y: source[i + 1],
          z: source[i + 2],
        });
        out[j] = s ? s.x : Number.NaN;
        out[j + 1] = s ? s.y : Number.NaN;
      }
    },
    isOccluded(position) {
      const ellipsoid = scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84;
      const eye = camera?.positionWC;
      if (!eye) return false;
      return !new Cesium.EllipsoidalOccluder(ellipsoid, eye).isPointVisible(
        position,
      );
    },
    sampleHeightNow(point, { against = 'surface', exclude } = {}) {
      if (against === 'terrain')
        return heights().now(point, { against: 'terrain' });
      if (!can('sampleHeight')) return null;
      const sample = () =>
        heights().now(point, { exclude: seeThrough(exclude) });
      return against === 'tiles' ? withoutGlobe(sample) : sample();
    },
    async sampleHeight(points, { against = 'surface', exclude } = {}) {
      if (!can('sampleHeight')) return points.map(() => null);
      const excluded = seeThrough(exclude);
      const found = await heights().batch(
        points,
        against === 'terrain' ? { against: 'terrain' } : { exclude: excluded },
      );
      const lod = can('finestHeights') ? 'finest' : 'visible';
      return found.map((height) =>
        height === null
          ? null
          : { height, confidence: 1, source: 'tiles', lod },
      );
    },
    async clampToSurface(positions, options = {}) {
      const points = positions.map((p) => {
        const c =
          finite(p) && Cesium.Cartographic.fromCartesian(toCartesian(p));
        return c
          ? {
              lon: Cesium.Math.toDegrees(c.longitude),
              lat: Cesium.Math.toDegrees(c.latitude),
            }
          : null;
      });
      const samples = await query.sampleHeight(
        points.map((p) => p ?? { lon: NaN, lat: NaN }),
        options,
      );
      return samples.map((sample, i) =>
        sample && points[i]
          ? ecef(
              Cesium.Cartesian3.fromDegrees(
                points[i].lon,
                points[i].lat,
                sample.height,
              ),
            )
          : null,
      );
    },
    async rayCast(
      ray,
      { against = 'surface', exclude, maxDistance = Infinity } = {},
    ) {
      if (!can('rayCast')) return null;
      const r = cesiumRay(ray);
      let position;
      if (against === 'terrain') position = scene.globe?.pick?.(r, scene);
      else {
        const cast = () =>
          scene.pickFromRay?.(r, seeThrough(exclude))?.position;
        position = against === 'tiles' ? withoutGlobe(cast) : cast();
      }
      if (!position) return null;
      return Cesium.Cartesian3.distance(r.origin, position) <= maxDistance
        ? ecef(position)
        : null;
    },
  };
  if (can('occlusionTest'))
    query.occlusionTest = () => createSceneOcclusionTest(scene);
  return query;
}

const NO_SETS = new Map();

// A Cesium-shaped viewer with no renderer bound gets a query port over its
// scene when code first asks `findQuery` for one.
provideUnboundQuery((viewer) => {
  const scene = viewer.scene;
  if (
    typeof scene?.pick !== 'function' ||
    typeof scene.drillPick !== 'function' ||
    typeof scene.camera?.pickEllipsoid !== 'function'
  )
    return null;
  const port = createCesiumQuery({
    scene,
    draw: {
      get sets() {
        return findDraw(viewer)?.sets ?? NO_SETS;
      },
      version: () => 0,
    },
    capabilities: new Set(queryCapabilities(scene)),
  });
  return { port, dispose() {} };
});
