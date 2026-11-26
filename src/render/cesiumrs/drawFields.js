/**
 * @module render/cesiumrs/drawFields
 * @description Phase 3 `fields` capability (`rasterShell` and `windStreamlines`)
 * for the CesiumRS draw port (`src/render/contract/draw.d.ts`).
 */
import {
  bakeWindStreamlines,
  groupWindPaths,
} from '../../layers/wind/streamlines.js';
import { cssColor } from '../color.js';
import { toEcef } from '../stub/math.js';

const DEFAULT_WIND_COLOR = '#80c9e6';
const TIP_SPEED = 0.16;
const STEP_SECONDS = 0.032;

function toRgba(color, fallback = [0.5, 0.79, 0.9, 1]) {
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

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

function detailWindow(outer, inner) {
  if (!outer || !inner) return [1, 1, 0, 0];
  const dLon = outer.east - outer.west;
  const dLat = outer.north - outer.south;
  if (!(dLon > 0) || !(dLat > 0)) return [1, 1, 0, 0];
  return [
    clamp01((inner.west - outer.west) / dLon),
    clamp01((inner.south - outer.south) / dLat),
    clamp01((inner.east - outer.west) / dLon),
    clamp01((inner.north - outer.south) / dLat),
  ];
}

function sameRect(a, b) {
  if (!a || !b) return a === b;
  return (
    a.west === b.west &&
    a.south === b.south &&
    a.east === b.east &&
    a.north === b.north
  );
}

function windGridOf(spec) {
  const { west, south, north } = spec.rectangle;
  let { east } = spec.rectangle;
  if (east < west) east += 360;
  const span = east - west;
  const wraps = span >= 360 - 1e-9;
  return {
    u: spec.u,
    v: spec.v,
    nx: spec.width,
    ny: spec.height,
    lo1: west,
    la1: north,
    dx: span / (wraps ? spec.width : spec.width - 1),
    dy: (north - south) / (spec.height - 1),
  };
}

let fieldSeq = 0;

/**
 * Create a `rasterShell` or `windStreamlines` `FieldHandle` on `engine`.
 */
export function createCesiumRsField(
  engine,
  spec,
  {
    decodeImage,
    requestRender,
    report,
    subscribe,
    deliver,
    isDestroyed,
    registerField,
  },
) {
  if (!spec || typeof spec.id !== 'string' || !spec.id) {
    throw new TypeError('FieldSpec.id must be a non-empty string');
  }
  if (spec.kind === 'rasterShell') {
    return createRasterShellField(engine, spec, {
      decodeImage,
      requestRender,
      report,
      subscribe,
      deliver,
      isDestroyed,
      registerField,
    });
  }
  if (spec.kind === 'windStreamlines') {
    return createWindStreamlinesField(engine, spec, {
      requestRender,
      report,
      subscribe,
      deliver,
      isDestroyed,
      registerField,
    });
  }
  throw new TypeError(`Unknown FieldSpec kind: ${String(spec.kind)}`);
}

function createRasterShellField(
  engine,
  spec,
  {
    decodeImage,
    requestRender,
    report,
    subscribe,
    deliver,
    isDestroyed,
    registerField,
  },
) {
  const uid = `shell:${++fieldSeq}:${spec.id}`;
  const mainTexId = `${uid}:main`;
  const detailTexId = `${uid}:detail`;
  let current = { ...spec };
  let show = true;
  let disposed = false;
  let created = false;
  let dirty = true;
  let pendingLoads = 0;
  let loadGen = 0;
  let drawnListeners = [];
  let hasDetailTex = false;
  let renderedAfterChange = false;

  const gone = () => disposed || isDestroyed();

  function loadImagesAndApply(rebuildGeometry) {
    const gen = ++loadGen;
    const imgRef = current.image;
    const detSpec = current.detail ?? null;
    pendingLoads += 1;

    Promise.all([
      decodeImage(imgRef, [64, 64]),
      detSpec?.image ? decodeImage(detSpec.image, [64, 64]) : Promise.resolve(null),
    ])
      .then(([mainImg, detImg]) => {
        if (gone() || gen !== loadGen) return;
        engine.upload_texture_rgba(
          mainTexId,
          mainImg.width,
          mainImg.height,
          mainImg.rgba,
        );
        if (detImg && detSpec?.rectangle) {
          engine.upload_texture_rgba(
            detailTexId,
            detImg.width,
            detImg.height,
            detImg.rgba,
          );
          hasDetailTex = true;
        } else {
          hasDetailTex = false;
        }
        const win =
          hasDetailTex && detSpec?.rectangle
            ? detailWindow(current.rectangle, detSpec.rectangle)
            : [1, 1, 0, 0];
        const alpha = clamp01(current.alpha ?? 1);
        const liftM = Number(current.liftM) || 0;
        const heightM = Number(current.heightM) || 0;
        if (!created || rebuildGeometry) {
          engine.create_raster_shell(
            uid,
            current.rectangle.west,
            current.rectangle.south,
            current.rectangle.east,
            current.rectangle.north,
            heightM,
            mainTexId,
            hasDetailTex ? detailTexId : '',
            win,
            alpha,
            liftM,
            show,
          );
          created = true;
        } else {
          engine.update_raster_shell(
            uid,
            mainTexId,
            hasDetailTex ? detailTexId : '',
            win,
            alpha,
            liftM,
            show,
          );
        }
        dirty = true;
        renderedAfterChange = false;
        requestRender('field.rasterShell');
      })
      .catch((err) => {
        if (!gone()) report(err);
      })
      .finally(() => {
        pendingLoads = Math.max(0, pendingLoads - 1);
      });
  }

  const controller = {
    isSettled: () => disposed || !show || (pendingLoads === 0 && !dirty),
    preRender() {},
    postRender() {
      if (gone() || !show || !created || pendingLoads > 0) return;
      if (dirty) {
        if (!renderedAfterChange) {
          renderedAfterChange = true;
          dirty = false;
          deliver(drawnListeners);
        }
      }
    },
    dispose() {
      handle.dispose();
    },
  };

  const unregister = registerField(controller);
  loadImagesAndApply(true);

  const handle = {
    get show() {
      return show;
    },
    set show(v) {
      const next = Boolean(v);
      if (disposed || show === next) return;
      show = next;
      if (!isDestroyed() && created) {
        const win =
          hasDetailTex && current.detail?.rectangle
            ? detailWindow(current.rectangle, current.detail.rectangle)
            : [1, 1, 0, 0];
        engine.update_raster_shell(
          uid,
          '',
          hasDetailTex ? detailTexId : '',
          win,
          clamp01(current.alpha ?? 1),
          Number(current.liftM) || 0,
          show,
        );
      }
      if (show) {
        renderedAfterChange = false;
        requestRender('field.rasterShell.show');
      }
    },
    update(patch) {
      if (gone() || !patch) return;
      const prev = current;
      current = { ...current, ...patch };
      const geomChanged =
        ('rectangle' in patch && !sameRect(prev.rectangle, current.rectangle)) ||
        ('heightM' in patch && prev.heightM !== current.heightM);
      const imgChanged =
        ('image' in patch && prev.image !== current.image) ||
        ('detail' in patch && prev.detail !== current.detail);

      dirty = true;
      renderedAfterChange = false;

      if (geomChanged || imgChanged) {
        loadImagesAndApply(geomChanged);
        return;
      }
      if (created) {
        const win =
          hasDetailTex && current.detail?.rectangle
            ? detailWindow(current.rectangle, current.detail.rectangle)
            : [1, 1, 0, 0];
        engine.update_raster_shell(
          uid,
          '',
          hasDetailTex ? detailTexId : '',
          win,
          clamp01(current.alpha ?? 1),
          Number(current.liftM) || 0,
          show,
        );
        requestRender('field.rasterShell.update');
      }
    },
    on(event, cb) {
      if (disposed || event !== 'drawn') return () => {};
      return subscribe(drawnListeners, cb);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unregister();
      drawnListeners = [];
      if (!isDestroyed()) {
        engine.remove_raster_shell(uid);
        engine.remove_texture(mainTexId);
        engine.remove_texture(detailTexId);
      }
    },
  };

  return handle;
}

function createWindStreamlinesField(
  engine,
  spec,
  { requestRender, report, subscribe, deliver, isDestroyed, registerField },
) {
  const setId = `__field_wind_${++fieldSeq}_${spec.id}`;
  let current = { ...spec, style: { ...spec.style } };
  let show = true;
  let disposed = false;
  let dirty = true;
  let paths = [];
  let phase = 0;
  let lastStepMs = 0;
  let drawnListeners = [];

  const gone = () => disposed || isDestroyed();

  function rebuildPaths() {
    const grid = windGridOf(current);
    const { west, south, north } = current.rectangle;
    const east =
      current.rectangle.east < west
        ? current.rectangle.east + 360
        : current.rectangle.east;
    const bounds =
      east - west >= 360 - 1e-9 ? null : { west, south, east, north };
    const baked = bakeWindStreamlines(grid, {
      count: current.pathBudget,
      steps: current.steps,
      bounds,
    });
    if (!baked.length) {
      throw new RangeError('no wind streamlines run through this grid');
    }
    const height = Number(current.heightM) || 0;
    const grouped = groupWindPaths(baked);
    const out = [];
    let idx = 0;
    for (const group of grouped) {
      for (const path of group.paths) {
        const flat = [];
        for (const [lon, lat] of path.coordinates) {
          const p = toEcef({ lon, lat, height });
          flat.push(p.x, p.y, p.z);
        }
        if (flat.length >= 6) {
          out.push({
            id: `w${idx++}`,
            flat,
            seed: ((idx * 0.61803398875) % 1 + 1) % 1,
          });
        }
      }
    }
    paths = out;
  }

  function uploadLines() {
    if (gone()) return;
    const alpha = clamp01(current.alpha ?? 1);
    const paused = current.paused === true;
    const widthPx = Number(current.style?.widthPx ?? 2.4);
    const baseColor = toRgba(
      current.style?.color ?? DEFAULT_WIND_COLOR,
      [0.5, 0.79, 0.9, 1],
    );
    const ghostAlpha = (paused ? 0.34 : 0.25) * alpha;
    const payload = [];
    if (show && alpha > 0.001) {
      for (const p of paths) {
        payload.push({
          id: p.id,
          positions: p.flat,
          width_px: widthPx,
          style_kind: 'solid',
          color: [baseColor[0], baseColor[1], baseColor[2], ghostAlpha],
          show: true,
          pickable: false,
        });
      }
    }
    engine.replace_lines(setId, JSON.stringify(payload));
  }

  engine.create_line_set(setId, show, false, -50);
  rebuildPaths();
  uploadLines();
  requestRender('field.windStreamlines');

  const controller = {
    isSettled: () => disposed || !show || !dirty,
    preRender(frameTime) {
      if (gone() || !show || current.paused === true) return;
      const nowS = (frameTime?.now ?? performance.now()) / 1000;
      if (nowS - lastStepMs >= STEP_SECONDS) {
        lastStepMs = nowS;
        const speed = TIP_SPEED * (current.style?.speedFactor ?? 1);
        phase = (phase + STEP_SECONDS * speed) % 1;
      }
    },
    postRender() {
      if (gone() || !show || !dirty) return;
      dirty = false;
      deliver(drawnListeners);
    },
    dispose() {
      handle.dispose();
    },
  };

  const unregister = registerField(controller);

  const handle = {
    get show() {
      return show;
    },
    set show(v) {
      const next = Boolean(v);
      if (disposed || show === next) return;
      show = next;
      if (!isDestroyed()) {
        engine.set_draw_set_show(setId, show);
        if (show) {
          uploadLines();
          requestRender('field.windStreamlines.show');
        }
      }
    },
    update(patch) {
      if (gone() || !patch) return;
      const needsRebuild =
        'u' in patch ||
        'v' in patch ||
        'width' in patch ||
        'height' in patch ||
        'rectangle' in patch ||
        'pathBudget' in patch ||
        'steps' in patch ||
        'heightM' in patch;
      current = {
        ...current,
        ...patch,
        style: patch.style
          ? { ...current.style, ...patch.style }
          : current.style,
      };
      if (needsRebuild) rebuildPaths();
      uploadLines();
      dirty = true;
      requestRender('field.windStreamlines.update');
    },
    on(event, cb) {
      if (disposed || event !== 'drawn') return () => {};
      return subscribe(drawnListeners, cb);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unregister();
      drawnListeners = [];
      if (!isDestroyed()) {
        engine.dispose_draw_set(setId);
      }
    },
  };

  return handle;
}
