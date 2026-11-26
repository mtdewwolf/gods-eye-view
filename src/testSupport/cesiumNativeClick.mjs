/**
 * @module testSupport/cesiumNativeClick
 * @description The Cesium-shaped picks of a click, for what the renderer's
 * picks do not name, over a viewer double. Ported from the default
 * renderer's adapter; the follow's helper entities are not used here.
 */
import * as Cesium from './cesiumrsCompat.mjs';
import { findPickOwner } from '../data/pickRegistry.js';
import { isSurfacePick } from '../data/scenePick.js';
import { provideNativeClick, rendererOf } from '../render/rendererOf.js';
import { drawHitOf } from './drawHit.mjs';
import { recentPick } from './pickMemo.mjs';

const DRILL_DEPTH = 16;

/**
 * A Cesium pick's canonical pick id, as a String; null when it carries none.
 * @param {object|null|undefined} picked
 * @returns {string|null}
 */
export function nativePickId(picked) {
  if (!picked) return null;
  const unwrap = (id) => {
    if (id === null || id === undefined) return undefined;
    if (typeof id === 'object') {
      if (typeof id.id === 'string' || typeof id.id === 'number') return id.id;
      return undefined;
    }
    return id;
  };
  let id = unwrap(picked.id);
  if (id === undefined) id = unwrap(picked.primitive?.id);
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

/** `pickContact` over Cesium's own picks: the first registered contact. */
export function nativePickContact(scene, position, options = {}) {
  const picked = 'picked' in options ? options.picked : scene.pick(position);
  if (
    !globalThis.matchMedia?.('(pointer: coarse)').matches ||
    findPickOwner(nativePickId(picked)) ||
    !isSurfacePick(picked) ||
    typeof scene.drillPick !== 'function'
  )
    return picked;
  let hits;
  try {
    hits =
      (options.drill
        ? options.drill(8, 14, 14)
        : scene.drillPick(position, 8, 14, 14)) || [];
  } catch {
    return picked;
  }
  for (const hit of hits.slice(0, 8)) {
    if (findPickOwner(nativePickId(hit))) return hit;
    if (!isSurfacePick(hit)) break;
  }
  return picked;
}

const foreignOf = (picked) =>
  isSurfacePick(picked)
    ? null
    : (drawHitOf(picked) ?? { id: nativePickId(picked) });

const hitOf = (picked) =>
  drawHitOf(picked) ??
  (isSurfacePick(picked)
    ? { set: '', id: '', surface: true }
    : { set: '', id: nativePickId(picked), surface: false });

/**
 * A click's picks at a pick-buffer position.
 * @param {object} scene
 * @param {{x: number, y: number}} at
 */
export function createNativeClick(scene, at) {
  const position = new Cesium.Cartesian2(at.x, at.y);
  const memo = new Map();
  const once = (key, compute) => {
    if (!memo.has(key)) memo.set(key, compute());
    return memo.get(key);
  };
  const drills = new Map();
  const picked = (width, height) => {
    const recent = recentPick(scene, at.x, at.y, width ?? 3, height ?? 3);
    return recent
      ? recent.picked
      : width === undefined
        ? scene.pick(position)
        : scene.pick(position, width, height);
  };
  const native = {
    get pick() {
      return once('pick', () => picked());
    },
    pickWindow(width, height) {
      return once(`window:${width}x${height}`, () => picked(width, height));
    },
    drill(limit = DRILL_DEPTH, width, height) {
      const key = `${width}x${height}`;
      const done = drills.get(key);
      if (done && (limit <= done.limit || done.hits.length < done.limit))
        return done.hits.slice(0, limit);
      if (typeof scene.drillPick !== 'function') return [];
      const depth =
        width === undefined && height === undefined
          ? Math.max(limit, DRILL_DEPTH)
          : limit;
      const hits = (
        scene.drillPick(position, depth, width, height) || []
      ).filter(Boolean);
      drills.set(key, { limit: depth, hits });
      return hits.slice(0, limit);
    },
  };
  return {
    native,
    drillHits: (limit, width, height) =>
      native.drill(limit, width, height).map(hitOf),
    foreign: (width, height) =>
      foreignOf(
        width === undefined && height === undefined
          ? native.pick
          : native.pickWindow(width, height),
      ),
  };
}

// A viewer double gets a click's own picks when code asks for them.
provideNativeClick((host, at) => {
  const viewer = (host && rendererOf(host)?.cesiumViewer) || host;
  const scene = viewer?.scene ?? viewer;
  if (typeof scene?.pick !== 'function') return null;
  return createNativeClick(scene, at);
});
