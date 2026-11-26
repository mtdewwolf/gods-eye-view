/**
 * @module render/cesiumrs/imagery
 * @description Phase 2 imagery layer manager for the CesiumRS renderer:
 * `imageHooks` (`canvas`, `tileTransform`, `admit`, `fetchTile`), `vectorBase`,
 * `imageryFrames` (`frames` & `video`), `imageryDecoded`, `splitSwipe`, and
 * `imageryOnTiles` over `BrowserScene`'s `JsCallbackImageryProvider` bridge.
 */
import { paintVectorTile } from '../vectorBase/index.js';

const SPLITS = { none: 0, left: -1, right: 1 };
const DRAPES = new Set(['surface', 'objects', 'all']);

/** Delay before retrying a deferred tile (short enough for tests, avoids spinning). */
const TILE_RETRY_DELAY_MS = 60;
const VIDEO_STEP_MS = 250;
const VIDEO_STEPS_MAX = 1200;
const VIDEO_CACHE = 48;
const VIDEO_SEEK_TIMEOUT_MS = 10_000;
const VIDEO_DURATION_TIMEOUT_MS = 60_000;
const VIDEO_RETRY_MS = 180_000;
const VECTOR_TILE_PX = 256;
const VECTOR_MAX_LEVEL = 20;

const FLIPPED = {
  imageOrientation: 'flipY',
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'default',
};
const STRAIGHT = {
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'default',
};

const isBitmap = (image) =>
  typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;

class MissingTile extends Error {
  constructor() {
    super('MissingTile');
    this.name = 'MissingTile';
  }
}

/** Build a tile URL for an `xyz` spec. */
function xyzTileUrl(spec, { x, y, level }) {
  const subdomains = spec.subdomains?.length
    ? spec.subdomains
    : ['a', 'b', 'c'];
  // Both WebMercator (1x1 at L0) and default Geographic (2x1 at L0) have 2^level Y rows.
  const rows = 1 << level;
  return spec.url
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y))
    .replaceAll('{z}', String(level))
    .replaceAll('{reverseY}', String(rows - 1 - y))
    .replaceAll('{s}', subdomains[(x + y + level) % subdomains.length]);
}

function templateTileUrl(template, { x, y, level }) {
  const rows = 1 << level;
  return template
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y))
    .replaceAll('{z}', String(level))
    .replaceAll('{reverseY}', String(rows - 1 - y));
}

async function decodeBlobFlipped(blob) {
  return createImageBitmap(blob, FLIPPED);
}

/** Fetch a URL into an ImageBitmap flipped for WebGL2 upload, with optional retryStatuses. */
async function fetchImageFlipped(url, { signal, retryStatuses }) {
  const retrySet = retryStatuses?.length ? new Set(retryStatuses) : null;
  const maxAttempts = retrySet ? 4 : 1;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    signal?.throwIfAborted();
    const res = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      const blob = await res.blob();
      signal?.throwIfAborted();
      return decodeBlobFlipped(blob);
    }
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.statusCode = res.status;
    lastError = err;
    if (!retrySet || !retrySet.has(res.status) || attempt + 1 >= maxAttempts) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

/** Run `tileTransform` on an upright bitmap and return a flipped bitmap for WebGL2. */
async function applyTileTransform(spec, tile, image) {
  const upright = await createImageBitmap(
    image,
    isBitmap(image) ? FLIPPED : STRAIGHT,
  );
  if (isBitmap(image)) image.close?.();
  let result;
  try {
    result = await spec.tileTransform(tile, upright);
    if (!result) throw new MissingTile();
    if (isBitmap(result)) {
      return await createImageBitmap(result, FLIPPED);
    }
    return result;
  } finally {
    if (isBitmap(result) && result !== upright) result.close?.();
    upright.close?.();
  }
}

