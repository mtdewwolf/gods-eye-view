/**
 * @module render/cesiumrs/drawHelpers
 * @description Phase 3 draw-set helpers for the CesiumRS renderer:
 * - `motionSegments` (`iconPosition` + `clampGround` + live/scene motion clocks)
 * - `cluster` (`clusterScreenPoints` screen clustering + seed-first pick mapping)
 * - `columns` (`setColumns` columnar updates preserving motion state across `shown`)
 * - `lineAgeFade`, `lineTimeWindow`, `lineBreaks` (multi-run line expansion,
 *   time-window clipping, and smooth age/width fading)
 */
import { clusterScreenPoints } from '../../geo/screenCluster.js';
import { cssColor } from '../color.js';
import { iconPosition } from '../motion/iconMotion.js';
import { toCartographicRadians, toEcef } from '../stub/math.js';

const RAD_TO_DEG = 180 / Math.PI;

function toRgba(color, fallback = [1, 1, 1, 1]) {
  if (!color) return fallback;
  if (typeof color === 'string') return cssColor(color) ?? fallback;
  if (Array.isArray(color) || ArrayBuffer.isView(color)) {
    return [
      Number(color[0] ?? 1),
      Number(color[1] ?? 1),
      Number(color[2] ?? 1),
      Number(color[3] ?? 1),
    ];
  }
  return fallback;
}

export function positionToEcefSafe(pos) {
  if (!pos) return { x: 0, y: 0, z: 0 };
  return toEcef(pos);
}

