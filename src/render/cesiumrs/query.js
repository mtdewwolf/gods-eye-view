/**
 * @module render/cesiumrs/query
 * @description Phase 2 query port (`src/render/contract/query.d.ts`) for the
 * CesiumRS renderer: GPU picks, depth `pickPosition`, `pickGlobe`,
 * `sampleHeightNow`, `sampleHeight` (with `finestHeights`), `clampToSurface`,
 * `rayCast`, projection, and horizon occlusion.
 */
import { horizonFrom } from '../../geo/horizon.js';
import {
  add,
  normalize,
  rayEllipsoid,
  scale,
  toCartographicRadians,
  toEcef,
} from '../stub/math.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SOURCE_NAMES = ['ellipsoid', 'terrain', 'tiles', 'set'];

function positionToEcefSafe(pos) {
  if (!pos) return { x: 0, y: 0, z: 0 };
  return toEcef(pos);
}

/**
 * Create the CesiumRS query port over `BrowserScene` (`engine`).
 */
export function createCesiumRsQuery(
  engine,
  {
    capabilities,
    camera,
    viewport,
    sets,
    syncCameraToWasm,
    withUnmodulatedPick = (fn) => fn(),
    isDestroyed,
    report,
  },
) {
  const can = (cap) => capabilities.has(cap);
  /** Optional conformance hook (`harness.scriptHeights`). */
  let scriptedHeights = null;

  function projectPoint(pos) {
    const p = positionToEcefSafe(pos);
    const { view, projection } = camera.port.matrices();
    const vx = view[0] * p.x + view[4] * p.y + view[8] * p.z + view[12];
    const vy = view[1] * p.x + view[5] * p.y + view[9] * p.z + view[13];
    const vz = view[2] * p.x + view[6] * p.y + view[10] * p.z + view[14];
    const vw = view[3] * p.x + view[7] * p.y + view[11] * p.z + view[15];
    const cx =
      projection[0] * vx +
      projection[4] * vy +
      projection[8] * vz +
      projection[12] * vw;
    const cy =
      projection[1] * vx +
      projection[5] * vy +
      projection[9] * vz +
      projection[13] * vw;
    const cw =
      projection[3] * vx +
      projection[7] * vy +
      projection[11] * vz +
      projection[15] * vw;
    if (!(cw > 0)) return null;
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    return {
      x: (ndcX * 0.5 + 0.5) * viewport.width,
      y: (0.5 - ndcY * 0.5) * viewport.height,
    };
  }

  function decodePickEntries(encoded) {
    if (!encoded) return [];
    const sep = encoded.indexOf('\0');
    if (sep < 0) return [];
    const rawSetId = encoded.slice(0, sep);
    const setId = rawSetId.endsWith('::outlines')
      ? rawSetId.slice(0, -'::outlines'.length)
      : rawSetId;
    const itemId = encoded.slice(sep + 1);
    const record = sets.get(setId);
    if (!record || !record.show || !record.pickable) return [];
    if (record.clusterHits?.has(itemId)) {
      const cluster = record.clusterHits.get(itemId);
      const out = [];
      for (const memberId of cluster.ids) {
        const item = record.items.get(memberId);
        if (!item || item.show === false || item.pickable === false) continue;
        const hit = {
          set: setId,
          id: memberId,
          surface: false,
          position: { ...cluster.position },
        };
        if (item.meta !== undefined) hit.meta = item.meta;
        out.push(hit);
      }
      return out;
    }
    const item = record.items.get(itemId);
    if (!item || item.show === false || item.pickable === false) return [];
    const hit = { set: setId, id: itemId, surface: false };
    if (item.meta !== undefined) hit.meta = item.meta;
    const livePos = record.currentPos?.get(itemId);
    if (livePos) hit.position = { ...livePos };
    else if (item.pos) hit.position = positionToEcefSafe(item.pos);
    return [hit];
  }

  function pickRayAt(x, y) {
    if (viewport.width <= 0 || viewport.height <= 0) return null;
    const p = camera.port.pose();
    const tanY = Math.tan(p.fovy / 2);
    const tanX = tanY * p.aspectRatio;
    const ndcX = (x / viewport.width) * 2 - 1;
    const ndcY = 1 - (y / viewport.height) * 2;
    const dir = normalize(
      add(
        add(p.direction, scale(p.right, ndcX * tanX)),
        scale(p.up, ndcY * tanY),
      ),
    );
    return { origin: { ...p.position }, direction: dir };
  }

  function sampleOneRaw(point, against, excludeJson) {
    const lon = Number(point?.lon);
    const lat = Number(point?.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (scriptedHeights) {
      const h = scriptedHeights({ lon, lat }, against);
      if (!Number.isFinite(h)) return null;
      const source =
        against === 'tiles'
          ? 'tiles'
          : against === 'terrain'
            ? 'terrain'
            : 'terrain';
      return { height: h, source };
    }
    const res = engine.sample_height_now(
      lon * DEG_TO_RAD,
      lat * DEG_TO_RAD,
      against,
      excludeJson,
    );
    if (!res || res.length < 2 || !Number.isFinite(res[0])) return null;
    const source = SOURCE_NAMES[Math.round(res[1])] ?? 'terrain';
    return { height: res[0], source };
  }

  const port = {
    pick(x, y, win) {
      if (isDestroyed()) return null;
      const w = win?.width ?? 3;
      const h = win?.height ?? 3;
      try {
        syncCameraToWasm();
        const raw = withUnmodulatedPick(() => engine.pick(x, y, w, h));
        return decodePickEntries(raw)[0] ?? null;
      } catch (error) {
        report(error);
        return null;
      }
    },

    drillPick(x, y, options = {}) {
      if (isDestroyed()) return [];
      const w = options.width ?? 3;
      const h = options.height ?? 3;
      const limit = options.limit;
      if (limit === 0) return [];
      try {
        syncCameraToWasm();
        const rawHits = withUnmodulatedPick(() =>
          engine.drill_pick(x, y, w, h, limit ?? 0),
        );
        const seen = new Set();
        const out = [];
        for (const raw of rawHits) {
          for (const hit of decodePickEntries(raw)) {
            const key = `${hit.set}\0${hit.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(hit);
            if (limit !== undefined && out.length >= limit) return out;
          }
        }
        return out;
      } catch (error) {
        report(error);
        return [];
      }
    },

    pickPosition(x, y) {
      if (isDestroyed() || !can('pickPosition')) return null;
      try {
        syncCameraToWasm();
        const hit = engine.pick_position(x, y);
        if (hit && hit.length === 3) {
          return { x: hit[0], y: hit[1], z: hit[2] };
        }
        return null;
      } catch (error) {
        report(error);
        return null;
      }
    },

    pickEllipsoid(x, y) {
      if (isDestroyed()) return null;
      const ray = pickRayAt(x, y);
      if (!ray) return null;
      return rayEllipsoid(ray);
    },

    pickGlobe(ray) {
      if (isDestroyed() || !ray) return null;
      try {
        const hit = engine.pick_globe_ray(
          ray.origin.x,
          ray.origin.y,
          ray.origin.z,
          ray.direction.x,
          ray.direction.y,
          ray.direction.z,
        );
        if (hit && hit.length === 3) {
          return { x: hit[0], y: hit[1], z: hit[2] };
        }
        return null;
      } catch {
        return rayEllipsoid(ray);
      }
    },

    pickRay: pickRayAt,
    project: projectPoint,

    projectMany(source, out) {
      const { view, projection } = camera.port.matrices();
      const n = Math.floor(source.length / 3);
      for (let i = 0; i < n; i++) {
        const px = source[i * 3];
        const py = source[i * 3 + 1];
        const pz = source[i * 3 + 2];
        const vx = view[0] * px + view[4] * py + view[8] * pz + view[12];
        const vy = view[1] * px + view[5] * py + view[9] * pz + view[13];
        const vz = view[2] * px + view[6] * py + view[10] * pz + view[14];
        const vw = view[3] * px + view[7] * py + view[11] * pz + view[15];
        const cx =
          projection[0] * vx +
          projection[4] * vy +
          projection[8] * vz +
          projection[12] * vw;
        const cy =
          projection[1] * vx +
          projection[5] * vy +
          projection[9] * vz +
          projection[13] * vw;
        const cw =
          projection[3] * vx +
          projection[7] * vy +
          projection[11] * vz +
          projection[15] * vw;
        if (cw > 0) {
          out[i * 2] = ((cx / cw) * 0.5 + 0.5) * viewport.width;
          out[i * 2 + 1] = (0.5 - (cy / cw) * 0.5) * viewport.height;
        } else {
          out[i * 2] = Number.NaN;
          out[i * 2 + 1] = Number.NaN;
        }
      }
    },

    isOccluded(position) {
      const p = positionToEcefSafe(position);
      const eye = camera.port.pose().position;
      return !horizonFrom(eye).isPointVisible(p);
    },

    sampleHeightNow(point, { against = 'surface', exclude } = {}) {
      if (isDestroyed() || !can('sampleHeight')) return null;
      const excludeJson = exclude?.length ? JSON.stringify(exclude) : '[]';
      const hit = sampleOneRaw(point, against, excludeJson);
      return hit ? hit.height : null;
    },

    async sampleHeight(
      points,
      { against = 'surface', exclude, mostDetailed = false } = {},
    ) {
      const list = points ?? [];
      if (isDestroyed() || !can('sampleHeight')) return list.map(() => null);
      const lod = mostDetailed && can('finestHeights') ? 'finest' : 'visible';

      if (
        !scriptedHeights &&
        against === 'terrain' &&
        mostDetailed &&
        can('finestHeights') &&
        !engine.is_ellipsoid_terrain()
      ) {
        const packed = new Float64Array(list.length * 2);
        const valid = new Array(list.length);
        for (let i = 0; i < list.length; i++) {
          const lon = Number(list[i]?.lon);
          const lat = Number(list[i]?.lat);
          const ok = Number.isFinite(lon) && Number.isFinite(lat);
          valid[i] = ok;
          packed[i * 2] = ok ? lon * DEG_TO_RAD : 0;
          packed[i * 2 + 1] = ok ? lat * DEG_TO_RAD : 0;
        }
        const heights = await engine.sample_terrain_finest(packed);
        return list.map((_, i) => {
          if (!valid[i]) return null;
          const h = heights[i];
          if (!Number.isFinite(h)) return null;
          return { height: h, confidence: 1, source: 'terrain', lod };
        });
      }

      const excludeJson = exclude?.length ? JSON.stringify(exclude) : '[]';
      return list.map((point) => {
        const hit = sampleOneRaw(point, against, excludeJson);
        if (!hit) return null;
        return {
          height: hit.height,
          confidence: 1,
          source: hit.source,
          lod,
        };
      });
    },

    async clampToSurface(positions, options = {}) {
      const list = positions ?? [];
      if (isDestroyed() || !can('sampleHeight')) return list.map(() => null);
      const pts = list.map((p) => {
        if (
          !p ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          !Number.isFinite(p.z)
        ) {
          return null;
        }
        const c = toCartographicRadians(p);
        return { lon: c.lon * RAD_TO_DEG, lat: c.lat * RAD_TO_DEG };
      });
      const samples = await port.sampleHeight(
        pts.map((pt) => pt ?? { lon: NaN, lat: NaN }),
        options,
      );
      return samples.map((sample, i) => {
        if (!sample || !pts[i]) return null;
        return toEcef({
          lon: pts[i].lon,
          lat: pts[i].lat,
          height: sample.height,
        });
      });
    },

    async rayCast(
      ray,
      { against = 'surface', exclude, maxDistance = Infinity } = {},
    ) {
      if (isDestroyed() || !can('rayCast') || !ray) return null;
      const excludeJson = exclude?.length ? JSON.stringify(exclude) : '[]';
      const maxD = Number.isFinite(maxDistance) ? maxDistance : -1;
      try {
        syncCameraToWasm();
        const hit = engine.ray_cast(
          ray.origin.x,
          ray.origin.y,
          ray.origin.z,
          ray.direction.x,
          ray.direction.y,
          ray.direction.z,
          against,
          excludeJson,
          maxD,
        );
        if (hit && hit.length === 3) {
          return { x: hit[0], y: hit[1], z: hit[2] };
        }
        return null;
      } catch (error) {
        report(error);
        return null;
      }
    },
  };

  if (can('occlusionTest')) {
    port.occlusionTest = () => {
      const MAX_PER_FRAME = 64;
      let destroyed = false;
      let frameNow = 0;
      let takenThisFrame = 0;
      return {
        get mode() {
          if (destroyed || isDestroyed()) return 'off';
          return engine.pick_position_supported() ? 'sync' : 'off';
        },
        maxPerFrame: MAX_PER_FRAME,
        beginFrame(now) {
          frameNow = Number(now) || 0;
          takenThisFrame = 0;
        },
        add(point, position) {
          if (destroyed || isDestroyed() || !point || !position) return false;
          if (takenThisFrame >= MAX_PER_FRAME) return false;
          takenThisFrame += 1;
          point.pending = false;
          point.answered = true;
          const p = positionToEcefSafe(position);
          if (port.isOccluded(p)) {
            point.lastHiddenAt = frameNow;
            return true;
          }
          const screen = projectPoint(p);
          if (
            screen &&
            screen.x >= 0 &&
            screen.y >= 0 &&
            screen.x < viewport.width &&
            screen.y < viewport.height &&
            engine.pick_position_supported()
          ) {
            const surf = engine.pick_position(screen.x, screen.y);
            if (surf && surf.length === 3) {
              const eye = camera.port.pose().position;
              const dPoint = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
              const dSurf = Math.hypot(
                surf[0] - eye.x,
                surf[1] - eye.y,
                surf[2] - eye.z,
              );
              const margin = Math.max(2, dPoint * 0.005);
              if (dSurf + margin < dPoint) {
                point.lastHiddenAt = frameNow;
              }
            }
          }
          return true;
        },
        endFrame() {},
        reset() {
          takenThisFrame = 0;
        },
        destroy() {
          destroyed = true;
        },
      };
    };
  }

  return {
    port,
    projectPoint,
    pickRayAt,
    setScriptedHeights(fn) {
      scriptedHeights = typeof fn === 'function' ? fn : null;
    },
  };
}