function minTerrainLevelOf(spec) {
  if (!spec.hiddenBelowMinLevel || !(spec.minLevel > 0)) return -1;
  const tiling =
    spec.tiling ?? (spec.kind === 'canvas' ? 'geographic' : 'webMercator');
  const shift = tiling === 'geographic' ? 0 : 1;
  return Math.max(0, spec.minLevel - shift);
}

// ── Timed frames helpers ───────────────────────────────────────────────────

function framesOf(source) {
  if (source?.kind === 'video') {
    const frames = [];
    for (const segment of source.segments ?? []) {
      const { url, start, end } = segment;
      if (typeof url !== 'string' || !(end >= start)) continue;
      const span = end - start;
      const steps = Math.min(
        VIDEO_STEPS_MAX,
        Math.max(1, Math.ceil(span / VIDEO_STEP_MS)),
      );
      for (let k = 0; k <= steps; k++) {
        frames.push({
          time: start + (span * k) / steps,
          url,
          fraction: span > 0 ? k / steps : 0,
        });
      }
    }
    return frames.sort((a, b) => a.time - b.time);
  }
  if (source?.kind === 'decoded') return [];
  if (source?.kind === 'frames') {
    return (source.frames ?? [])
      .filter((f) => Number.isFinite(f?.time) && typeof f?.url === 'string')
      .map((f) => ({ time: f.time, url: f.url }))
      .sort((a, b) => a.time - b.time);
  }
  throw new TypeError(`Unknown timed source: ${source?.kind}`);
}

function nearestIndex(frames, ms) {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time < ms) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && ms - frames[lo - 1].time <= frames[lo].time - ms) return lo - 1;
  return lo;
}

function shownAt(frames, ms, mode = 'nearest') {
  if (!frames.length || !Number.isFinite(ms)) return null;
  const nearest = nearestIndex(frames, ms);
  if (mode !== 'blend')
    return { nearest, shown: [{ index: nearest, weight: 1 }] };
  let before = nearest;
  if (frames[before].time > ms && before > 0) before -= 1;
  const after = Math.min(frames.length - 1, before + 1);
  const t0 = frames[before].time;
  const t1 = frames[after].time;
  if (after === before || ms <= t0 || t1 <= t0)
    return { nearest, shown: [{ index: before, weight: 1 }] };
  if (ms >= t1) return { nearest, shown: [{ index: after, weight: 1 }] };
  const f = (ms - t0) / (t1 - t0);
  return {
    nearest,
    shown: [
      { index: before, weight: 1 },
      { index: after, weight: f },
    ],
  };
}

function heldFrames(frames, shown, prefetch) {
  const held = new Set(shown.shown.map((s) => s.index));
  const last = Math.max(...held);
  for (let k = 1; k <= prefetch && last + k < frames.length; k++)
    held.add(last + k);
  return [...held];
}

function decodedShownAt(source, ms) {
  if (!Number.isFinite(ms)) return null;
  const slot = source.slotAt(ms);
  if (!Number.isFinite(slot)) return null;
  return { nearest: slot, shown: [{ index: slot, weight: 1 }] };
}

function decodedHeld(source, at, prefetch, ms) {
  const held = [at.nearest];
  if (prefetch <= 0 || typeof source.prefetch !== 'function') return held;
  for (const slot of source.prefetch(ms) ?? []) {
    if (held.length > prefetch) break;
    if (Number.isFinite(slot) && !held.includes(slot)) held.push(slot);
  }
  return held;
}

function seekTo(video, time, url, timeoutMs = VIDEO_SEEK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', seeked);
      video.removeEventListener('error', failed);
    };
    const failed = () => {
      stop();
      reject(new Error(`The video tile did not seek: ${url}`));
    };
    const timeout = setTimeout(failed, timeoutMs);
    const seeked = () => {
      if (video.seeking) return;
      stop();
      if (typeof video.requestVideoFrameCallback !== 'function') resolve();
      else {
        const timer = setTimeout(resolve, 100);
        video.requestVideoFrameCallback(() => {
          clearTimeout(timer);
          resolve();
        });
      }
    };
    video.addEventListener('seeked', seeked);
    video.addEventListener('error', failed);
    video.currentTime = time;
  });
}