export function packPositions(positions) {
  if (!positions) return [];
  if (ArrayBuffer.isView(positions)) return Array.from(positions);
  const out = new Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    const p = positionToEcefSafe(positions[i]);
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

/**
 * Evaluate an icon item's current ECEF position under `motionSegments` and
 * `height: 'clampGround'`.
 */
export function resolveIconPosition(item, motionClockMs, canMotion, sampleGroundHeight) {
  let pos;
  if (canMotion && item.motion) {
    pos = iconPosition(item, motionClockMs);
  } else {
    pos = positionToEcefSafe(item.pos);
  }
  if (item.height === 'clampGround') {
    const c = toCartographicRadians(pos);
    const groundH = sampleGroundHeight
      ? sampleGroundHeight(c.lon * RAD_TO_DEG, c.lat * RAD_TO_DEG)
      : 0;
    return toEcef({
      lon: c.lon * RAD_TO_DEG,
      lat: c.lat * RAD_TO_DEG,
      height: Number.isFinite(groundH) ? groundH : 0,
    });
  }
  return pos;
}

/**
 * Compute the motion clock timestamp (ms) for a draw set spec.
 */
export function motionClockTimeMs(spec, sceneTimeMs, wallTimeMs) {
  const clock = spec?.motionClock;
  if (clock?.kind === 'live') {
    const delayMs = Number.isFinite(clock.delayMs) ? clock.delayMs : 0;
    return wallTimeMs - delayMs;
  }
  return sceneTimeMs;
}

/**
 * Apply a `Columns` batch update (`setColumns`) onto `record.items`.
 * Keeps each existing item's fields (including `motion`, `image`, `size`, etc.)
 * intact so hiding a row with `shown[i] = 0` and showing it again later resumes
 * its motion segment seamlessly.
 */
export function applyColumnsToRecord(record, columns) {
  if (!columns || !Array.isArray(columns.ids)) return [];
  const ids = columns.ids;
  const n = ids.length;
  const positions = columns.positions;
  const courses = columns.courses;
  const shown = columns.shown;
  const scales = columns.scales;
  const alphas = columns.alphas;
  const colors = columns.colors;
  const meta = columns.meta;
  const dirty = columns.dirty;

  const ranges =
    Array.isArray(dirty) && dirty.length > 0
      ? dirty
      : [{ start: 0, end: n }];
  const touched = [];

  for (const run of ranges) {
    const start = Math.max(0, Math.floor(run.start ?? 0));
    const end = Math.min(n, Math.floor(run.end ?? n));
    for (let i = start; i < end; i++) {
      const key = String(ids[i]);
      const prev = record.items.get(key);
      const next = prev ? { ...prev } : { id: key };
      if (positions && i * 3 + 2 < positions.length) {
        next.pos = {
          x: positions[i * 3],
          y: positions[i * 3 + 1],
          z: positions[i * 3 + 2],
        };
      }
      if (courses && i < courses.length) {
        next.rotation = -(courses[i] * Math.PI) / 180;
      }
      if (shown && i < shown.length) {
        next.show = shown[i] !== 0;
      }
      if (scales && i < scales.length) {
        next.scale = scales[i];
      }
      if (alphas && i < alphas.length) {
        next.alpha = alphas[i];
      }
      if (colors && i * 4 + 3 < colors.length) {
        next.color = [
          colors[i * 4] / 255,
          colors[i * 4 + 1] / 255,
          colors[i * 4 + 2] / 255,
          colors[i * 4 + 3] / 255,
        ];
      }
      if (meta && i < meta.length) {
        next.meta = meta[i];
      }
      record.items.set(key, next);
      touched.push(next);
    }
  }
  return touched;
}

/**
 * Compute screen-space clusters for an icon set with `spec.cluster`.
 */
export function computeIconClusters(
  record,
  { projectPoint, isOccluded, viewport, cameraPose },
) {
  const clusterSpec = record.spec?.cluster;
  if (!clusterSpec || !record.show) {
    record.clusterState = null;
    return { clusters: [], singleIds: new Set(record.items.keys()) };
  }
  const pixelRange = Number(clusterSpec.pixelRange ?? 20);
  const minimumClusterSize = Math.max(2, Number(clusterSpec.minimumSize ?? 2));
  const points = [];
  for (const [key, item] of record.items) {
    if (item.show === false) continue;
    const pos = record.currentPos?.get(key) ?? positionToEcefSafe(item.pos);
    if (isOccluded(pos)) continue;
    const screen = projectPoint(pos);
    if (!screen) continue;
    const w = Number(item.size?.[0] ?? 24) * Number(item.scale ?? 1);
    const h = Number(item.size?.[1] ?? 24) * Number(item.scale ?? 1);
    points.push({
      id: key,
      position: pos,
      screen,
      pixelSize: Math.max(w, h),
    });
  }
  const eyeHeight = Math.max(0, toCartographicRadians(cameraPose.position).height);
  const res = clusterScreenPoints({
    points,
    pixelRange,
    minimumClusterSize,
    viewHeight: viewport.height,
    eyeHeight,
    previous: record.clusterState ?? null,
    project: projectPoint,
    isOccluded,
  });
  record.clusterState = res.state;
  return {
    clusters: res.clusters,
    singleIds: new Set(res.single),
  };
}

// ── Line expansion: breaks, timeWindow, ageFade, split, revealFraction ──────

function slicePackedPositions(flat, fStart, fEnd) {
  const count = Math.floor(flat.length / 3);
  if (count < 2) return [];
  const a = Math.max(0, Math.min(1, fStart));
  const b = Math.max(0, Math.min(1, fEnd));
  if (b <= a) return [];
  if (a <= 0 && b >= 1) return flat;
  const cum = new Float64Array(count);
  let total = 0;
  for (let i = 1; i < count; i++) {
    const dx = flat[i * 3] - flat[(i - 1) * 3];
    const dy = flat[i * 3 + 1] - flat[(i - 1) * 3 + 1];
    const dz = flat[i * 3 + 2] - flat[(i - 1) * 3 + 2];
    total += Math.hypot(dx, dy, dz);
    cum[i] = total;
  }
  if (!(total > 0)) return flat;
  const dStart = a * total;
  const dEnd = b * total;
  const interp = (targetD) => {
    for (let i = 1; i < count; i++) {
      if (cum[i] >= targetD || i === count - 1) {
        const seg = cum[i] - cum[i - 1];
        const t =
          seg > 0 ? Math.max(0, Math.min(1, (targetD - cum[i - 1]) / seg)) : 0;
        return [
          flat[(i - 1) * 3] + (flat[i * 3] - flat[(i - 1) * 3]) * t,
          flat[(i - 1) * 3 + 1] + (flat[i * 3 + 1] - flat[(i - 1) * 3 + 1]) * t,
          flat[(i - 1) * 3 + 2] + (flat[i * 3 + 2] - flat[(i - 1) * 3 + 2]) * t,
        ];
      }
    }
    return [flat[0], flat[1], flat[2]];
  };
  const out = [];
  const p0 = interp(dStart);
  out.push(p0[0], p0[1], p0[2]);
  for (let i = 1; i < count - 1; i++) {
    if (cum[i] > dStart && cum[i] < dEnd) {
      out.push(flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]);
    }
  }
  const p1 = interp(dEnd);
  out.push(p1[0], p1[1], p1[2]);
  return out;
}

