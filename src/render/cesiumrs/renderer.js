/**
 * @module render/cesiumrs/renderer
 * @description Phase 1 CesiumRS renderer implementing the required tier of the
 * gods-eye-view renderer contract (`contractVersion: '0'`, no optional
 * capabilities yet) over `CesiumRS`'s WebGL2 `BrowserScene`.
 *
 * Uses `CesiumRS`'s Rust `Scene`, `Globe`, `UrlTemplateImageryProvider`,
 * `SingleTileImageryProvider`, `PointPrimitiveCollection`,
 * `BillboardCollection`, `PolylineCollection`, `Primitive`, and GPU color
 * picking, paired with GEV's contract-exact camera/input modules.
 */
import { CONTRACT_VERSION } from '../contract/index.js';
import { createInputRouter } from '../input/router.js';
import { WHEEL_PX_PER_LINE, wheelLines } from '../input/wheel.js';
import { cssColor } from '../color.js';
import { createStubCamera } from '../stub/camera.js';
import { computeViewRectangle } from '../stub/viewRectangle.js';
import {
  add,
  cross,
  normalize,
  rayEllipsoid,
  rotate,
  scale,
  toCartographicRadians,
  toEcef,
} from '../stub/math.js';
import { createCesiumRsField } from './drawFields.js';
import {
  applyColumnsToRecord,
  computeIconClusters,
  expandLineItem,
  motionClockTimeMs,
  resolveIconPosition,
} from './drawHelpers.js';
import { createCesiumRsModelSet } from './drawModels.js';
import { createCesiumRsEffects } from './effects.js';
import { createCesiumRsGlobe } from './globe.js';
import { createCesiumRsQuery } from './query.js';
import { loadCesiumRsWasm } from './wasm.js';

export const CESIUMRS_CAPABILITIES = Object.freeze([
  'globeVisibility',
  'surfaceIdentity',
  'holdChanges',
  'splitSwipe',
  'surfaceShading',
  'imageHooks',
  'vectorBase',
  'imageryFrames',
  'imageryDecoded',
  'terrain',
  'photoreal',
  'imageryOnTiles',
  'pickPosition',
  'sampleHeight',
  'finestHeights',
  'rayCast',
  // Phase 3 capabilities:
  'motionSegments',
  'cluster',
  'columns',
  'lineAgeFade',
  'lineTimeWindow',
  'lineBreaks',
  'models',
  'modelNodes',
  'modelParts',
  'fields',
  'styles',
  'bloom',
  'sharpen',
  'screenModulation',
  'weather',
  'occlusionTest',
  // Phase 4 capabilities (full 36/36 contract parity):
  'cameraChangeThreshold',
  'followAutodetect',
  'followFrame',
  'keepEarthFramed',
]);

const FRAME_MS = 1000 / 60;
const NO_MODIFIERS = Object.freeze({
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
});

const KNOBS = Object.freeze([
  { key: 'pixelRatio', kind: 'number', min: 0, max: 4, default: 0, cost: 1 },
  { key: 'targetFps', kind: 'number', min: 0, max: 240, default: 0, cost: 0.2 },
]);

const destroyedError = () => new Error('renderer destroyed');