function createTileVideos(limit = VIDEO_CACHE) {
  const videos = new Map();
  const failed = new Map();

  function fail(url) {
    const now = Date.now();
    for (const [other, retryAt] of failed)
      if (retryAt <= now) failed.delete(other);
    failed.set(url, now + VIDEO_RETRY_MS);
  }
  function release(entry, url) {
    entry.released = true;
    entry.release(new Error(`The video tile was let go: ${url}`));
    entry.video.removeAttribute('src');
    entry.video.load();
  }
  function drop(url, entry) {
    if (videos.get(url) !== entry) return;
    videos.delete(url);
    release(entry, url);
  }
  function load(url) {
    let entry = videos.get(url);
    if (entry) {
      videos.delete(url);
      videos.set(url, entry);
      return entry;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    const loaded = new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(video), {
        once: true,
      });
      video.addEventListener(
        'error',
        () => reject(new Error(`The video tile did not load: ${url}`)),
        { once: true },
      );
    });
    const ready = loaded.then(async () => {
      if (!Number.isFinite(video.duration)) {
        await seekTo(
          video,
          Number.MAX_SAFE_INTEGER,
          url,
          VIDEO_DURATION_TIMEOUT_MS,
        );
      }
      return video;
    });
    video.src = url;
    let releaseWith;
    const gone = new Promise((_, reject) => {
      releaseWith = reject;
    });
    gone.catch(() => {});
    entry = {
      video,
      ready,
      queue: Promise.resolve(),
      gone,
      release: releaseWith,
      released: false,
    };
    videos.set(url, entry);
    const loadedEntry = entry;
    ready.catch(() => {
      if (videos.get(url) !== loadedEntry) return;
      fail(url);
      drop(url, loadedEntry);
    });
    while (videos.size > limit) {
      const [oldest, old] = videos.entries().next().value;
      videos.delete(oldest);
      release(old, oldest);
    }
    return entry;
  }

  function frame(url, fraction) {
    const retryAt = failed.get(url);
    if (retryAt !== undefined) {
      if (Date.now() < retryAt)
        return Promise.reject(
          new Error(`The video tile failed to load lately: ${url}`),
        );
      failed.delete(url);
    }
    const entry = load(url);
    const until = (promise) => Promise.race([promise, entry.gone]);
    const run = until(entry.queue).then(async () => {
      if (entry.released) await entry.gone;
      const video = await until(entry.ready);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const at = Math.max(0, Math.min(duration - 1e-3, fraction * duration));
      if (video.seeking || Math.abs(video.currentTime - at) > 1e-4) {
        try {
          await until(seekTo(video, at, url));
        } catch (error) {
          if (!entry.released) fail(url);
          drop(url, entry);
          throw error;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1;
      canvas.height = video.videoHeight || 1;
      canvas.getContext('2d').drawImage(video, 0, 0);
      return canvas;
    });
    entry.queue = run.catch(() => {});
    return run;
  }

  return {
    frame,
    clear() {
      for (const [url, entry] of videos) release(entry, url);
      videos.clear();
      failed.clear();
    },
  };
}

// ── Imagery Manager ────────────────────────────────────────────────────────

/**
 * Create the CesiumRS imagery manager bound to a `BrowserScene` (`engine`).
 */
export function createCesiumRsImagery(
  engine,
  {
    capabilities,
    requestRender,
    report,
    subscribe,
    deliver,
    addCredit,
    isGlobeVisible,
    hasShownTileset,
    onPendingChange,
  },
) {
  /** Port layers in bottom-to-top order. */
  const layers = [];
  let pending = 0;
  const admitPending = new Map();
  let retryTimer = null;
  let disposed = false;
  const waiters = [];

  const retrySoon = () => {
    if (retryTimer !== null || disposed) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      for (const resolve of waiters.splice(0)) resolve();
      if (!disposed) requestRender('imagery');
    }, TILE_RETRY_DELAY_MS);
  };

  const laterFrame = () =>
    new Promise((resolve) => {
      if (disposed) {
        setTimeout(resolve, TILE_RETRY_DELAY_MS);
        return;
      }
      waiters.push(resolve);
      retrySoon();
    });

  function targetHostFor(record) {
    const tilesReady = capabilities.has('imageryOnTiles') && hasShownTileset();
    if (record.drapeOn === 'surface') return 'globe';
    if (record.drapeOn === 'objects') return tilesReady ? 'tiles' : null;
    if (!isGlobeVisible() && tilesReady) return 'tiles';
    return 'globe';
  }

  /** Build the JS callback function `(x, y, level) -> Promise<Image>|undefined|'missing'` for a spec. */
  function makeTileCallback(spec, ctx, listeners, options = {}) {
    const limit =
      spec.maxConcurrentRequests > 0 ? spec.maxConcurrentRequests : Infinity;
    let inFlight = 0;

    async function fetchViaHook(tile) {
      const url = xyzTileUrl(spec, tile);
      const controller = new AbortController();
      ctx.signals.add(controller);
      try {
        for (;;) {
          const answer = await spec.fetchTile({
            tile,
            url,
            signal: controller.signal,
          });
          controller.signal.throwIfAborted();
          if (answer?.defer) {
            inFlight -= 1;
            try {
              await ctx.laterFrame();
              while (inFlight >= limit) {
                controller.signal.throwIfAborted();
                await ctx.laterFrame();
              }
            } finally {
              inFlight += 1;
            }
            controller.signal.throwIfAborted();
            continue;
          }
          if (!answer || answer.missing) throw new MissingTile();
          const blob = new Blob(
            [answer.bytes],
            answer.contentType ? { type: answer.contentType } : undefined,
          );
          return await decodeBlobFlipped(blob);
        }
      } finally {
        ctx.signals.delete(controller);
      }
    }

    async function loadRawTile(tile) {
      const controller = new AbortController();
      ctx.signals.add(controller);
      try {
        if (options.decoded) {
          const { source, slot, urgency } = options.decoded;
          for (;;) {
            const answer = await source.tile({
              tile,
              slot,
              signal: controller.signal,
              urgency: urgency(),
            });
            if (controller.signal.aborted) answer?.image?.close?.();
            controller.signal.throwIfAborted();
            if (answer?.defer) {
              await ctx.laterFrame();
              controller.signal.throwIfAborted();
              continue;
            }
            if (!answer?.image) throw new MissingTile();
            if (isBitmap(answer.image)) {
              const flipped = await createImageBitmap(answer.image, FLIPPED);
              answer.image.close?.();
              return flipped;
            }
            return answer.image;
          }
        }
        if (options.video) {
          const { frame, videos } = options.video;
          const url =
            spec.kind === 'xyz' ? templateTileUrl(frame.url, tile) : frame.url;
          return await videos.frame(url, frame.fraction ?? 0);
        }
        if (spec.kind === 'vectorStyle') {
          const canvas = await paintVectorTile(
            spec.style,
            tile.level,
            tile.x,
            tile.y,
            { size: VECTOR_TILE_PX, signal: controller.signal },
          );
          controller.signal.throwIfAborted();
          return canvas;
        }
        if (spec.kind === 'canvas') {
          const size = spec.tileSize ?? 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          spec.drawTile(tile, canvas);
          return canvas;
        }
        if (spec.fetchTile) {
          return await fetchViaHook(tile);
        }
        if (spec.kind === 'xyz') {
          const url = xyzTileUrl(spec, tile);
          return await fetchImageFlipped(url, {
            signal: controller.signal,
            retryStatuses: spec.retryStatuses,
          });
        }
        if (spec.kind === 'single-image') {
          return await fetchImageFlipped(spec.url, {
            signal: controller.signal,
            retryStatuses: spec.retryStatuses,
          });
        }
        throw new MissingTile();
      } finally {
        ctx.signals.delete(controller);
      }
    }

    return (x, y, level) => {
      if (disposed || ctx.isRemoved()) return 'missing';
      const tile = { x, y, level };
      let waitsOnBudget = false;
      const issue = () => {
        if (inFlight >= limit) {
          waitsOnBudget = true;
          return undefined;
        }
        waitsOnBudget = false;
        inFlight += 1;
        ctx.started();
        let p = Promise.resolve().then(() => loadRawTile(tile));
        if (spec.tileTransform && !options.decoded && !options.video) {
          p = p.then((image) => applyTileTransform(spec, tile, image));
        }
        return p.then(
          (img) => {
            inFlight -= 1;
            ctx.settled();
            return img;
          },
          (error) => {
            inFlight -= 1;
            ctx.settled();
            if (
              !(error instanceof MissingTile) &&
              error?.name !== 'AbortError' &&
              !ctx.isRemoved() &&
              listeners.tileError.length > 0
            ) {
              const status = error?.statusCode;
              deliver(listeners.tileError, {
                tile,
                ...(Number.isFinite(status) ? { status } : {}),
              });
            }
            throw error;
          },
        );
      };
      if (!spec.admit || options.decoded || options.video) return issue();
      try {
        const answer = spec.admit(tile, issue);
        if (answer === undefined && !waitsOnBudget && !ctx.busy()) retrySoon();
        return answer;
      } catch (error) {
        return Promise.reject(error);
      }
    };
  }

  function addWasmLayer(
    spec,
    callback,
    { alpha, show, split, index, onTileset, singleTile },
  ) {
    const rect = spec.rectangle;
    const w = rect ? rect.west : Number.NaN;
    const s = rect ? rect.south : Number.NaN;
    const e = rect ? rect.east : Number.NaN;
    const n = rect ? rect.north : Number.NaN;
    const isSingle = singleTile ?? spec.kind === 'single-image';
    const geographic =
      spec.tiling === 'geographic' || (spec.kind === 'canvas' && !spec.tiling);
    const maxLevel =
      spec.kind === 'vectorStyle'
        ? VECTOR_MAX_LEVEL
        : typeof spec.maxLevel === 'number'
          ? spec.maxLevel
          : -1;
    const tileSize =
      spec.kind === 'vectorStyle' ? VECTOR_TILE_PX : (spec.tileSize ?? 256);
    return engine.add_js_imagery(
      callback,
      geographic,
      isSingle,
      w,
      s,
      e,
      n,
      spec.minLevel ?? 0,
      maxLevel,
      tileSize,
      alpha,
      show,
      SPLITS[split] ?? 0,
      minTerrainLevelOf(spec),
      spec.credit?.text ?? '',
      typeof index === 'number' ? index : -1,
      Boolean(onTileset),
    );
  }

  /** Sync every layer's host (globe vs tileset) and stacking order in WASM. */
  function sync() {
    if (disposed) return;
    let globeIdx = 0;
    let tilesIdx = 0;
    for (const record of layers) {
      if (record.removed) continue;
      const desired = targetHostFor(record);
      const toTileset = desired === 'tiles';
      const targetIndex = toTileset ? tilesIdx : globeIdx;
      if (record.host !== desired) {
        if (desired === null) {
          if (record.wasmId) engine.set_imagery_show(record.wasmId, false);
        } else if (record.wasmId) {
          engine.move_imagery_layer(record.wasmId, toTileset, targetIndex);
          engine.set_imagery_show(record.wasmId, record.show && !record.timed);
        }
        record.host = desired;
      }
      if (desired === 'tiles') tilesIdx += 1;
      else if (desired === 'globe') globeIdx += 1;
      if (record.timed) {
        // Reserve slots for timed frame layers immediately above their parent.
        const count = record.timed.layers.size;
        if (desired === 'tiles') tilesIdx += count;
        else if (desired === 'globe') globeIdx += count;
      }
    }
  }

  function add(spec, index, { base = false } = {}) {
    if (disposed) throw new Error('This globe has been disposed');
    if (!spec || typeof spec !== 'object')
      throw new TypeError('ImagerySpec is required');
    if (
      !capabilities.has('imageHooks') &&
      (spec.tileTransform || spec.admit || spec.kind === 'canvas')
    ) {
      throw new TypeError(
        'tileTransform, admit and canvas imagery need imageHooks',
      );
    }
    if (spec.fetchTile && spec.kind !== 'xyz') {
      throw new TypeError('fetchTile is supported for xyz imagery only');
    }
    if (spec.kind === 'canvas' && typeof spec.drawTile !== 'function') {
      throw new TypeError('Canvas imagery needs drawTile');
    }
    if (
      !['xyz', 'single-image', 'canvas', 'vectorStyle', 'world'].includes(
        spec.kind,
      )
    ) {
      throw new TypeError(`Unknown imagery kind: ${spec.kind}`);
    }

    const listeners = { tileError: [], frameReady: [] };
    const signals = new Set();
    const shared = spec.admit ?? {};
    const record = {
      spec: { ...spec },
      base,
      alpha: 1,
      show: true,
      split: 'none',
      drapeOn: 'all',
      lit: true,
      host: null,
      removed: false,
      wasmId: 0,
      signals,
      listeners,
      timed: null,
      removeCredit: spec.credit ? addCredit(spec.credit) : null,
    };

    const ctx = {
      isRemoved: () => record.removed || disposed,
      busy: () => (admitPending.get(shared) ?? 0) > 0,
      started: () => {
        pending += 1;
        admitPending.set(shared, (admitPending.get(shared) ?? 0) + 1);
        onPendingChange?.();
      },
      settled: () => {
        pending = Math.max(0, pending - 1);
        const left = (admitPending.get(shared) ?? 1) - 1;
        if (left > 0) admitPending.set(shared, left);
        else admitPending.delete(shared);
        onPendingChange?.();
        if (!disposed) requestRender('imagery');
      },
      laterFrame,
      signals,
    };
    record.ctx = ctx;

    let at = index;
    if (at === undefined) {
      const z = Number.isFinite(spec.zOrder) ? spec.zOrder : 0;
      at = layers.length;
      while (at > 0 && (layers[at - 1].spec.zOrder ?? 0) > z) at -= 1;
    }
    if (at === undefined || at > layers.length) at = layers.length;
    at = Math.max(0, at);

    const desiredHost = targetHostFor(record);
    record.host = desiredHost;
    const cb = makeTileCallback(spec, ctx, listeners);
    record.wasmId = addWasmLayer(spec, cb, {
      alpha: record.alpha,
      show: record.show && desiredHost !== null,
      split: record.split,
      index: at,
      onTileset: desiredHost === 'tiles',
    });

    const handle = {
      get alpha() {
        return record.alpha;
      },
      set alpha(v) {
        record.alpha = Math.min(1, Math.max(0, Number(v)));
        if (!record.removed && record.wasmId)
          engine.set_imagery_alpha(record.wasmId, record.alpha);
        requestRender('imagery.alpha');
      },
      get show() {
        return record.show;
      },
      set show(v) {
        record.show = Boolean(v);
        if (!record.removed && record.wasmId)
          engine.set_imagery_show(record.wasmId, record.show && !record.timed);
        requestRender('imagery.show');
      },
      get split() {
        return record.split;
      },
      set split(v) {
        if (!(v in SPLITS)) throw new TypeError(`Unknown split: ${v}`);
        record.split = v;
        if (!record.removed && record.wasmId)
          engine.set_imagery_split_direction(record.wasmId, SPLITS[v]);
        requestRender('imagery.split');
      },
      get drapeOn() {
        return record.drapeOn;
      },
      set drapeOn(v) {
        if (!DRAPES.has(v)) throw new TypeError(`Unknown drape: ${v}`);
        record.drapeOn = v;
        sync();
        requestRender('imagery.drape');
      },
      get lit() {
        return record.lit;
      },
      set lit(v) {
        record.lit = Boolean(v);
      },
      on(event, cb) {
        const list = listeners[event];
        if (!list) return () => {};
        return subscribe(list, cb);
      },
      raise() {
        if (record.removed) return;
        const i = layers.indexOf(record);
        if (i >= 0 && i < layers.length - 1) {
          layers.splice(i, 1);
          layers.splice(i + 1, 0, record);
          if (record.wasmId) engine.raise_imagery(record.wasmId);
          requestRender('imagery.raise');
        }
      },
      lower() {
        if (record.removed) return;
        const i = layers.indexOf(record);
        if (i > 0) {
          layers.splice(i, 1);
          layers.splice(i - 1, 0, record);
          if (record.wasmId) engine.lower_imagery(record.wasmId);
          requestRender('imagery.lower');
        }
      },
      remove() {
        if (record.removed) return;
        record.removed = true;
        const i = layers.indexOf(record);
        if (i >= 0) layers.splice(i, 1);
        dropFrames(record);
        for (const controller of signals) controller.abort();
        signals.clear();
        listeners.tileError.length = 0;
        listeners.frameReady.length = 0;
        if (record.wasmId && !disposed) engine.remove_imagery(record.wasmId);
        record.wasmId = 0;
        record.removeCredit?.();
        record.removeCredit = null;
        requestRender('imagery.remove');
      },
    };

    if (capabilities.has('imageryFrames')) {
      handle.setFrames = (source, options = {}) => {
        const decoded = source?.kind === 'decoded';
        if (decoded && !capabilities.has('imageryDecoded')) {
          throw new TypeError('decoded imagery needs imageryDecoded');
        }
        if (
          decoded &&
          (typeof source.slotAt !== 'function' ||
            typeof source.tile !== 'function')
        ) {
          throw new TypeError('a decoded source needs slotAt and tile');
        }
        const frames = framesOf(source);
        if (record.removed) return;
        dropFrames(record);
        record.timed = {
          video: source.kind === 'video',
          decoded: decoded ? source : null,
          frames,
          mode: options.mode === 'blend' ? 'blend' : 'nearest',
          prefetch: Math.max(0, Math.floor(options.prefetch ?? 1)),
          clock: options.clock === 'own' ? 'own' : 'scene',
          own: null,
          at: null,
          announced: null,
          layers: new Map(),
          videos: source.kind === 'video' ? createTileVideos() : null,
        };
        if (record.wasmId) engine.set_imagery_show(record.wasmId, false);
        requestRender('imagery.frames');
      };
      handle.setFrameTime = (ms) => {
        if (record.timed?.clock !== 'own') return;
        record.timed.own = Number(ms);
        requestRender('imagery.frameTime');
      };
    }

    record.handle = handle;
    layers.splice(at, 0, record);
    requestRender('imagery.add');
    return handle;
  }

  // ── Timed frames lifecycle ───────────────────────────────────────────────

  function createFrameEntry(record, frame, host) {
    const timed = record.timed;
    const signals = new Set();
    const entry = {
      wasmId: 0,
      host,
      removed: false,
      signals,
    };
    const frameSpec = { ...record.spec, url: frame.url ?? record.spec.url };
    const ctx = {
      ...record.ctx,
      isRemoved: () => entry.removed || record.removed || disposed,
      signals,
    };
    const cb = makeTileCallback(
      frameSpec,
      ctx,
      record.listeners,
      timed.decoded
        ? {
            decoded: {
              source: timed.decoded,
              slot: frame.slot,
              urgency: () =>
                timed.at?.nearest === frame.slot ? 'shown' : 'prefetch',
            },
          }
        : timed.video
          ? { video: { frame, videos: timed.videos } }
          : {},
    );
    entry.wasmId = addWasmLayer(frameSpec, cb, {
      alpha: 0,
      show: record.show,
      split: record.split,
      index: -1,
      onTileset: host === 'tiles',
      singleTile:
        timed.decoded || timed.video
          ? record.spec.kind !== 'xyz'
          : record.spec.kind === 'single-image',
    });
    return entry;
  }

  function dropFrameEntry(entry) {
    entry.removed = true;
    for (const controller of entry.signals) controller.abort();
    entry.signals.clear();
    if (entry.wasmId && !disposed) engine.remove_imagery(entry.wasmId);
    entry.wasmId = 0;
  }

  function dropFrames(record) {
    const timed = record.timed;
    if (!timed) return;
    for (const entry of timed.layers.values()) dropFrameEntry(entry);
    timed.layers.clear();
    timed.videos?.clear();
    record.timed = null;
    if (!record.removed && record.wasmId && !disposed)
      engine.set_imagery_show(record.wasmId, record.show);
  }

  function stepFrames(sceneMs) {
    if (disposed || !capabilities.has('imageryFrames')) return;
    for (const record of layers) {
      const timed = record.timed;
      if (!timed || record.removed) continue;
      const ms = timed.clock === 'own' ? (timed.own ?? NaN) : sceneMs;
      const at = timed.decoded
        ? decodedShownAt(timed.decoded, ms)
        : shownAt(timed.frames, ms, timed.mode);
      timed.at = at;
      const held = !at
        ? []
        : timed.decoded
          ? decodedHeld(timed.decoded, at, timed.prefetch, ms)
          : heldFrames(timed.frames, at, timed.prefetch);
      for (const [idx, entry] of timed.layers) {
        if (!held.includes(idx)) {
          dropFrameEntry(entry);
          timed.layers.delete(idx);
        }
      }
      const host = record.host ?? targetHostFor(record);
      const weights = new Map(at?.shown.map((s) => [s.index, s.weight]));
      for (const idx of held.sort((a, b) => a - b)) {
        let entry = timed.layers.get(idx);
        if (!entry) {
          entry = createFrameEntry(
            record,
            timed.decoded ? { slot: idx, url: '' } : timed.frames[idx],
            host,
          );
          timed.layers.set(idx, entry);
        }
        const weight = weights.get(idx);
        engine.set_imagery_show(entry.wasmId, record.show && host !== null);
        engine.set_imagery_alpha(
          entry.wasmId,
          weight === undefined ? 0 : record.alpha * weight,
        );
        engine.set_imagery_split_direction(
          entry.wasmId,
          SPLITS[record.split] ?? 0,
        );
      }
    }
  }

  function announceFrames() {
    if (disposed || !capabilities.has('imageryFrames')) return;
    let any = false;
    for (const record of layers) if (record.timed?.at) any = true;
    if (!any) return;
    for (const record of layers.slice()) {
      const timed = record.timed;
      if (record.removed || !timed?.at || !record.show) continue;
      const time = timed.decoded
        ? timed.at.nearest
        : timed.frames[timed.at.nearest].time;
      if (time === timed.announced) continue;
      const allDrawn = timed.at.shown.every((s) => {
        const entry = timed.layers.get(s.index);
        return entry?.wasmId && engine.is_imagery_layer_drawn(entry.wasmId);
      });
      if (!allDrawn) continue;
      timed.announced = time;
      deliver(record.listeners.frameReady, time);
    }
  }

  return {
    add,
    list: () => layers.map((r) => r.handle),
    pending: () => pending,
    sync,
    stepFrames,
    announceFrames,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      for (const resolve of waiters.splice(0)) resolve();
      for (const record of layers.slice()) record.handle.remove();
      layers.length = 0;
      admitPending.clear();
    },
  };
}