/**
 * Split a line's positions, timestamps, and segment colors/shows into separate
 * runs according to `item.breaks`.
 */
function splitRuns(packed, times, segColors, segShow, breaks) {
  const count = Math.floor(packed.length / 3);
  if (count < 2) return [];
  if (!Array.isArray(breaks) || breaks.length === 0) {
    return [{ packed, times, segColors, segShow }];
  }
  const cuts = [...new Set(breaks.map((b) => Math.floor(Number(b))))]
    .filter((b) => b > 0 && b < count)
    .sort((a, b) => a - b);
  cuts.push(count);
  const runs = [];
  let start = 0;
  for (const end of cuts) {
    if (end - start >= 2) {
      runs.push({
        packed: packed.slice(start * 3, end * 3),
        times: times ? times.slice(start, end) : null,
        segColors: segColors ? segColors.slice(start, end - 1) : null,
        segShow: segShow ? segShow.slice(start, end - 1) : null,
      });
    }
    start = end;
  }
  return runs;
}

/**
 * Clip a single segment `[p0, p1]` with timestamps `[t0, t1]` to `[minT, maxT]`.
 * Returns `null` if completely outside, else `{ p0, p1, t0, t1 }`.
 */
function clipSegmentByTime(p0, p1, t0, t1, minT, maxT) {
  if (t0 === t1) {
    if (t0 < minT || t0 > maxT) return null;
    return { p0, p1, t0, t1 };
  }
  let u0 = 0;
  let u1 = 1;
  const dt = t1 - t0;
  const fMin = (minT - t0) / dt;
  const fMax = (maxT - t0) / dt;
  const lo = Math.min(fMin, fMax);
  const hi = Math.max(fMin, fMax);
  u0 = Math.max(u0, lo);
  u1 = Math.min(u1, hi);
  if (u1 <= u0 + 1e-9) return null;
  const lerpP = (u) => [
    p0[0] + (p1[0] - p0[0]) * u,
    p0[1] + (p1[1] - p0[1]) * u,
    p0[2] + (p1[2] - p0[2]) * u,
  ];
  return {
    p0: lerpP(u0),
    p1: lerpP(u1),
    t0: t0 + dt * u0,
    t1: t0 + dt * u1,
  };
}

/**
 * Expand one `LineItem` into one or more `JsLineItem` payloads for `BrowserScene::replace_lines`.
 */