/** Read-only capabilities set matching the Cesium adapter's contract. */
class ReadonlySet extends Set {
  #sealed;
  constructor(values = []) {
    super();
    for (const v of values) super.add(v);
    this.#sealed = true;
  }
  add() {
    if (this.#sealed) throw new TypeError('capabilities are read-only');
    return this;
  }
  delete() {
    throw new TypeError('capabilities are read-only');
  }
  clear() {
    throw new TypeError('capabilities are read-only');
  }
}

function uncaught(error) {
  if (typeof globalThis.reportError === 'function')
    globalThis.reportError(error);
  else
    queueMicrotask(() => {
      throw error;
    });
}

function toRgba(color, fallback = [1, 1, 1, 1]) {
  if (!color) return fallback;
  if (typeof color === 'string') {
    const parsed = cssColor(color);
    return parsed ?? fallback;
  }
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

function positionToEcefSafe(pos) {
  if (!pos) return { x: 0, y: 0, z: 0 };
  return toEcef(pos);
}

function packPositions(positions) {
  if (!positions) return [];
  if (ArrayBuffer.isView(positions)) {
    return Array.from(positions);
  }
  const out = new Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    const p = positionToEcefSafe(positions[i]);
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

const WHITE_PIXEL = new Uint8Array([255, 255, 255, 255]);
let anonObjSeq = 0;
const anonObjIds = new WeakMap();

function anonIdFor(obj) {
  let id = anonObjIds.get(obj);
  if (!id) {
    id = ++anonObjSeq;
    anonObjIds.set(obj, id);
  }
  return id;
}

function packDisplayRange(range) {
  if (!Array.isArray(range) || range.length < 2) return null;
  const near = Number.isFinite(range[0]) ? Math.max(0, range[0]) : 0;
  const far = Number.isFinite(range[1]) ? range[1] : 1e15;
  return far > near ? [near, far] : null;
}

function packDisableDepthTest(v) {
  if (v === Infinity) return -1;
  if (Number.isFinite(v)) return Math.max(0, v);
  return null;
}

function resolveImageRef(ref, atlases) {
  if (!ref) return { resolved: null, key: '__fallback_white__' };
  if (typeof ref === 'object' && ref.atlas && ref.slot) {
    const slotRef = atlases.get(ref.atlas)?.[ref.slot];
    if (!slotRef) return { resolved: null, key: null, waitingAtlas: ref.atlas };
    return resolveImageRef(slotRef, atlases);
  }
  if (typeof ref === 'string') return { resolved: ref, key: `url:${ref}` };
  if (typeof ref === 'object' && typeof ref.svg === 'string')
    return { resolved: ref, key: `svg:${ref.svg}` };
  if (typeof ref === 'object' && ref.canvas)
    return {
      resolved: ref,
      key: ref.key ? `canvas:${ref.key}` : `canvas-obj:${anonIdFor(ref.canvas)}`,
    };
  if (typeof ref === 'object' && ref.blob)
    return { resolved: ref, key: `blob-obj:${anonIdFor(ref.blob)}` };
  return { resolved: null, key: '__fallback_white__' };
}

/** Decode any resolved `ImageRef` to `{ width, height, rgba: Uint8Array }`, deduplicating in-flight decodes. */
function decodeImageRef(resolved, key, promiseCache, decodedCache, sizeHint) {
  if (!resolved) {
    const fallback = { width: 1, height: 1, rgba: WHITE_PIXEL };
    decodedCache.set(key, fallback);
    return Promise.resolve(fallback);
  }
  if (decodedCache.has(key)) return Promise.resolve(decodedCache.get(key));
  if (promiseCache.has(key)) return promiseCache.get(key);

  const wHint = Math.max(1, Math.round(sizeHint?.[0] ?? 32));
  const hHint = Math.max(1, Math.round(sizeHint?.[1] ?? 32));

  const readCanvas = (source, w, h) => {
    const width = Math.max(1, Math.round(w || wHint));
    const height = Math.max(1, Math.round(h || hHint));
    const c =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    return {
      width,
      height,
      rgba: new Uint8Array(
        data.data.buffer,
        data.data.byteOffset,
        data.data.byteLength,
      ),
    };
  };

  const promise = (async () => {
    let result = null;
    try {
      if (typeof resolved === 'object' && resolved.canvas) {
        result = readCanvas(
          resolved.canvas,
          resolved.canvas.width,
          resolved.canvas.height,
        );
      } else if (typeof resolved === 'object' && resolved.blob) {
        const bmp = await createImageBitmap(resolved.blob);
        try {
          result = readCanvas(bmp, bmp.width, bmp.height);
        } finally {
          bmp.close?.();
        }
      } else if (typeof resolved === 'object' && typeof resolved.svg === 'string') {
        const blob = new Blob([resolved.svg], {
          type: 'image/svg+xml;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        try {
          const img = await loadHtmlImage(url);
          result = readCanvas(
            img,
            img.naturalWidth || wHint,
            img.naturalHeight || hHint,
          );
        } finally {
          URL.revokeObjectURL(url);
        }
      } else if (typeof resolved === 'string') {
        const img = await loadHtmlImage(resolved);
        result = readCanvas(
          img,
          img.naturalWidth || wHint,
          img.naturalHeight || hHint,
        );
      }
    } catch {
      result = null;
    }
    const finalImg = result ?? { width: 1, height: 1, rgba: WHITE_PIXEL };
    if (decodedCache.size > 512) decodedCache.clear();
    decodedCache.set(key, finalImg);
    promiseCache.delete(key);
    return finalImg;
  })();

  if (promiseCache.size > 512) promiseCache.clear();
  promiseCache.set(key, promise);
  return promise;
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Each renderer's synthetic pointer injector, for the conformance harness. */
const pointerFeeds = new WeakMap();
/** Each renderer's manual frame ticker, for the conformance harness. */
const manualTickers = new WeakMap();
/** Each renderer's pending-icon-decode query, for the conformance harness. */
const pendingDecodeQueries = new WeakMap();
/** Each renderer's scripted-heights hook, for the conformance harness. */
const scriptedHeightSetters = new WeakMap();

export const pointerFeedOf = (renderer) => pointerFeeds.get(renderer) ?? null;
export const manualTickerOf = (renderer) => manualTickers.get(renderer) ?? null;
export const hasPendingDecodesOf = (renderer) =>
  pendingDecodeQueries.get(renderer)?.() ?? false;
export const scriptHeightsSetterOf = (renderer) =>
  scriptedHeightSetters.get(renderer) ?? null;

/**
 * Create a Phase 1 CesiumRS renderer inside `container`.
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {number} [options.msaa=4]
 * @param {Partial<import('../contract/globe').SkySettings>} [options.sky]
 * @param {number} [options.time]
 * @param {{now(): number, date(): number}} [options.clock]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.manualLoop=false] When true, does not start an internal rAF loop (for conformance tests).
 * @param {{width: number, height: number}} [options.viewport]
 */
export async function createCesiumRsRenderer(options) {
  const {
    container,
    msaa = 4,
    sky: initialSky,
    time: initialTime,
    clock: externalClock,
    signal,
    manualLoop = false,
    viewport: initialViewport,
    capabilities: requestedCapabilities,
    credentials = {},
    onDestroy,
  } = options;

  signal?.throwIfAborted();
  const { BrowserScene } = await loadCesiumRsWasm();
  signal?.throwIfAborted();

  // ── Canvas & WebGL2 context ───────────────────────────────────────────────
  const doc = container.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const viewport = {
    width: Math.max(
      1,
      Math.round(initialViewport?.width || container.clientWidth || 640),
    ),
    height: Math.max(
      1,
      Math.round(initialViewport?.height || container.clientHeight || 360),
    ),
  };

  let qualitySettings = {
    pixelRatio: 0,
    targetFps: 0,
  };

  const effectiveDpr = () => {
    const raw =
      qualitySettings.pixelRatio > 0
        ? qualitySettings.pixelRatio
        : globalThis.devicePixelRatio || 1;
    return Math.min(Math.max(raw, 0.5), 4);
  };

  const applyCanvasSize = () => {
    const dpr = effectiveDpr();
    const w = Math.max(1, Math.round(viewport.width * dpr));
    const h = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return { w, h, dpr };
  };

  const { w: initW, h: initH, dpr: initDpr } = applyCanvasSize();

  const gl = canvas.getContext('webgl2', {
    antialias: msaa > 0,
    alpha: false,
    depth: true,
    stencil: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    canvas.remove();
    throw new Error('CesiumRS requires WebGL2');
  }

  let sceneTime = Number.isFinite(initialTime) ? initialTime : Date.now();
  const engine = new BrowserScene(gl, initW, initH, initDpr, sceneTime);

  // ── Capabilities & Events ─────────────────────────────────────────────────
  const supportedCaps = CESIUMRS_CAPABILITIES.filter((cap) => {
    if (cap === 'pickPosition') return engine.pick_position_supported();
    if (cap === 'sampleHeight' || cap === 'finestHeights' || cap === 'rayCast')
      return engine.sample_height_supported();
    return true;
  });
  const activeCaps = requestedCapabilities
    ? [...requestedCapabilities].filter((c) => supportedCaps.includes(c))
    : supportedCaps;
  const capabilities = new ReadonlySet(activeCaps);
  const rendererListeners = {
    error: [],
    contextLost: [],
    contextRestored: [],
  };

  function report(error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const list = rendererListeners.error;
    if (list.length === 0) {
      uncaught(err);
      return;
    }
    for (const entry of list.slice()) {
      if (!entry.live) continue;
      try {
        entry.cb(err);
      } catch (inner) {
        uncaught(inner);
      }
    }
  }

  function deliver(list, ...args) {
    for (const entry of list.slice()) {
      if (!entry.live) continue;
      try {
        entry.cb(...args);
      } catch (error) {
        report(error);
      }
    }
  }

  const subscribe = (list, cb) => {
    const entry = { cb, live: true };
    list.push(entry);
    return () => {
      entry.live = false;
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
    };
  };

  const onContextLost = (ev) => {
    ev.preventDefault();
    deliver(rendererListeners.contextLost);
  };
  const onContextRestored = () => {
    deliver(rendererListeners.contextRestored);
    requestRender('contextRestored');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // ── Clock & Frame Loop ────────────────────────────────────────────────────
  let destroyed = false;
  let suspended = false;
  let frameCount = 0;
  let rendered = 0;
  let targetFps = 0;
  let lastTickNow = externalClock ? externalClock.now() : performance.now();
  let lastRenderWallNow = 0;
  let rafId = 0;

  const pendingReasons = [];
  const continuous = new Map();
  let holdSeq = 0;
  const heldListeners = [];
  const holdsListeners = [];
  const phaseListeners = { preUpdate: [], preRender: [], postRender: [] };
  const signalListeners = [];
  const onceWaiters = [];
  const onceTimers = new Set();

  let updating = null;

  const nowMs = () => (externalClock ? externalClock.now() : performance.now());
  const wallTimeMs = () =>
    typeof externalClock?.date === 'function' ? externalClock.date() : Date.now();

  function requestRender(reason = 'request') {
    if (destroyed) return;
    pendingReasons.push(String(reason));
    if (updating) updating.rendering = true;
  }

  function sampleGroundHeightAt(lonDeg, latDeg) {
    if (!query) return 0;
    const h = query.sampleHeightNow(
      { lon: lonDeg, lat: latDeg },
      { against: 'terrain' },
    );
    return Number.isFinite(h) ? h : 0;
  }

  function drawnPosition(ref, aheadMs = 0) {
    if (!ref) return null;
    const record = sets.get(ref.set);
    if (!record || record.disposed) return null;
    const item = record.items.get(String(ref.id));
    if (!item) return null;
    if (record.kind === 'icons') {
      const canMotion = capabilities.has('motionSegments');
      const clockMs =
        motionClockTimeMs(record.spec, sceneTime, wallTimeMs()) + aheadMs;
      return resolveIconPosition(item, clockMs, canMotion, sampleGroundHeightAt);
    }
    return item.pos ? positionToEcefSafe(item.pos) : null;
  }

  // ── Camera (contract-exact maths synced to Rust BrowserScene) ─────────────
  const camera = createStubCamera({
    viewport: () => viewport,
    now: nowMs,
    sceneTime: () => sceneTime,
    drawnPosition,
    requestRender,
    report,
    thresholds: capabilities.has('cameraChangeThreshold'),
    framing: capabilities.has('keepEarthFramed'),
  });
  if (capabilities.has('followFrame')) {
    camera.port.followFrame = camera.eyeFrame;
  }
  camera.setViewRectangle(() =>
    computeViewRectangle(camera.port.pose(), viewport, (x, y) => {
      const ray = pickRayAt(x, y);
      return ray ? rayEllipsoid(ray) : null;
    }),
  );

  // Start over a sensible whole-Earth view so first render looks right.
  camera.port.setView({
    destination: { lon: -40, lat: 28, height: 18_000_000 },
    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
  });
  pendingReasons.length = 0;
  requestRender('initial');

  function syncCameraToWasm() {
    const p = camera.port.pose();
    engine.set_camera_pose(
      p.position.x,
      p.position.y,
      p.position.z,
      p.direction.x,
      p.direction.y,
      p.direction.z,
      p.up.x,
      p.up.y,
      p.up.z,
      p.right.x,
      p.right.y,
      p.right.z,
      p.fovy,
      p.near,
      p.far,
    );
  }

  // ── Credits ───────────────────────────────────────────────────────────────
  const creditListeners = [];
  const staticCredits = [];
  const imageryCredits = new Map();

  function listCredits() {
    const out = [{ text: 'CesiumRS', inline: true }];
    for (const c of staticCredits) out.push({ ...c });
    for (const c of imageryCredits.values()) out.push({ ...c });
    return out;
  }

  function announceCredits() {
    deliver(creditListeners, listCredits());
  }

  const credits = {
    addStatic(credit) {
      const entry = { ...credit };
      staticCredits.push(entry);
      announceCredits();
      return () => {
        const i = staticCredits.indexOf(entry);
        if (i >= 0) {
          staticCredits.splice(i, 1);
          announceCredits();
        }
      };
    },
    list: listCredits,
    on(event, cb) {
      if (event !== 'change') return () => {};
      return subscribe(creditListeners, cb);
    },
  };

  // ── Globe & Imagery (Phase 2/3 modular port) ──────────────────────────────
  const globePart = createCesiumRsGlobe(engine, {
    capabilities,
    credentials,
    initialSky,
    credits,
    camera,
    getSceneTime: () => sceneTime,
    requestRender,
    report,
    subscribe,
    deliver,
  });
  const globe = globePart.port;

  // ── Draw Port ─────────────────────────────────────────────────────────────
  const sets = new Map();
  const fields = new Set();
  const atlases = new Map();
  const atlasWaiters = new Map();
  const imageCache = new Map();
  const decodedImageCache = new Map();
  const clampStateListeners = [];
  let pendingImageDecodes = 0;
  let modulationDirty = false;
  let getModulationSampler = () => null;

  function makeDeadSet(id) {
    let show = false;
    return {
      id,
      set() {},
      upsert() {},
      remove() {},
      clear() {},
      ...(capabilities.has('columns') ? { setColumns() {} } : {}),
      setOptions() {},
      size: () => 0,
      get show() {
        return show;
      },
      set show(v) {
        show = Boolean(v);
      },
      on: () => () => {},
      dispose() {},
    };
  }

  function makeDrawSet(kind, spec) {
    if (!spec?.id || typeof spec.id !== 'string')
      throw new TypeError('SetSpec.id must be a non-empty string');
    if (destroyed) return makeDeadSet(spec.id);
    if (sets.has(spec.id))
      throw new Error(`Draw set "${spec.id}" already exists`);

    const id = spec.id;
    const drawOrder = Number.isFinite(spec.drawOrder) ? spec.drawOrder : 0;
    const record = {
      id,
      kind,
      spec: { ...spec },
      show: spec.show !== false,
      pickable: spec.pickable !== false,
      drawOrder,
      items: new Map(),
      uploadedImages: new Set(),
      currentPos: new Map(),
      clusterHits: new Map(),
      clusterIds: new Set(),
      clusterState: null,
      hasMotion: false,
      hasTimeLines: false,
      lastLineSceneTime: NaN,
      modulated: false,
      disposed: false,
      listeners: { ready: [], loadFailed: [] },
    };
    sets.set(id, record);

    if (kind === 'points')
      engine.create_point_set(id, record.show, record.pickable, drawOrder);
    else if (kind === 'icons')
      engine.create_icon_set(id, record.show, record.pickable, drawOrder);
    else if (kind === 'lines')
      engine.create_line_set(id, record.show, record.pickable, drawOrder);
    else if (kind === 'shapes') {
      engine.create_shape_set(id, record.show, record.pickable, drawOrder);
      engine.create_line_set(
        `${id}::outlines`,
        record.show,
        record.pickable,
        drawOrder,
      );
    }
    if (spec.blend) engine.set_draw_set_blend(id, String(spec.blend));
    if (spec.includeInHeightQueries)
      engine.set_draw_set_height_query(id, true);

    function syncPoints() {
      const payload = [];
      for (const item of record.items.values()) {
        const p = positionToEcefSafe(item.pos);
        payload.push({
          id: String(item.id),
          x: p.x,
          y: p.y,
          z: p.z,
          pixel_size: Number(item.pixelSize ?? 6),
          color: toRgba(item.color),
          outline_color: item.outlineColor ? toRgba(item.outlineColor) : null,
          outline_width: Number(item.outlineWidth ?? 0),
          show: item.show !== false,
          pickable: record.pickable && item.pickable !== false,
          disable_depth_test: packDisableDepthTest(item.disableDepthTest),
          scale_by_distance: item.scaleByDistance
            ? [
                item.scaleByDistance.near,
                item.scaleByDistance.nearValue,
                item.scaleByDistance.far,
                item.scaleByDistance.farValue,
              ]
            : null,
          fade_by_distance: item.fadeByDistance
            ? [
                item.fadeByDistance.near,
                item.fadeByDistance.nearValue,
                item.fadeByDistance.far,
                item.fadeByDistance.farValue,
              ]
            : null,
          display_range: packDisplayRange(item.displayRange),
        });
      }
      engine.replace_points(id, JSON.stringify(payload));
    }

    function syncLines() {
      const payload = [];
      let hasTime = false;
      for (const item of record.items.values()) {
        if (item.ageFade?.times?.length >= 2) hasTime = true;
        const expanded = expandLineItem(item, {
          recordPickable: record.pickable,
          sceneTime,
          capabilities,
        });
        for (const entry of expanded) payload.push(entry);
      }
      record.hasTimeLines = hasTime;
      record.lastLineSceneTime = sceneTime;
      engine.replace_lines(id, JSON.stringify(payload));
    }

    function syncShapes() {
      const fills = [];
      const outlines = [];
      for (const item of record.items.values()) {
        const g = item.geometry;
        if (!g) continue;
        const show = item.show !== false;
        const pickable = record.pickable && item.pickable !== false;
        const hasFill =
          !item.outlineOnly &&
          item.fill != null &&
          (typeof item.fill !== 'object' ||
            Array.isArray(item.fill) ||
            ArrayBuffer.isView(item.fill) ||
            'image' in item.fill ||
            'color' in item.fill);
        if (hasFill) {
          const fillColor =
            typeof item.fill === 'object' &&
            !Array.isArray(item.fill) &&
            !ArrayBuffer.isView(item.fill)
              ? toRgba(item.fill.color, [1, 1, 1, 1])
              : toRgba(item.fill);
          const base = {
            id: String(item.id),
            kind: g.kind,
            fill_color: fillColor,
            extrude_height:
              typeof item.extrudeHeight === 'number' ? item.extrudeHeight : null,
            lit: typeof item.lit === 'boolean' ? item.lit : null,
            show,
            pickable,
          };
          if (g.kind === 'polygon' && g.rings?.length) {
            base.positions = packPositions(g.rings[0]);
            base.holes = g.rings.slice(1).map(packPositions);
            base.per_position_height = Boolean(g.perPositionHeight);
            fills.push(base);
          } else if (g.kind === 'rectangle' && g.rect) {
            base.rect = [g.rect.west, g.rect.south, g.rect.east, g.rect.north];
            base.height = g.height ?? 0;
            base.rotation = g.rotation ?? 0;
            fills.push(base);
          } else if (g.kind === 'ellipse' && g.center) {
            const c = positionToEcefSafe(g.center);
            base.center = [c.x, c.y, c.z];
            base.semi_major = g.semiMajor;
            base.semi_minor = g.semiMinor;
            base.rotation = g.rotation ?? 0;
            fills.push(base);
          } else if (g.kind === 'wall' && g.positions?.length) {
            base.positions = packPositions(g.positions);
            base.minimum_heights = g.minimumHeights ?? null;
            base.maximum_heights = g.maximumHeights ?? null;
            fills.push(base);
          }
        }
        if (item.outline) {
          const outlineColor = toRgba(item.outline);
          const outlineWidth = Number(item.outlineWidth ?? 1.5);
          if (g.kind === 'polygon' && g.rings?.length) {
            for (let r = 0; r < g.rings.length; r++) {
              const ring = g.rings[r];
              if (!ring || ring.length < 2) continue;
              outlines.push({
                id: String(item.id),
                positions: packPositions([...ring, ring[0]]),
                width_px: outlineWidth,
                style_kind: 'solid',
                color: outlineColor,
                show,
                pickable,
              });
            }
          } else if (g.kind === 'rectangle' && g.rect) {
            const h = g.height ?? 0;
            const { west, south, east, north } = g.rect;
            const corners = [
              { lon: west, lat: south, height: h },
              { lon: east, lat: south, height: h },
              { lon: east, lat: north, height: h },
              { lon: west, lat: north, height: h },
              { lon: west, lat: south, height: h },
            ];
            outlines.push({
              id: String(item.id),
              positions: packPositions(corners),
              width_px: outlineWidth,
              style_kind: 'solid',
              color: outlineColor,
              show,
              pickable,
            });
          } else if (g.kind === 'ellipse' && g.center && g.semiMajor && g.semiMinor) {
            const c = toCartographicRadians(positionToEcefSafe(g.center));
            const latDeg = (c.lat * 180) / Math.PI;
            const lonDeg = (c.lon * 180) / Math.PI;
            const cosLat = Math.max(0.05, Math.cos(c.lat));
            const rot = g.rotation ?? 0;
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            const ring = [];
            for (let k = 0; k <= 32; k++) {
              const th = (k / 32) * Math.PI * 2;
              const lx = Math.cos(th) * g.semiMajor;
              const ly = Math.sin(th) * g.semiMinor;
              const eastM = lx * cosR - ly * sinR;
              const northM = lx * sinR + ly * cosR;
              ring.push({
                lon: lonDeg + (eastM / (111320 * cosLat)),
                lat: latDeg + northM / 110540,
                height: c.height,
              });
            }
            outlines.push({
              id: String(item.id),
              positions: packPositions(ring),
              width_px: outlineWidth,
              style_kind: 'solid',
              color: outlineColor,
              show,
              pickable,
            });
          }
        }
      }
      engine.replace_shapes(id, JSON.stringify(fills));
      engine.replace_lines(`${id}::outlines`, JSON.stringify(outlines));
    }

    function iconBaseColor(item) {
      const rgbaColor = toRgba(item.color).slice();
      if (typeof item.alpha === 'number') rgbaColor[3] *= item.alpha;
      if (typeof item.focus === 'number') rgbaColor[3] *= item.focus;
      return rgbaColor;
    }

    function evaluateIconPos(item) {
      const canMotion = capabilities.has('motionSegments');
      const clockMs = motionClockTimeMs(record.spec, sceneTime, wallTimeMs());
      const p = resolveIconPosition(item, clockMs, canMotion, sampleGroundHeightAt);
      record.currentPos.set(String(item.id), p);
      return p;
    }

    function buildIconPayload(item, imageId) {
      const p = evaluateIconPos(item);
      let rgbaColor = iconBaseColor(item);
      const sampler = getModulationSampler();
      if (sampler && queryPart?.projectPoint) {
        const s = queryPart.projectPoint(p);
        if (s) rgbaColor = sampler.modulateRgba(rgbaColor, s.x, s.y, false);
      }
      return {
        id: String(item.id),
        image_id: imageId,
        x: p.x,
        y: p.y,
        z: p.z,
        width: Number(item.size?.[0] ?? 24),
        height: Number(item.size?.[1] ?? 24),
        scale: Number(item.scale ?? 1),
        color: rgbaColor,
        rotation: Number(item.rotation ?? 0),
        pixel_offset: item.pixelOffset
          ? [item.pixelOffset.x, item.pixelOffset.y]
          : null,
        anchor: item.anchor ?? 'center',
        show: item.show !== false,
        pickable: record.pickable && item.pickable !== false,
        disable_depth_test: packDisableDepthTest(item.disableDepthTest),
        scale_by_distance: item.scaleByDistance
          ? [
              item.scaleByDistance.near,
              item.scaleByDistance.nearValue,
              item.scaleByDistance.far,
              item.scaleByDistance.farValue,
            ]
          : null,
        pixel_offset_scale_by_distance:
          item.offsetScalesByDistance && item.scaleByDistance
            ? [
                item.scaleByDistance.near,
                item.scaleByDistance.nearValue,
                item.scaleByDistance.far,
                item.scaleByDistance.farValue,
              ]
            : null,
        fade_by_distance: item.fadeByDistance
          ? [
              item.fadeByDistance.near,
              item.fadeByDistance.nearValue,
              item.fadeByDistance.far,
              item.fadeByDistance.farValue,
            ]
          : null,
        display_range: packDisplayRange(item.displayRange),
        aligned_axis:
          item.rotationMode === 'axis' && item.alignedAxis
            ? [item.alignedAxis.x, item.alignedAxis.y, item.alignedAxis.z]
            : null,
      };
    }

    function pushClusterIcons(clusters) {
      // Remove previous cluster billboards.
      for (const cid of record.clusterIds) {
        engine.remove_icon(id, cid);
      }
      record.clusterIds.clear();
      record.clusterHits.clear();
      if (!clusters.length) return;
      const clusterItems = [];
      for (let i = 0; i < clusters.length; i++) {
        const cl = clusters[i];
        const cid = `__cluster:${i}`;
        record.clusterIds.add(cid);
        record.clusterHits.set(cid, cl);
        let iconRef = null;
        try {
          iconRef = record.spec.cluster?.icon?.(cl.ids.length);
        } catch (err) {
          report(err);
        }
        const seedItem = record.items.get(cl.ids[0]);
        clusterItems.push({
          id: cid,
          pos: cl.position,
          image: iconRef ?? seedItem?.image,
          size: seedItem?.size ?? [24, 24],
          scale: 1,
          show: true,
          pickable: record.pickable,
          disableDepthTest: seedItem?.disableDepthTest,
        });
      }
      pushIconItems(clusterItems, true);
    }

    function pushIconItems(itemList, isCluster = false) {
      const cachedBatch = [];
      const pendingByKey = new Map();

      for (const item of itemList) {
        const itemKey = String(item.id);
        const info = resolveImageRef(item.image, atlases);
        if (info.waitingAtlas) {
          let waiters = atlasWaiters.get(info.waitingAtlas);
          if (!waiters) {
            waiters = new Set();
            atlasWaiters.set(info.waitingAtlas, waiters);
          }
          waiters.add(() => {
            if (!destroyed && !record.disposed && record.items.get(itemKey) === item)
              pushIconItems([item]);
          });
          continue;
        }

        const imgKey = info.key;
        const decoded = decodedImageCache.get(imgKey);
        if (decoded) {
          const payload = buildIconPayload(item, imgKey);
          if (!record.uploadedImages.has(imgKey)) {
            record.uploadedImages.add(imgKey);
            engine.upsert_icon_rgba(
              id,
              JSON.stringify(payload),
              decoded.width,
              decoded.height,
              decoded.rgba,
            );
          } else {
            cachedBatch.push(payload);
          }
        } else {
          let group = pendingByKey.get(imgKey);
          if (!group) {
            group = { resolved: info.resolved, sizeHint: item.size, items: [] };
            pendingByKey.set(imgKey, group);
          }
          group.items.push(item);
        }
      }

      if (cachedBatch.length > 0) {
        engine.upsert_icons_cached(id, JSON.stringify(cachedBatch));
      }

      for (const [imgKey, group] of pendingByKey) {
        pendingImageDecodes += 1;
        decodeImageRef(
          group.resolved,
          imgKey,
          imageCache,
          decodedImageCache,
          group.sizeHint,
        )
          .then((img) => {
            if (destroyed || record.disposed) return;
            const batch = [];
            for (const item of group.items) {
              const key = String(item.id);
              const currentItem = isCluster ? item : record.items.get(key);
              if (!currentItem) continue;
              if (isCluster && !record.clusterIds.has(key)) continue;
              const payload = buildIconPayload(currentItem, imgKey);
              if (!record.uploadedImages.has(imgKey)) {
                record.uploadedImages.add(imgKey);
                engine.upsert_icon_rgba(
                  id,
                  JSON.stringify(payload),
                  img.width,
                  img.height,
                  img.rgba,
                );
              } else {
                batch.push(payload);
              }
            }
            if (batch.length > 0) {
              engine.upsert_icons_cached(id, JSON.stringify(batch));
            }
            requestRender('draw.icon');
          })
          .catch((error) => {
            report(error);
          })
          .finally(() => {
            pendingImageDecodes = Math.max(0, pendingImageDecodes - 1);
          });
      }
    }

    function syncAll() {
      if (destroyed || record.disposed) return;
      if (kind === 'points') syncPoints();
      else if (kind === 'lines') syncLines();
      else if (kind === 'shapes') syncShapes();
      else if (kind === 'icons') {
        record.currentPos.clear();
        record.clusterHits.clear();
        record.clusterIds.clear();
        record.hasMotion = false;
        for (const it of record.items.values()) {
          if (it.motion) {
            record.hasMotion = true;
            break;
          }
        }
        engine.clear_icon_set(id);
        pushIconItems(record.items.values());
      }
      requestRender(`draw.${kind}`);
    }

    record.stepPreRender = () => {
      if (destroyed || record.disposed || !record.show) return;
      const sampler = getModulationSampler();
      if (kind === 'lines') {
        if (record.hasTimeLines && record.lastLineSceneTime !== sceneTime) {
          syncLines();
        }
        return;
      }
      if (kind === 'points') {
        if (!sampler && !record.modulated) return;
        const patches = [];
        for (const [key, item] of record.items) {
          const base = toRgba(item.color);
          let col = base;
          if (sampler && queryPart?.projectPoint) {
            const s = queryPart.projectPoint(item.pos);
            if (s) col = sampler.modulateRgba(base, s.x, s.y, false);
          }
          patches.push({ id: key, color: col });
        }
        record.modulated = Boolean(sampler);
        if (patches.length) engine.patch_points(id, JSON.stringify(patches));
        return;
      }
      if (kind === 'icons') {
        const canMotion = capabilities.has('motionSegments');
        const canCluster = capabilities.has('cluster') && Boolean(record.spec.cluster);
        const needsMotion = canMotion && record.hasMotion;
        const needsMod = Boolean(sampler) || record.modulated;
        if (!needsMotion && !canCluster && !needsMod) return;

        const patches = [];
        const clockMs = motionClockTimeMs(record.spec, sceneTime, wallTimeMs());
        if (needsMotion) {
          for (const [key, item] of record.items) {
            const p = resolveIconPosition(item, clockMs, true, sampleGroundHeightAt);
            record.currentPos.set(key, p);
          }
        }

        let singleIds = null;
        if (canCluster && queryPart?.projectPoint) {
          const res = computeIconClusters(record, {
            projectPoint: queryPart.projectPoint,
            isOccluded: query.isOccluded,
            viewport,
            cameraPose: camera.port.pose(),
          });
          singleIds = res.singleIds;
          pushClusterIcons(res.clusters);
        }

        for (const [key, item] of record.items) {
          const patch = { id: key };
          let dirty = false;
          const pos = record.currentPos.get(key) ?? positionToEcefSafe(item.pos);
          if (needsMotion) {
            patch.pos = [pos.x, pos.y, pos.z];
            dirty = true;
          }
          if (singleIds) {
            patch.show = item.show !== false && singleIds.has(key);
            dirty = true;
          }
          if (needsMod) {
            const base = iconBaseColor(item);
            let col = base;
            if (sampler && queryPart?.projectPoint) {
              const s = queryPart.projectPoint(pos);
              if (s) col = sampler.modulateRgba(base, s.x, s.y, false);
            }
            patch.color = col;
            dirty = true;
          }
          if (dirty) patches.push(patch);
        }
        record.modulated = Boolean(sampler);
        if (patches.length) engine.patch_icons(id, JSON.stringify(patches));
      }
    };

    const setHandle = {
      id,
      set(items) {
        if (destroyed || record.disposed) return;
        record.items.clear();
        for (const item of items ?? [])
          record.items.set(String(item.id), item);
        syncAll();
      },
      upsert(items) {
        if (destroyed || record.disposed) return;
        const list = items ?? [];
        for (const item of list) {
          record.items.set(String(item.id), item);
          if (item.motion) record.hasMotion = true;
        }
        if (kind === 'icons') {
          pushIconItems(list);
          requestRender('draw.icons.upsert');
        } else {
          syncAll();
        }
      },
      remove(ids) {
        if (destroyed || record.disposed) return;
        for (const key of ids ?? []) {
          const k = String(key);
          record.items.delete(k);
          record.currentPos.delete(k);
          if (kind === 'icons') engine.remove_icon(id, k);
        }
        if (kind !== 'icons') syncAll();
        else requestRender('draw.icons.remove');
      },
      clear() {
        if (destroyed || record.disposed) return;
        record.items.clear();
        record.currentPos.clear();
        record.clusterHits.clear();
        record.clusterIds.clear();
        if (kind === 'icons') engine.clear_icon_set(id);
        syncAll();
      },
      setOptions(next) {
        if (destroyed || record.disposed || !next) return;
        Object.assign(record.spec, next);
        if ('show' in next) {
          record.show = Boolean(next.show);
          engine.set_draw_set_show(id, record.show);
          if (kind === 'shapes')
            engine.set_draw_set_show(`${id}::outlines`, record.show);
        }
        if ('drawOrder' in next) {
          record.drawOrder = Number.isFinite(next.drawOrder) ? next.drawOrder : 0;
          engine.set_draw_set_order(id, record.drawOrder);
          if (kind === 'shapes')
            engine.set_draw_set_order(`${id}::outlines`, record.drawOrder);
        }
        if ('pickable' in next) {
          record.pickable = next.pickable !== false;
          engine.set_draw_set_pickable(id, record.pickable);
          if (kind === 'shapes')
            engine.set_draw_set_pickable(`${id}::outlines`, record.pickable);
          syncAll();
        }
        if ('blend' in next) {
          engine.set_draw_set_blend(id, next.blend ? String(next.blend) : '');
        }
        if ('includeInHeightQueries' in next) {
          engine.set_draw_set_height_query(
            id,
            Boolean(next.includeInHeightQueries),
          );
        }
        requestRender('draw.setOptions');
      },
      size: () => (record.disposed ? 0 : record.items.size),
      get show() {
        return record.show;
      },
      set show(v) {
        if (destroyed || record.disposed) return;
        record.show = Boolean(v);
        engine.set_draw_set_show(id, record.show);
        if (kind === 'shapes')
          engine.set_draw_set_show(`${id}::outlines`, record.show);
        requestRender('draw.show');
      },
      on(event, cb) {
        if (destroyed || record.disposed) return () => {};
        const list = record.listeners[event];
        if (!list) return () => {};
        return subscribe(list, cb);
      },
      dispose() {
        if (record.disposed) return;
        record.disposed = true;
        record.items.clear();
        record.currentPos.clear();
        record.clusterHits.clear();
        record.clusterIds.clear();
        sets.delete(id);
        if (!destroyed) {
          engine.dispose_draw_set(id);
          if (kind === 'shapes') engine.dispose_draw_set(`${id}::outlines`);
        }
        requestRender('draw.dispose');
      },
    };

    if (capabilities.has('columns')) {
      setHandle.setColumns = (columns) => {
        if (destroyed || record.disposed) return;
        const touched = applyColumnsToRecord(record, columns);
        if (!touched.length) return;
        if (kind === 'icons') {
          const patches = [];
          const needUpsert = [];
          for (const item of touched) {
            const p = evaluateIconPos(item);
            if (columns.positions || columns.shown || columns.scales || columns.alphas || columns.colors || columns.courses) {
              patches.push({
                id: String(item.id),
                pos: [p.x, p.y, p.z],
                rotation: Number(item.rotation ?? 0),
                scale: Number(item.scale ?? 1),
                color: iconBaseColor(item),
                show: item.show !== false,
              });
            }
            if (!record.items.has(String(item.id))) needUpsert.push(item);
          }
          if (patches.length) engine.patch_icons(id, JSON.stringify(patches));
          if (needUpsert.length) pushIconItems(needUpsert);
          requestRender('draw.columns');
        } else {
          syncAll();
        }
      };
    }

    return setHandle;
  }

  function decodeAnyImage(ref, sizeHint) {
    const info = resolveImageRef(ref, atlases);
    pendingImageDecodes += 1;
    return decodeImageRef(
      info.resolved,
      info.key ?? '__fallback_white__',
      imageCache,
      decodedImageCache,
      sizeHint,
    ).finally(() => {
      pendingImageDecodes = Math.max(0, pendingImageDecodes - 1);
    });
  }

  const draw = {
    icons: (spec) => makeDrawSet('icons', spec),
    points: (spec) => makeDrawSet('points', spec),
    lines: (spec) => makeDrawSet('lines', spec),
    shapes: (spec) => makeDrawSet('shapes', spec),
    ...(capabilities.has('models')
      ? {
          models: (spec) => {
            if (!spec?.id || typeof spec.id !== 'string')
              throw new TypeError('SetSpec.id must be a non-empty string');
            if (destroyed) return makeDeadSet(spec.id);
            if (sets.has(spec.id))
              throw new Error(`Draw set "${spec.id}" already exists`);
            return createCesiumRsModelSet(engine, spec, {
              capabilities,
              camera,
              viewport,
              sets,
              projectPoint: queryPart.projectPoint,
              requestRender,
              report,
              subscribe,
              deliver,
              isDestroyed: () => destroyed,
              getModulationSampler,
              nowMs,
            });
          },
        }
      : {}),
    ...(capabilities.has('fields')
      ? {
          field: (spec) =>
            createCesiumRsField(engine, spec, {
              decodeImage: decodeAnyImage,
              requestRender,
              report,
              subscribe,
              deliver,
              isDestroyed: () => destroyed,
              registerField(ctrl) {
                fields.add(ctrl);
                return () => fields.delete(ctrl);
              },
            }),
        }
      : {}),
    atlas(id, images) {
      if (destroyed) return;
      atlases.set(id, { ...images });
      const waiters = atlasWaiters.get(id);
      if (waiters) {
        atlasWaiters.delete(id);
        for (const fn of waiters) fn();
      }
    },
    clampState: () => 'overlay',
    on(event, cb) {
      if (event !== 'clampState') return () => {};
      return subscribe(clampStateListeners, cb);
    },
  };

  function withUnmodulatedPick(fn) {
    const sampler = getModulationSampler();
    if (!sampler || destroyed) return fn();
    const restoredIcons = [];
    const restoredPoints = [];
    for (const record of sets.values()) {
      if (record.disposed || !record.show || !record.modulated) continue;
      if (record.kind === 'icons') {
        const base = [];
        const mod = [];
        for (const [key, item] of record.items) {
          const baseCol = toRgba(item.color).slice();
          if (typeof item.alpha === 'number') baseCol[3] *= item.alpha;
          if (typeof item.focus === 'number') baseCol[3] *= item.focus;
          const pos = record.currentPos.get(key) ?? positionToEcefSafe(item.pos);
          const s = queryPart?.projectPoint?.(pos);
          const modCol = s ? sampler.modulateRgba(baseCol, s.x, s.y, false) : baseCol;
          base.push({ id: key, color: baseCol });
          mod.push({ id: key, color: modCol });
        }
        if (base.length) {
          engine.patch_icons(record.id, JSON.stringify(base));
          restoredIcons.push([record.id, mod]);
        }
      } else if (record.kind === 'points') {
        const base = [];
        const mod = [];
        for (const [key, item] of record.items) {
          const baseCol = toRgba(item.color);
          const s = queryPart?.projectPoint?.(item.pos);
          const modCol = s ? sampler.modulateRgba(baseCol, s.x, s.y, false) : baseCol;
          base.push({ id: key, color: baseCol });
          mod.push({ id: key, color: modCol });
        }
        if (base.length) {
          engine.patch_points(record.id, JSON.stringify(base));
          restoredPoints.push([record.id, mod]);
        }
      }
    }
    try {
      return fn();
    } finally {
      for (const [setId, mod] of restoredIcons) {
        engine.patch_icons(setId, JSON.stringify(mod));
      }
      for (const [setId, mod] of restoredPoints) {
        engine.patch_points(setId, JSON.stringify(mod));
      }
    }
  }

  // ── Query Port (Phase 2/3 modular port) ───────────────────────────────────
  const queryPart = createCesiumRsQuery(engine, {
    capabilities,
    camera,
    viewport,
    sets,
    syncCameraToWasm,
    withUnmodulatedPick,
    isDestroyed: () => destroyed,
    report,
  });
  const query = queryPart.port;
  const pickRayAt = queryPart.pickRayAt;

  // ── Input Port & Interactive Globe Camera Controls ────────────────────────
  const router = createInputRouter({
    report,
    suspendCamera: (reason) => camera.port.controls.suspend(reason),
    supported: { select: false, dblclickFollow: false },
  });

  function enrichClickEvent(ev) {
    let picked;
    let drilled;
    let grounded;
    ev.pick = () => {
      if (picked === undefined) picked = query.pick(ev.position.x, ev.position.y);
      return picked;
    };
    ev.drill = (opts) => {
      if (drilled === undefined)
        drilled = query.drillPick(ev.position.x, ev.position.y, opts);
      return opts?.limit !== undefined ? drilled.slice(0, opts.limit) : drilled;
    };
    ev.ground = () => {
      if (grounded === undefined)
        grounded = query.pickEllipsoid(ev.position.x, ev.position.y);
      return grounded;
    };
    return ev;
  }

  // Rust ScreenSpaceCameraController integration for exact globe navigation & inertia.
  const WGS84_MAX_RADIUS = 6378137;
  const MIN_GLOBE_SHARE = 0.3;
  let lastCtrlOptsKey = '';
  let lastPointerXY = null;
  let cameraControllerActive = false;

  function zoomOutLimit(fovy) {
    const angular = Math.atan(MIN_GLOBE_SHARE * Math.tan(fovy / 2));
    return WGS84_MAX_RADIUS / Math.sin(angular) - WGS84_MAX_RADIUS;
  }

  function coastToInertia(seconds) {
    return seconds > 0 ? 1 - 1 / (25 * seconds) : 1;
  }

  function modifierName(mods, allowMetaAsCtrl = false) {
    if (!mods) return '';
    if (mods.shift) return 'shift';
    if (mods.ctrl || (allowMetaAsCtrl && mods.meta)) return 'ctrl';
    if (mods.alt) return 'alt';
    return '';
  }

  function syncCameraControllerOptions(pose) {
    const ctrl = camera.port.controls;
    let maxDist = ctrl.maxDistance;
    if (ctrl.keepEarthFramed && Number.isFinite(pose.fovy) && pose.fovy > 0) {
      const limit = Math.max(zoomOutLimit(pose.fovy), pose.height ?? 0);
      maxDist = Math.min(maxDist, limit);
    }
    const maxTilt =
      Array.isArray(ctrl.pitchRange) && ctrl.pitchRange[1] < 0
        ? ctrl.pitchRange[1] + Math.PI / 2
        : null;
    const opts = {
      enable_inputs: Boolean(ctrl.enabled),
      enable_rotate: Boolean(ctrl.enableRotate),
      enable_tilt: Boolean(ctrl.enableTilt),
      enable_zoom: Boolean(ctrl.enableZoom),
      enable_look: true,
      minimum_zoom_distance: Number.isFinite(ctrl.minDistance) ? ctrl.minDistance : 1,
      maximum_zoom_distance: Number.isFinite(maxDist) ? maxDist : 1e30,
      zoom_factor: Number.isFinite(ctrl.zoomFactor) ? ctrl.zoomFactor : 5,
      inertia_spin: coastToInertia(ctrl.coast?.drag ?? 0.4),
      inertia_translate: coastToInertia(ctrl.coast?.drag ?? 0.4),
      inertia_zoom: coastToInertia(ctrl.coast?.zoom ?? 0.2),
      enable_collision_detection: ctrl.collision !== 'none',
      maximum_tilt_angle: maxTilt,
      zoom_inputs: Array.isArray(ctrl.zoomInputs)
        ? ctrl.zoomInputs
        : ['wheel', 'pinch', 'rightDrag'],
    };
    const key = JSON.stringify(opts);
    if (key !== lastCtrlOptsKey) {
      lastCtrlOptsKey = key;
      engine.set_camera_controller_options(key);
    }
  }

  const wallOrigin = new Date(wallTimeMs()).getTime();
  const controllerTimeMs = (ms = nowMs()) => {
    const wall =
      typeof externalClock?.date === 'function'
        ? wallOrigin + ms
        : Date.now();
    return new Date(wall).getTime() - wallOrigin + 1e-6;
  };

  function forwardPointerToController(type, x, y, extra = {}) {
    if (destroyed) return;
    if (!router.port.isPointerFree()) return;
    const isDom = Boolean(extra._dom);
    const button = extra.button ?? 0;
    const mod = modifierName(extra.modifiers, isDom && type !== 'wheel');
    const t = controllerTimeMs(extra.timestamp ?? nowMs());
    let kind = '';
    let ex = x;
    let ey = y;
    let wheelDelta = 0;
    if (type === 'down') {
      kind = button === 1 ? 'middle_down' : button === 2 ? 'right_down' : 'left_down';
    } else if (type === 'up') {
      kind = button === 1 ? 'middle_up' : button === 2 ? 'right_up' : 'left_up';
    } else if (type === 'move') {
      kind = 'move';
      ex = extra.endPosition?.x ?? x;
      ey = extra.endPosition?.y ?? y;
    } else if (type === 'wheel') {
      kind = 'wheel';
      wheelDelta = -(Number(extra.delta) || 0) * WHEEL_PX_PER_LINE;
    } else {
      return;
    }
    engine.camera_input_event(kind, mod, x, y, ex, ey, wheelDelta, t);
    cameraControllerActive = true;
    requestRender('camera.input');
  }

  function stepCameraInput(now) {
    if (destroyed || !cameraControllerActive) return;
    const pose = camera.port.pose();
    syncCameraControllerOptions(pose);
    const frameMatrix = camera.eyeFrame();
    const res = engine.step_camera_controller(
      controllerTimeMs(now),
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.direction.x,
      pose.direction.y,
      pose.direction.z,
      pose.up.x,
      pose.up.y,
      pose.up.z,
      pose.right.x,
      pose.right.y,
      pose.right.z,
      pose.fovy,
      pose.near,
      pose.far,
      frameMatrix,
    );
    if (res && res.length >= 13 && res[0] > 0.5) {
      camera.applyWorldPose({
        position: { x: res[1], y: res[2], z: res[3] },
        direction: { x: res[4], y: res[5], z: res[6] },
        up: { x: res[7], y: res[8], z: res[9] },
        right: { x: res[10], y: res[11], z: res[12] },
      });
      requestRender('camera.input');
    } else if (!downInfo.size) {
      // Keep polling briefly while button might still be held synthetically,
      // otherwise let demand rendering settle once inertia finishes.
    }
  }

  const downInfo = new Map();

  function dispatchPointer(type, x, y, extra = {}) {
    if (destroyed) return;
    const ev = {
      type,
      position: { x, y },
      ...(extra.endPosition ? { endPosition: extra.endPosition } : {}),
      button: extra.button ?? 0,
      modifiers: extra.modifiers ? { ...NO_MODIFIERS, ...extra.modifiers } : { ...NO_MODIFIERS },
      timestamp: extra.timestamp ?? nowMs(),
      pointerType: extra.pointerType ?? 'mouse',
      ...(extra.gesture ? { gesture: extra.gesture } : {}),
      ...(extra.delta !== undefined ? { delta: extra.delta } : {}),
    };
    if (type === 'click' || type === 'dblclick') enrichClickEvent(ev);
    router.dispatch(ev);
    if (type === 'down' || type === 'move' || type === 'up' || type === 'wheel') {
      forwardPointerToController(type, x, y, extra);
    }
  }

  const canvasXY = (dom) => {
    const rect = canvas.getBoundingClientRect();
    return { x: dom.clientX - rect.left, y: dom.clientY - rect.top };
  };
  const modsOf = (dom) => ({
    shift: Boolean(dom.shiftKey),
    ctrl: Boolean(dom.ctrlKey),
    alt: Boolean(dom.altKey),
    meta: Boolean(dom.metaKey),
  });

  const onPointerDown = (dom) => {
    const pt = canvasXY(dom);
    const mods = modsOf(dom);
    const button = dom.button === 1 ? 1 : dom.button === 2 ? 2 : 0;
    downInfo.set(dom.pointerId, { x: pt.x, y: pt.y, t: nowMs(), button });
    lastPointerXY = pt;
    dispatchPointer('down', pt.x, pt.y, {
      button,
      modifiers: mods,
      pointerType: dom.pointerType || 'mouse',
      _dom: true,
    });
  };
  const onPointerMove = (dom) => {
    const pt = canvasXY(dom);
    const mods = modsOf(dom);
    const prev = lastPointerXY ?? pt;
    const start = downInfo.get(dom.pointerId);
    lastPointerXY = pt;
    dispatchPointer('move', prev.x, prev.y, {
      endPosition: pt,
      button: start ? start.button : 0,
      modifiers: mods,
      pointerType: dom.pointerType || 'mouse',
      _dom: true,
    });
  };
  const onPointerUp = (dom) => {
    const pt = canvasXY(dom);
    const mods = modsOf(dom);
    const start = downInfo.get(dom.pointerId);
    downInfo.delete(dom.pointerId);
    const button = start?.button ?? (dom.button === 1 ? 1 : dom.button === 2 ? 2 : 0);
    dispatchPointer('up', pt.x, pt.y, {
      button,
      modifiers: mods,
      pointerType: dom.pointerType || 'mouse',
      _dom: true,
    });
    if (start) {
      const travelPx = Math.hypot(pt.x - start.x, pt.y - start.y);
      if (travelPx <= 6) {
        dispatchPointer('click', pt.x, pt.y, {
          button,
          modifiers: mods,
          pointerType: dom.pointerType || 'mouse',
          gesture: { travelPx, durationMs: Math.max(0, nowMs() - start.t) },
        });
      }
    }
  };
  const onDblClick = (dom) => {
    const pt = canvasXY(dom);
    dispatchPointer('dblclick', pt.x, pt.y, {
      button: 0,
      modifiers: modsOf(dom),
    });
  };
  const onWheel = (dom) => {
    const pt = canvasXY(dom);
    const mods = modsOf(dom);
    const delta = wheelLines(dom);
    if (router.port.isPointerFree() && camera.port.controls.enabled) {
      dom.preventDefault();
    }
    dispatchPointer('wheel', pt.x, pt.y, { delta, modifiers: mods, _dom: true });
  };
  const onContextMenu = (dom) => dom.preventDefault();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  // ── Effects Port (Phase 3 modular port) ───────────────────────────────────
  const effectsFrameProxy = {
    on(phase, cb) {
      const list = phaseListeners[phase];
      if (!list) return () => {};
      return subscribe(list, cb);
    },
    holdContinuous(reason) {
      return frame.holdContinuous(reason);
    },
  };
  const effectsPart = createCesiumRsEffects(engine, {
    capabilities,
    frame: effectsFrameProxy,
    requestRender,
    report,
    subscribe,
    deliver,
    isDestroyed: () => destroyed,
    onModulationChange() {
      modulationDirty = true;
    },
  });
  getModulationSampler = effectsPart.getModulationSampler;
  const effects = effectsPart.port;

  // ── Quality Port ──────────────────────────────────────────────────────────
  function readDeviceFacts() {
    let gpuVendor;
    let gpuRenderer;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        gpuVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || undefined;
        gpuRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || undefined;
      }
    } catch {
      // Optional debug info.
    }
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
    const maxSamples = Number(gl.getParameter(gl.MAX_SAMPLES)) || 0;
    const msaaSamples = [0, 2, 4, 8].filter((s) => s <= maxSamples);
    return {
      backend: 'webgl2',
      ...(gpuVendor ? { gpuVendor } : {}),
      ...(gpuRenderer ? { gpuRenderer } : {}),
      maxTextureSize,
      msaaSamples: msaaSamples.length ? msaaSamples : [0],
      gpuTimer: false,
    };
  }

  const deviceFacts = readDeviceFacts();

  const quality = {
    knobs: () => KNOBS.map((k) => ({ ...k })),
    get: () => ({ ...qualitySettings }),
    set(settings) {
      const ignored = [];
      for (const [k, v] of Object.entries(settings ?? {})) {
        if (k === 'pixelRatio' && typeof v === 'number') {
          qualitySettings.pixelRatio = Math.max(0, Math.min(4, v));
          const { w, h, dpr } = applyCanvasSize();
          if (!destroyed) engine.resize(w, h, dpr);
          requestRender('quality.pixelRatio');
        } else if (k === 'targetFps' && typeof v === 'number') {
          qualitySettings.targetFps = Math.max(0, v);
          targetFps = qualitySettings.targetFps;
        } else {
          ignored.push(k);
        }
      }
      return ignored;
    },
    device: () => ({ ...deviceFacts }),
    probe: () => ({
      device: { ...deviceFacts },
      browser: {
        devicePixelRatio: globalThis.devicePixelRatio || 1,
        screen: {
          width: globalThis.screen?.width || viewport.width,
          height: globalThis.screen?.height || viewport.height,
        },
        ...(typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? { hardwareConcurrency: navigator.hardwareConcurrency }
          : {}),
        ...(typeof navigator !== 'undefined' && navigator.deviceMemory
          ? { deviceMemory: navigator.deviceMemory }
          : {}),
        touchOnly: Boolean(
          globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')
            ?.matches,
        ),
      },
      knobs: KNOBS.map((k) => ({ ...k })),
    }),
    signals: {
      gpuTiming: 'none',
      on(event, cb) {
        if (event !== 'frame') return () => {};
        return subscribe(signalListeners, cb);
      },
    },
  };

  // ── Frame Tick Execution (exact 9-step order) ─────────────────────────────
  function tick() {
    if (destroyed || suspended) return false;
    const now = nowMs();
    const dt = Math.max(0, (now - lastTickNow) / 1000) || FRAME_MS / 1000;
    lastTickNow = now;
    frameCount += 1;

    // 1. flight
    camera.steps.stepFlight();
    // 2. input (Rust ScreenSpaceCameraController)
    stepCameraInput(now);
    // 3. changed
    camera.steps.stepChanged();
    // 4. follow
    camera.steps.stepFollow();

    const rendering =
      pendingReasons.length > 0 ||
      continuous.size > 0 ||
      engine.render_requested();
    const frameTime = {
      frame: frameCount,
      time: sceneTime,
      now,
      dt,
      rendering,
    };

    // 5. preUpdate
    updating = frameTime;
    try {
      deliver(phaseListeners.preUpdate, frameTime);
    } finally {
      updating = null;
    }

    // 6. moveDetection
    camera.steps.stepMoveDetection();

    if (!frameTime.rendering) return false;

    const requested = pendingReasons.length > 0;
    pendingReasons.length = 0;

    // 7. preRender
    globePart.imagery.stepFrames(sceneTime);
    globePart.stepWeather();
    for (const record of sets.values()) {
      record.stepPreRender?.(frameTime);
    }
    for (const field of fields) {
      field.preRender?.(frameTime);
    }
    modulationDirty = false;
    deliver(phaseListeners.preRender, frameTime);

    // 8. render
    const t0 = performance.now();
    syncCameraToWasm();
    engine.initialize_frame(now / 1000);
    engine.force_render(sceneTime);
    const cpuMs = performance.now() - t0;
    rendered += 1;

    // 9. postRender
    globePart.imagery.announceFrames();
    for (const record of sets.values()) {
      record.stepPostRender?.();
    }
    for (const field of fields) {
      field.postRender?.();
    }
    deliver(phaseListeners.postRender, frameTime);

    for (const waiter of onceWaiters.splice(0)) waiter();
    globePart.emitProgress(true);
    deliver(signalListeners, {
      cpuMs,
      pixelRatio: effectiveDpr(),
      width: viewport.width,
      height: viewport.height,
      mode: 'demand',
      requested,
      holds: [...continuous.values()],
      drawCalls: sets.size,
    });
    return true;
  }

  function scheduleLoop() {
    if (manualLoop || destroyed) return;
    rafId = requestAnimationFrame((ts) => {
      rafId = 0;
      if (destroyed) return;
      let slow = false;
      if (!suspended) {
        const minInterval = targetFps > 0 ? 1000 / targetFps : 0;
        if (minInterval === 0 || ts - lastRenderWallNow >= minInterval - 0.5) {
          lastRenderWallNow = ts;
          const tStart = performance.now();
          try {
            tick();
          } catch (error) {
            report(error);
          }
          slow = performance.now() - tStart > 100;
        }
      }
      if (slow) setTimeout(scheduleLoop, 0);
      else scheduleLoop();
    });
  }

  const frame = {
    on(phase, cb) {
      const list = phaseListeners[phase];
      if (!list) return () => {};
      return subscribe(list, cb);
    },
    requestRender,
    holdContinuous(reason) {
      const key = ++holdSeq;
      continuous.set(key, String(reason));
      if (continuous.size === 1) deliver(heldListeners, true);
      deliver(holdsListeners);
      return () => {
        if (!continuous.delete(key)) return;
        if (continuous.size === 0) deliver(heldListeners, false);
        deliver(holdsListeners);
      };
    },
    onHeldChange(cb) {
      return subscribe(heldListeners, cb);
    },
    ...(capabilities.has('holdChanges')
      ? {
          onHoldsChange(cb) {
            return subscribe(holdsListeners, cb);
          },
        }
      : {}),
    mode: () => 'demand',
    diagnostics: () => ({
      mode: 'demand',
      frames: frameCount,
      rendered,
      pendingReasons: pendingReasons.slice(),
      holds: [...continuous.values()],
      suspended,
      targetFps,
    }),
    suspend(hidden) {
      suspended = Boolean(hidden);
    },
    renderNow({ ifDue = false } = {}) {
      if (destroyed) throw destroyedError();
      if (!ifDue) requestRender('renderNow');
      tick();
    },
    renderOnce({ timeoutMs } = {}) {
      if (destroyed) return Promise.reject(destroyedError());
      requestRender('renderOnce');
      return new Promise((resolve, reject) => {
        let timer = null;
        const waiter = (error) => {
          if (timer !== null) clearTimeout(timer);
          if (error) reject(error);
          else resolve();
        };
        if (typeof timeoutMs === 'number' && timeoutMs > 0) {
          timer = setTimeout(() => {
            const i = onceWaiters.indexOf(waiter);
            if (i >= 0) onceWaiters.splice(i, 1);
            reject(new Error('renderOnce timed out'));
          }, timeoutMs);
          onceTimers.add(() => clearTimeout(timer));
        }
        onceWaiters.push(waiter);
      });
    },
    setTargetFps(fps) {
      targetFps = Math.max(0, Number(fps) || 0);
    },
    setTime(ms) {
      if (!Number.isFinite(ms)) return;
      if (ms !== sceneTime) {
        sceneTime = ms;
        if (updating) updating.time = ms;
        else requestRender('frame.setTime');
      }
    },
    time: () => sceneTime,
  };

  // ── Capture & Pixel Readback ──────────────────────────────────────────────
  function readPixels(opts = {}) {
    if (destroyed) throw destroyedError();
    const dpr = effectiveDpr();
    const crop = opts.crop;
    const cssW = crop ? Math.max(1, Math.round(crop.width)) : viewport.width;
    const cssH = crop ? Math.max(1, Math.round(crop.height)) : viewport.height;
    const scaleFactor =
      typeof opts.scale === 'number' && opts.scale > 0 ? opts.scale : 1;
    const outW = Math.max(1, Math.round(cssW * scaleFactor));
    const outH = Math.max(1, Math.round(cssH * scaleFactor));
    const x = crop ? Math.max(0, Math.round(crop.x * dpr)) : 0;
    const yCss = crop ? Math.max(0, Math.round(crop.y * dpr)) : 0;
    const srcW = crop
      ? Math.max(1, Math.min(canvas.width - x, Math.round(crop.width * dpr)))
      : canvas.width;
    const srcH = crop
      ? Math.max(1, Math.min(canvas.height - yCss, Math.round(crop.height * dpr)))
      : canvas.height;
    const glY = Math.max(0, canvas.height - yCss - srcH);
    const bytes = engine.read_pixels(x, glY, srcW, srcH);
    const raw = new ImageData(new Uint8ClampedArray(bytes), srcW, srcH);
    if (srcW === outW && srcH === outH) return raw;
    const srcCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(srcW, srcH)
        : Object.assign(doc.createElement('canvas'), { width: srcW, height: srcH });
    srcCanvas.getContext('2d').putImageData(raw, 0, 0);
    const dstCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(outW, outH)
        : Object.assign(doc.createElement('canvas'), { width: outW, height: outH });
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.drawImage(srcCanvas, 0, 0, srcW, srcH, 0, 0, outW, outH);
    return dstCtx.getImageData(0, 0, outW, outH);
  }

  async function capture(opts = {}) {
    if (destroyed) throw destroyedError();
    const mime = opts.type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const qualityArg = typeof opts.quality === 'number' ? opts.quality : undefined;
    if (!opts.crop && (!opts.scale || opts.scale === 1)) {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('canvas capture failed')),
          mime,
          qualityArg,
        );
      });
    }
    const dpr = effectiveDpr();
    const sx = opts.crop ? Math.round(opts.crop.x * dpr) : 0;
    const sy = opts.crop ? Math.round(opts.crop.y * dpr) : 0;
    const sw = opts.crop ? Math.round(opts.crop.width * dpr) : canvas.width;
    const sh = opts.crop ? Math.round(opts.crop.height * dpr) : canvas.height;
    const s = opts.scale ?? 1;
    const outW = Math.max(1, Math.round((opts.crop ? opts.crop.width : viewport.width) * s));
    const outH = Math.max(1, Math.round((opts.crop ? opts.crop.height : viewport.height) * s));
    const outCanvas = doc.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    outCanvas.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
    return new Promise((resolve, reject) => {
      outCanvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('canvas capture failed')),
        mime,
        qualityArg,
      );
    });
  }

  async function whenSettled({ timeoutMs = 10_000 } = {}) {
    if (destroyed) return { state: 'failed', blockers: ['destroyed'] };
    const deadline = Date.now() + timeoutMs;
    const modelsInFlight = () => {
      for (const rec of sets.values()) {
        if (rec.inFlightLoads > 0) return true;
      }
      return false;
    };
    const fieldsSettled = () => {
      for (const f of fields) {
        if (!f.isSettled()) return false;
      }
      return true;
    };
    while (Date.now() < deadline) {
      if (destroyed) return { state: 'failed', blockers: ['destroyed'] };
      const baseReady = globe.isSettled('base');
      const iconsReady = engine.icons_ready();
      const modelsReady = !modelsInFlight() && engine.models_ready();
      const fieldsReady = fieldsSettled();
      if (
        pendingReasons.length > 0 ||
        !baseReady ||
        !iconsReady ||
        !modelsReady ||
        !fieldsReady
      ) {
        if (pendingReasons.length === 0) requestRender('settle');
        tick();
      }
      if (
        pendingImageDecodes === 0 &&
        globe.isSettled('base') &&
        engine.icons_ready() &&
        !modelsInFlight() &&
        engine.models_ready() &&
        fieldsSettled()
      ) {
        return { state: 'settled', blockers: [] };
      }
      const delay =
        pendingImageDecodes === 0 &&
        globePart.imagery.pending() === 0 &&
        !modelsInFlight()
          ? 0
          : 16;
      await new Promise((r) => setTimeout(r, delay));
    }
    const blockers = [];
    if (pendingImageDecodes > 0 || !engine.icons_ready()) blockers.push('icons');
    if (modelsInFlight() || !engine.models_ready()) blockers.push('models');
    if (!fieldsSettled()) blockers.push('fields');
    if (!globe.isSettled('imagery')) blockers.push('imagery');
    if (!globe.isSettled('tiles')) blockers.push('tiles');
    if (!globe.isSettled('terrain')) blockers.push('terrain');
    return { state: blockers.length ? 'timeout' : 'settled', blockers };
  }

  // ── Renderer Object ───────────────────────────────────────────────────────
  const renderer = Object.freeze({
    id: 'cesiumrs',
    contractVersion: CONTRACT_VERSION,
    capabilities,
    canvas,
    frame,
    globe,
    draw,
    camera: camera.port,
    query,
    input: router.port,
    effects,
    credits,
    quality,
    capture,
    readPixels,
    whenSettled,
    resize() {
      if (destroyed) return;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        viewport.width = container.clientWidth;
        viewport.height = container.clientHeight;
      }
      const { w, h, dpr } = applyCanvasSize();
      engine.resize(w, h, dpr);
      requestRender('resize');
    },
    releaseUnused() {
      imageCache.clear();
      decodedImageCache.clear();
    },
    on(event, cb) {
      const list = rendererListeners[event];
      if (!list) return () => {};
      return subscribe(list, cb);
    },
    destroy() {
      if (destroyed) return;
      camera.endFlight();
      destroyed = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      for (const clear of onceTimers) clear();
      onceTimers.clear();
      for (const waiter of onceWaiters.splice(0)) waiter(destroyedError());
      effectsPart.dispose();
      for (const f of [...fields]) f.dispose();
      fields.clear();
      globePart.dispose();
      sets.clear();
      imageCache.clear();
      decodedImageCache.clear();
      engine.destroy();
      engine.free?.();
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Optional context release.
      }
      canvas.remove();
      try {
        onDestroy?.();
      } catch (error) {
        report(error);
      }
    },
  });

  pointerFeeds.set(renderer, dispatchPointer);
  manualTickers.set(renderer, tick);
  pendingDecodeQueries.set(renderer, () => {
    if (pendingImageDecodes > 0) return true;
    for (const rec of sets.values()) {
      if (rec.inFlightLoads > 0) return true;
    }
    return false;
  });
  scriptedHeightSetters.set(renderer, queryPart.setScriptedHeights);

  // Draw the initial frame synchronously so canvas is immediately populated.
  tick();
  scheduleLoop();

  return renderer;
}