export function expandLineItem(item, { recordPickable, sceneTime, capabilities }) {
  const payload = [];
  const style = item.style ?? { kind: 'solid', color: [1, 1, 1, 1] };
  const baseColor = toRgba(style.color);
  const show = item.show !== false;
  const pickable = recordPickable && item.pickable !== false;
  const widthPx = Number(item.widthPx ?? 2);
  let packed = packPositions(item.positions);
  if (packed.length < 6) return payload;

  const canBreaks = capabilities.has('lineBreaks');
  const canAgeFade = capabilities.has('lineAgeFade');
  const canTimeWindow = capabilities.has('lineTimeWindow');

  if (typeof item.revealFraction === 'number') {
    if (item.revealFraction <= 0) return payload;
    if (item.revealFraction < 1) {
      packed = slicePackedPositions(packed, 0, item.revealFraction);
    }
  }
  if (packed.length < 6) return payload;

  if (style.kind === 'split') {
    const splitAt = Math.max(0, Math.min(1, Number(style.at ?? 0.5)));
    const reverse = Boolean(style.reverse);
    const behindColor = toRgba(style.behind, baseColor);
    const aheadColor = baseColor;
    const firstColor = reverse ? aheadColor : behindColor;
    const secondColor = reverse ? behindColor : aheadColor;
    const rimShade = Number(style.rim?.shade ?? 0.25);
    const rimFrac = Number(style.rim?.widthFraction ?? 0);
    const rimWidth = rimFrac > 0 ? Math.max(1, widthPx * rimFrac) : 0;
    const darken = (c) => [c[0] * rimShade, c[1] * rimShade, c[2] * rimShade, c[3]];
    const firstPos = slicePackedPositions(packed, 0, splitAt);
    const secondPos = slicePackedPositions(packed, splitAt, 1);
    for (const [pos, col] of [
      [firstPos, firstColor],
      [secondPos, secondColor],
    ]) {
      if (pos.length >= 6) {
        payload.push({
          id: String(item.id),
          positions: pos,
          width_px: widthPx,
          style_kind: 'solid',
          color: col,
          outline_color: rimWidth > 0 ? darken(col) : null,
          outline_width: rimWidth,
          glow_power: null,
          dash_length: null,
          dash_pattern: null,
          show,
          pickable,
        });
      }
    }
    return payload;
  }

  const ageFade = item.ageFade ?? null;
  const times =
    ageFade && (canAgeFade || canTimeWindow) && ageFade.times?.length >= 2
      ? Array.from(ageFade.times)
      : null;
  const segShow = Array.isArray(item.segmentShow) ? item.segmentShow : null;
  const segColors = Array.isArray(item.segmentColors) ? item.segmentColors : null;
  const runs = splitRuns(
    packed,
    times,
    segColors,
    segShow,
    canBreaks ? item.breaks : null,
  );

  const outlineColor = style.outline?.color ? toRgba(style.outline.color) : null;
  const outlineWidth = Number(style.outline?.widthPx ?? 0);

  for (const run of runs) {
    const runVerts = Math.floor(run.packed.length / 3);
    if (runVerts < 2) continue;

    // Age fade and/or time window active on this run.
    if (ageFade && run.times && run.times.length >= runVerts) {
      const hasWindow =
        canTimeWindow &&
        typeof ageFade.showMs === 'number' &&
        ageFade.showMs > 0;
      const minT = hasWindow ? sceneTime - ageFade.showMs : -Infinity;
      const maxT = hasWindow ? sceneTime : Infinity;
      const windowMs = Math.max(1, Number(ageFade.windowMs ?? 60_000));
      const alphaFloor = Math.min(1, Math.max(0, Number(ageFade.alphaFloor ?? 0)));
      const widthFloor = Math.min(1, Math.max(0.05, Number(ageFade.widthFloor ?? 1)));
      const needsSubdiv = canAgeFade && (alphaFloor < 0.999 || widthFloor < 0.999);
      const subSteps = needsSubdiv ? Math.max(1, Math.min(24, Math.ceil(24 / Math.max(1, runVerts - 1)))) : 1;

      for (let i = 0; i < runVerts - 1; i++) {
        if (run.segShow && run.segShow[i] === false) continue;
        const p0 = [run.packed[i * 3], run.packed[i * 3 + 1], run.packed[i * 3 + 2]];
        const p1 = [run.packed[(i + 1) * 3], run.packed[(i + 1) * 3 + 1], run.packed[(i + 1) * 3 + 2]];
        const t0 = Number(run.times[i]);
        const t1 = Number(run.times[i + 1]);
        const clipped = hasWindow
          ? clipSegmentByTime(p0, p1, t0, t1, minT, maxT)
          : { p0, p1, t0, t1 };
        if (!clipped) continue;

        const segBase = run.segColors?.[i]
          ? toRgba(run.segColors[i], baseColor)
          : baseColor;

        for (let s = 0; s < subSteps; s++) {
          const uA = s / subSteps;
          const uB = (s + 1) / subSteps;
          const uMid = (uA + uB) * 0.5;
          const tMid = clipped.t0 + (clipped.t1 - clipped.t0) * uMid;
          const ageFrac = canAgeFade
            ? Math.min(1, Math.max(0, (sceneTime - tMid) / windowMs))
            : 0;
          const aMul = 1 + (alphaFloor - 1) * ageFrac;
          const wMul = 1 + (widthFloor - 1) * ageFrac;
          const effAlpha = segBase[3] * aMul;
          if (effAlpha <= 0.01) continue;
          const aPos = [
            clipped.p0[0] + (clipped.p1[0] - clipped.p0[0]) * uA,
            clipped.p0[1] + (clipped.p1[1] - clipped.p0[1]) * uA,
            clipped.p0[2] + (clipped.p1[2] - clipped.p0[2]) * uA,
          ];
          const bPos = [
            clipped.p0[0] + (clipped.p1[0] - clipped.p0[0]) * uB,
            clipped.p0[1] + (clipped.p1[1] - clipped.p0[1]) * uB,
            clipped.p0[2] + (clipped.p1[2] - clipped.p0[2]) * uB,
          ];
          payload.push({
            id: String(item.id),
            positions: [aPos[0], aPos[1], aPos[2], bPos[0], bPos[1], bPos[2]],
            width_px: Math.max(1, widthPx * wMul),
            style_kind: style.kind ?? 'solid',
            color: [segBase[0], segBase[1], segBase[2], effAlpha],
            outline_color: outlineColor,
            outline_width: outlineWidth,
            glow_power: style.power ?? null,
            dash_length: style.length ?? null,
            dash_pattern: style.pattern16 ?? null,
            show,
            pickable,
          });
        }
      }
      continue;
    }

    if (run.segShow || run.segColors) {
      for (let i = 0; i < runVerts - 1; i++) {
        if (run.segShow && run.segShow[i] === false) continue;
        const segColor = run.segColors?.[i]
          ? toRgba(run.segColors[i], baseColor)
          : baseColor;
        payload.push({
          id: String(item.id),
          positions: [
            run.packed[i * 3],
            run.packed[i * 3 + 1],
            run.packed[i * 3 + 2],
            run.packed[(i + 1) * 3],
            run.packed[(i + 1) * 3 + 1],
            run.packed[(i + 1) * 3 + 2],
          ],
          width_px: widthPx,
          style_kind: style.kind ?? 'solid',
          color: segColor,
          outline_color: outlineColor,
          outline_width: outlineWidth,
          glow_power: style.power ?? null,
          dash_length: style.length ?? null,
          dash_pattern: style.pattern16 ?? null,
          show,
          pickable,
        });
      }
      continue;
    }

    payload.push({
      id: String(item.id),
      positions: run.packed,
      width_px: widthPx,
      style_kind: style.kind ?? 'solid',
      color: baseColor,
      outline_color: outlineColor,
      outline_width: outlineWidth,
      glow_power: style.power ?? null,
      dash_length: style.length ?? null,
      dash_pattern: style.pattern16 ?? null,
      show,
      pickable,
    });
  }

  return payload;
}
