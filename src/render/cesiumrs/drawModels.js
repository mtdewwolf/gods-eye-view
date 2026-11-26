/**
 * @module render/cesiumrs/drawModels
 * @description Phase 3 `models`, `modelNodes`, and `modelParts` draw sets for
 * the CesiumRS renderer (`src/render/contract/draw.d.ts`).
 */
import { eastNorthUp } from '../../geo/frames.js';
import { horizonFrom } from '../../geo/horizon.js';
import { cssColor } from '../color.js';
import {
  asksHighlight,
  glbJson,
  gltfMeshMatrix,
  gltfPartTable,
  PART_HIGHLIGHT,
  partMatrices,
} from '../modelParts.js';
import {
  recedeFactors,
  recedeFrame,
  recedeParams,
  recededAlpha,
} from '../recession.js';
import { toCartographicRadians, toEcef } from '../stub/math.js';

const PART_HIGHLIGHT_COLOR = '#ffc400';
const PART_TEXELS = 8;
const PART_FLOATS = PART_TEXELS * 4;
const AT_REST_EPSILON = 1e-9;
const DEFAULT_MIX = 0.5;
const MODEL_RETRY_MS = 5000;

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

function posToEcef(pos) {
  if (!pos) return { x: 0, y: 0, z: 0 };
  return toEcef(pos);
}

function focusOf(item) {
  return Number.isFinite(item.focus) ? Math.min(1, Math.max(0, item.focus)) : 1;
}

function nearFarValue(curve, distance) {
  if (!curve) return 1;
  const { near, nearValue, far, farValue } = curve;
  if (!(far > near)) return distance <= near ? nearValue : farValue;
  const t = Math.min(1, Math.max(0, (distance - near) / (far - near)));
  return nearValue + (farValue - nearValue) * t;
}

function cappedScale(scale, radiusM, metresPerPixel, maxPixelSize) {
  if (
    !(maxPixelSize > 0) ||
    !(radiusM > 0) ||
    !(metresPerPixel > 0) ||
    !Number.isFinite(metresPerPixel)
  )
    return scale;
  const cap = (maxPixelSize * metresPerPixel) / (2 * radiusM);
  return Math.min(scale, cap);
}

/**
 * Column-major 4x4 fixed-frame model matrix from ECEF `pos`,
 * `{ heading, pitch, roll }` (radians), and optional `axisScale`.
 * Matches Cesium's `Transforms.headingPitchRollToFixedFrame` + glTF axis scale.
 */
function buildModelMatrix(pos, orientation, axisScale) {
  const origin = posToEcef(pos);
  const enu = eastNorthUp(origin);
  const h = Number(orientation?.heading ?? 0);
  const p = Number(orientation?.pitch ?? 0);
  const r = Number(orientation?.roll ?? 0);

  // R = Rz(-h) * Ry(-p) * Rx(r)
  const ch = Math.cos(-h);
  const sh = Math.sin(-h);
  const cp = Math.cos(-p);
  const sp = Math.sin(-p);
  const cr = Math.cos(r);
  const sr = Math.sin(r);

  // Columns of R in ENU:
  const r00 = ch * cp;
  const r10 = sh * cp;
  const r20 = -sp;

  const r01 = ch * sp * sr - sh * cr;
  const r11 = sh * sp * sr + ch * cr;
  const r21 = cp * sr;

  const r02 = ch * sp * cr + sh * sr;
  const r12 = sh * sp * cr - ch * sr;
  const r22 = cp * cr;

  // Apply glTF axisScale ([x, y, z] -> local [z, x, y] after glTF Y-up->Z-up + Z-fwd->X-fwd).
  const sx = axisScale ? Number(axisScale[2] ?? 1) : 1;
  const sy = axisScale ? Number(axisScale[0] ?? 1) : 1;
  const sz = axisScale ? Number(axisScale[1] ?? 1) : 1;

  const ex = enu.x;
  const ey = enu.y;
  const ez = enu.z;

  const c0x = (ex.x * r00 + ey.x * r10 + ez.x * r20) * sx;
  const c0y = (ex.y * r00 + ey.y * r10 + ez.y * r20) * sx;
  const c0z = (ex.z * r00 + ey.z * r10 + ez.z * r20) * sx;

  const c1x = (ex.x * r01 + ey.x * r11 + ez.x * r21) * sy;
  const c1y = (ex.y * r01 + ey.y * r11 + ez.y * r21) * sy;
  const c1z = (ex.z * r01 + ey.z * r11 + ez.z * r21) * sy;

  const c2x = (ex.x * r02 + ey.x * r12 + ez.x * r22) * sz;
  const c2y = (ex.y * r02 + ey.y * r12 + ez.y * r22) * sz;
  const c2z = (ex.z * r02 + ey.z * r12 + ez.z * r22) * sz;

  return [
    c0x,
    c0y,
    c0z,
    0,
    c1x,
    c1y,
    c1z,
    0,
    c2x,
    c2y,
    c2z,
    0,
    origin.x,
    origin.y,
    origin.z,
    1,
  ];
}

function inverseAffine(m) {
  const [a, b, c] = [m[0], m[1], m[2]];
  const [d, e, f] = [m[4], m[5], m[6]];
  const [g, h, i] = [m[8], m[9], m[10]];
  const A = e * i - f * h;
  const B = -(b * i - c * h);
  const C = b * f - c * e;
  const det = a * A + d * B + g * C;
  if (!(Math.abs(det) > 1e-30)) return null;
  const inv = 1 / det;
  const out = [
    A * inv,
    B * inv,
    C * inv,
    0,
    -(d * i - f * g) * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    0,
    (d * h - e * g) * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
    0,
    0,
    0,
    0,
    1,
  ];
  for (let row = 0; row < 3; row++) {
    out[12 + row] = -(
      out[row] * m[12] +
      out[4 + row] * m[13] +
      out[8 + row] * m[14]
    );
  }
  return out;
}

function partInfoFromBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  try {
    const json = glbJson(bytes);
    const table = gltfPartTable(json);
    const mesh = table && gltfMeshMatrix(json);
    const meshInverse = mesh && inverseAffine(mesh);
    if (table && table.parts.length > 1 && meshInverse) {
      return { table, mesh, meshInverse };
    }
  } catch {
    return null;
  }
  return null;
}

function asksParts(state) {
  return (
    Boolean(state) &&
    typeof state === 'object' &&
    ['spin', 'deploy', 'poses'].some(
      (k) => state[k] && Object.keys(state[k]).length > 0,
    )
  );
}

function highlightRgbOf(val) {
  if (!asksHighlight(val)) return null;
  if (val === true) return cssColor(PART_HIGHLIGHT_COLOR);
  if (typeof val === 'string') return cssColor(val.trim());
  if (Array.isArray(val)) return [val[0], val[1], val[2], 1];
  return null;
}

let scratchParts = new Float64Array(16 * 32);
let scratchFlags = new Uint8Array(32);
const scratchRow = new Float64Array(4);
const scratchL = new Float64Array(12);

function writePartTexture(info, state, timeS, scale, data) {
  const { table, mesh, meshInverse } = info;
  const n = table.parts.length;
  if (scratchParts.length < n * 16) {
    scratchParts = new Float64Array(n * 16);
    scratchFlags = new Uint8Array(n);
  }
  const posed = partMatrices(table, state, timeS, scratchParts, {
    flags: scratchFlags,
    scale,
  });
  const poses = state?.poses;
  const x = scratchParts;
  const ix = scratchRow;
  const L = scratchL;
  for (let k = 0; k < n; k++) {
    const o = k * 16;
    const d = k * PART_FLOATS;
    let moved = false;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let j = 0; j < 4; j++)
          sum += meshInverse[j * 4 + row] * x[o + col * 4 + j];
        ix[col] = sum;
      }
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) sum += ix[j] * mesh[col * 4 + j];
        L[row * 4 + col] = sum;
        data[d + row * 4 + col] = sum;
        if (Math.abs(sum - (row === col ? 1 : 0)) > AT_REST_EPSILON)
          moved = true;
      }
    }
    const a = L[0],
      b = L[1],
      c = L[2];
    const e = L[4],
      f = L[5],
      g = L[6];
    const h = L[8],
      i = L[9],
      j = L[10];
    const c00 = f * j - g * i;
    const c01 = -(e * j - g * h);
    const c02 = e * i - f * h;
    const c10 = -(b * j - c * i);
    const c11 = a * j - c * h;
    const c12 = -(a * i - b * h);
    const c20 = b * g - c * f;
    const c21 = -(a * g - c * e);
    const c22 = a * f - b * e;
    const det = a * c00 + b * c01 + c * c02;
    const nd = d + 12;
    const turned = moved && Math.abs(det) > 1e-12;
    const r = turned ? 1 / det : 0;
    data[nd] = turned ? c00 * r : 1;
    data[nd + 1] = turned ? c01 * r : 0;
    data[nd + 2] = turned ? c02 * r : 0;
    data[nd + 3] = turned ? 1 : 0;
    data[nd + 4] = turned ? c10 * r : 0;
    data[nd + 5] = turned ? c11 * r : 1;
    data[nd + 6] = turned ? c12 * r : 0;
    data[nd + 7] = 0;
    data[nd + 8] = turned ? c20 * r : 0;
    data[nd + 9] = turned ? c21 * r : 0;
    data[nd + 10] = turned ? c22 * r : 1;
    data[nd + 11] = 0;
    const hl =
      scratchFlags[k] & PART_HIGHLIGHT
        ? highlightRgbOf(poses?.[table.parts[k].name]?.highlight)
        : null;
    const hd = d + 24;
    data[hd] = hl ? hl[0] : 0;
    data[hd + 1] = hl ? hl[1] : 0;
    data[hd + 2] = hl ? hl[2] : 0;
    data[hd + 3] = hl ? 1 : 0;
  }
  return posed;
}

function failureMessage(err) {
  if (err instanceof Error && err.message) return err.message;
  const s = err == null ? '' : String(err);
  return s && s !== '[object Object]' ? s : 'the model did not load';
}

function sameMatrix(a, b) {
  if (!a || !b || a.length < 16 || b.length < 16) return false;
  for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Create one `draw.models(spec)` draw set on `engine`.
 */
export function createCesiumRsModelSet(
  engine,
  spec,
  {
    capabilities,
    camera,
    viewport,
    sets,
    projectPoint,
    requestRender,
    report,
    subscribe,
    deliver,
    isDestroyed,
    getModulationSampler,
    nowMs,
  },
) {
  const id = spec.id;
  const canNodes = capabilities.has('modelNodes');
  const canParts = capabilities.has('modelParts');
  const drawOrder = Number.isFinite(spec.drawOrder) ? spec.drawOrder : 0;

  const record = {
    id,
    kind: 'models',
    spec: { ...spec },
    show: spec.show !== false,
    pickable: spec.pickable !== false,
    drawOrder,
    items: new Map(),
    entries: new Map(),
    recede: recedeParams(spec.recede),
    disposed: false,
    listeners: { ready: [], loadFailed: [] },
    inFlightLoads: 0,
    hasSpinning: false,
  };
  sets.set(id, record);
  engine.create_model_set(id, record.show, record.pickable, drawOrder);
  if (spec.blend) engine.set_draw_set_blend(id, String(spec.blend));
  if (spec.includeInHeightQueries) engine.set_draw_set_height_query(id, true);

  const gone = () => record.disposed || isDestroyed();

  function buildOptionsPayload(
    entry,
    frameScale = 1,
    alphaMul = 1,
    shown = true,
  ) {
    const item = entry.item;
    const range = item.displayRange;
    const rangeEmpty = Array.isArray(range) && !(range[1] > range[0]);
    const hasTint = item.tint != null;
    const baseColor = hasTint ? toRgba(item.tint) : [1, 1, 1, 1];
    let color = null;
    if (hasTint || alphaMul < 0.9999) {
      color = [
        baseColor[0],
        baseColor[1],
        baseColor[2],
        Math.max(0, Math.min(1, baseColor[3] * alphaMul)),
      ];
    }
    const sampler = getModulationSampler?.();
    if (sampler && entry.ready && shown) {
      const s = projectPoint(item.pos);
      if (s) {
        const mod = sampler.modulateRgba(color ?? [1, 1, 1, 1], s.x, s.y, true);
        color = mod;
      }
    }

    const blendMode = hasTint
      ? (item.colorBlend?.mode ?? 'highlight')
      : 'highlight';
    const blendAmount =
      blendMode === 'mix' ? (item.colorBlend?.amount ?? DEFAULT_MIX) : 0.5;
    const maskRgba = item.maskColor ? toRgba(item.maskColor) : null;

    return {
      model_matrix: buildModelMatrix(
        item.pos,
        item.orientation,
        item.axisScale,
      ),
      scale: (Number(item.scale ?? 1) || 1) * frameScale,
      min_pixel_size: Number(item.minPixelSize ?? 0) || 0,
      max_scale:
        typeof item.maxScale === 'number' && Number.isFinite(item.maxScale)
          ? item.maxScale
          : null,
      show: shown && !rangeEmpty && item.show !== false,
      pickable: record.pickable && item.pickable !== false,
      color,
      color_blend_mode: blendMode,
      color_blend_amount: blendAmount,
      shading: item.shading ?? 'pbr',
      mask_color: maskRgba ? [maskRgba[0], maskRgba[1], maskRgba[2]] : null,
      clip_below_origin: item.clip === 'belowOrigin',
      display_range:
        Array.isArray(range) && range.length >= 2 && range[1] > range[0]
          ? [Math.max(0, range[0]), range[1]]
          : null,
      environment_map: item.environmentMap !== false,
    };
  }

  function applyNodes(entry) {
    if (!canNodes || !entry.ready || gone()) return;
    const wanted = entry.item.nodes ?? null;
    for (const name of [...entry.posedNodes.keys()]) {
      if (wanted && Object.hasOwn(wanted, name)) continue;
      entry.posedNodes.delete(name);
      engine.set_model_node_matrix(id, entry.id, name, new Float64Array(0));
    }
    if (!wanted) return;
    for (const name of Object.keys(wanted)) {
      const m = wanted[name];
      if (!m || m.length < 16) continue;
      const prev = entry.posedNodes.get(name);
      if (prev && sameMatrix(prev, m)) continue;
      const copy = new Float64Array(16);
      for (let i = 0; i < 16; i++) copy[i] = Number(m[i]);
      entry.posedNodes.set(name, copy);
      engine.set_model_node_matrix(id, entry.id, name, copy);
    }
  }

  function syncParts(entry, timeS) {
    if (!canParts || !entry.attached || gone()) return false;
    const info = entry.partInfo;
    const state = entry.item.parts;
    if (!info || !asksParts(state)) {
      if (entry.partsActive) {
        entry.partsActive = false;
        entry.spins = null;
        engine.set_model_parts(
          id,
          entry.id,
          entry.item.shading ?? 'pbr',
          new Float64Array(0),
          0,
          new Float32Array(0),
        );
      }
      return false;
    }

    if (!entry.spins) {
      entry.spins = { rates: new Map(), angles: {}, at: timeS };
    }
    // Advance spins and sync spin rates from state.
    const dt = timeS - entry.spins.at;
    entry.spins.at = timeS;
    if (dt > 0) {
      for (const [name, rate] of entry.spins.rates) {
        entry.spins.angles[name] = (entry.spins.angles[name] + rate * dt) % 360;
      }
    }
    entry.spins.rates.clear();
    for (const [name, rate] of Object.entries(state.spin ?? {})) {
      const idx = info.table.byName.get(name);
      if (
        idx === undefined ||
        !info.table.parts[idx].axis ||
        typeof rate !== 'number' ||
        !Number.isFinite(rate) ||
        rate === 0
      )
        continue;
      entry.spins.rates.set(name, rate);
      if (!(name in entry.spins.angles)) entry.spins.angles[name] = 0;
    }

    const rows = info.table.parts.length;
    if (!entry.partData || entry.partData.length !== rows * PART_FLOATS) {
      entry.partData = new Float32Array(rows * PART_FLOATS);
    }
    const drawnState = {
      deploy: state.deploy,
      poses: state.poses,
      spin: entry.spins.angles,
    };
    const scale =
      Array.isArray(entry.item.axisScale) && entry.item.axisScale.length >= 3
        ? entry.item.axisScale
        : undefined;
    const posed = writePartTexture(info, drawnState, 1, scale, entry.partData);
    const spinning = entry.spins.rates.size > 0;
    if (!posed && !spinning) {
      if (entry.partsActive) {
        entry.partsActive = false;
        engine.set_model_parts(
          id,
          entry.id,
          entry.item.shading ?? 'pbr',
          new Float64Array(0),
          0,
          new Float32Array(0),
        );
      }
      return false;
    }
    const mask = entry.item.maskColor ? toRgba(entry.item.maskColor) : null;
    const maskArr = mask
      ? new Float64Array([mask[0], mask[1], mask[2]])
      : new Float64Array(0);
    engine.set_model_parts(
      id,
      entry.id,
      entry.item.shading ?? 'pbr',
      maskArr,
      rows,
      entry.partData,
    );
    entry.partsActive = true;
    return spinning;
  }

  function computeFrameParams(
    entry,
    eye,
    eyeHeight,
    rFrame,
    horizon,
    metresPerPixelFactor,
  ) {
    const item = entry.item;
    const pos = posToEcef(item.pos);
    const dist = Math.hypot(pos.x - eye.x, pos.y - eye.y, pos.z - eye.z);
    let shown = true;
    if (record.spec.horizonCull && horizon && !horizon.isPointVisible(pos)) {
      shown = false;
    }
    let scaleMul = nearFarValue(item.scaleByDistance, dist);
    if (item.maxPixelSize > 0 && entry.radius > 0 && metresPerPixelFactor > 0) {
      const mpp = dist * metresPerPixelFactor;
      const baseScale = (Number(item.scale ?? 1) || 1) * scaleMul;
      const capped = cappedScale(
        baseScale,
        entry.radius,
        mpp,
        item.maxPixelSize,
      );
      scaleMul =
        baseScale > 0 ? capped / (Number(item.scale ?? 1) || 1) : scaleMul;
    }
    let alphaMul = nearFarValue(item.fadeByDistance, dist);
    const focus = focusOf(item);
    if (record.recede) {
      const fac = recedeFactors(dist, rFrame, record.recede);
      alphaMul *= recededAlpha(focus, fac.alpha, record.recede);
    } else {
      alphaMul *= focus;
    }
    return { scaleMul, alphaMul, shown };
  }

  function updateAttachedEntry(entry, forceParts = false) {
    if (!entry.attached || gone()) return;
    const pose = camera.port.pose();
    const eye = pose.position;
    const eyeHeight = Math.max(0, toCartographicRadians(eye).height);
    const rFrame = record.recede
      ? recedeFrame(eyeHeight, record.recede)
      : { active: false, limbM: 1, strength: 0 };
    const horizon = record.spec.horizonCull ? horizonFrom(eye) : null;
    const mppFactor =
      viewport.height > 0
        ? (2 * Math.tan((pose.fovy || Math.PI / 3) * 0.5)) / viewport.height
        : 0;
    const { scaleMul, alphaMul, shown } = computeFrameParams(
      entry,
      eye,
      eyeHeight,
      rFrame,
      horizon,
      mppFactor,
    );
    const payload = buildOptionsPayload(entry, scaleMul, alphaMul, shown);
    engine.update_model(id, entry.id, JSON.stringify(payload));
    if (entry.ready) applyNodes(entry);
    if (forceParts) syncParts(entry, nowMs() / 1000);
  }

  function startLoad(entry) {
    const token = {};
    entry.loadToken = token;
    entry.loadingUrl = entry.item.url;
    entry.failedAt = 0;
    const url = entry.item.url;
    const gltfBytes = entry.item.gltf;
    entry.partInfo = gltfBytes ? partInfoFromBytes(gltfBytes) : null;

    record.inFlightLoads += 1;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      record.inFlightLoads = Math.max(0, record.inFlightLoads - 1);
    };

    const promise =
      gltfBytes instanceof Uint8Array
        ? engine.load_model_bytes(String(url), gltfBytes)
        : engine.load_model_url(String(url));

    promise
      .then((loaded) => {
        finish();
        if (
          gone() ||
          entry.loadToken !== token ||
          record.entries.get(entry.id) !== entry
        ) {
          loaded?.free?.();
          return;
        }
        entry.loadedUrl = url;
        entry.attached = true;
        entry.ready = false;
        entry.readyFired = false;
        entry.posedNodes.clear();
        entry.partsActive = false;
        const payload = buildOptionsPayload(entry, 1, 1, true);
        engine.attach_model(id, entry.id, loaded, JSON.stringify(payload));
        if (entry.partInfo && asksParts(entry.item.parts)) {
          syncParts(entry, nowMs() / 1000);
        }
        requestRender('draw.models.attach');
      })
      .catch((error) => {
        finish();
        if (
          gone() ||
          entry.loadToken !== token ||
          record.entries.get(entry.id) !== entry
        ) {
          return;
        }
        entry.failedAt = nowMs();
        const msg = failureMessage(error);
        queueMicrotask(() => {
          if (!gone() && record.entries.get(entry.id) === entry) {
            deliver(record.listeners.loadFailed, entry.id, msg);
          }
        });
      });
  }

  function upsertEntry(item) {
    const key = String(item.id);
    record.items.set(key, item);
    let entry = record.entries.get(key);
    if (!entry) {
      entry = {
        id: key,
        item,
        loadedUrl: null,
        loadingUrl: null,
        loadToken: null,
        attached: false,
        ready: false,
        readyFired: false,
        radius: 0,
        failedAt: 0,
        posedNodes: new Map(),
        partInfo: null,
        partsActive: false,
        partData: null,
        spins: null,
      };
      record.entries.set(key, entry);
      startLoad(entry);
      return;
    }

    const urlChanged = item.url !== entry.loadingUrl;
    entry.item = item;
    if (urlChanged) {
      startLoad(entry);
      return;
    }
    if (entry.failedAt > 0 && nowMs() - entry.failedAt >= MODEL_RETRY_MS) {
      startLoad(entry);
      return;
    }
    if (entry.attached) {
      updateAttachedEntry(entry, true);
    }
  }

  record.stepPreRender = (frameTime) => {
    if (gone() || !record.show || record.entries.size === 0) return;
    const pose = camera.port.pose();
    const eye = pose.position;
    const eyeHeight = Math.max(0, toCartographicRadians(eye).height);
    const rFrame = record.recede
      ? recedeFrame(eyeHeight, record.recede)
      : { active: false, limbM: 1, strength: 0 };
    const horizon = record.spec.horizonCull ? horizonFrom(eye) : null;
    const mppFactor =
      viewport.height > 0
        ? (2 * Math.tan((pose.fovy || Math.PI / 3) * 0.5)) / viewport.height
        : 0;
    const timeS = (frameTime?.now ?? nowMs()) / 1000;
    let anySpin = false;
    for (const entry of record.entries.values()) {
      if (!entry.attached) continue;
      const { scaleMul, alphaMul, shown } = computeFrameParams(
        entry,
        eye,
        eyeHeight,
        rFrame,
        horizon,
        mppFactor,
      );
      const payload = buildOptionsPayload(entry, scaleMul, alphaMul, shown);
      engine.update_model(id, entry.id, JSON.stringify(payload));
      if (entry.ready) applyNodes(entry);
      if (syncParts(entry, timeS)) anySpin = true;
    }
    record.hasSpinning = anySpin;
    if (anySpin) requestRender('draw.models.spin');
  };

  record.stepPostRender = () => {
    if (gone()) return;
    for (const entry of record.entries.values()) {
      if (!entry.attached || entry.readyFired) continue;
      const info = engine.model_info(id, entry.id);
      if (info && info.length >= 3 && info[0] >= 0.5) {
        entry.ready = true;
        entry.radius = info[1] || 0;
        entry.readyFired = true;
        applyNodes(entry);
        deliver(record.listeners.ready, entry.id);
      }
    }
  };

  const handle = {
    id,
    set(items) {
      if (gone()) return;
      const nextList = items ?? [];
      const nextIds = new Set(nextList.map((it) => String(it.id)));
      for (const oldId of [...record.entries.keys()]) {
        if (!nextIds.has(oldId)) {
          record.entries.delete(oldId);
          record.items.delete(oldId);
          engine.remove_model(id, oldId);
        }
      }
      for (const item of nextList) upsertEntry(item);
      requestRender('draw.models.set');
    },
    upsert(items) {
      if (gone()) return;
      for (const item of items ?? []) upsertEntry(item);
      requestRender('draw.models.upsert');
    },
    remove(ids) {
      if (gone()) return;
      for (const raw of ids ?? []) {
        const key = String(raw);
        record.items.delete(key);
        record.entries.delete(key);
        engine.remove_model(id, key);
      }
      requestRender('draw.models.remove');
    },
    clear() {
      if (gone()) return;
      record.items.clear();
      record.entries.clear();
      engine.clear_models(id);
      requestRender('draw.models.clear');
    },
    setOptions(next) {
      if (gone() || !next) return;
      Object.assign(record.spec, next);
      if ('show' in next) {
        record.show = Boolean(next.show);
        engine.set_draw_set_show(id, record.show);
      }
      if ('drawOrder' in next) {
        record.drawOrder = Number.isFinite(next.drawOrder) ? next.drawOrder : 0;
        engine.set_draw_set_order(id, record.drawOrder);
      }
      if ('pickable' in next) {
        record.pickable = next.pickable !== false;
        engine.set_draw_set_pickable(id, record.pickable);
        for (const entry of record.entries.values()) {
          if (entry.attached) updateAttachedEntry(entry, false);
        }
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
      if ('recede' in next) {
        record.recede = recedeParams(next.recede);
        for (const entry of record.entries.values()) {
          if (entry.attached) updateAttachedEntry(entry, false);
        }
      }
      requestRender('draw.models.setOptions');
    },
    size: () => (record.disposed ? 0 : record.items.size),
    get show() {
      return record.show;
    },
    set show(v) {
      if (gone()) return;
      record.show = Boolean(v);
      engine.set_draw_set_show(id, record.show);
      requestRender('draw.models.show');
    },
    on(event, cb) {
      if (gone()) return () => {};
      const list = record.listeners[event];
      if (!list) return () => {};
      return subscribe(list, cb);
    },
    dispose() {
      if (record.disposed) return;
      record.disposed = true;
      record.items.clear();
      record.entries.clear();
      sets.delete(id);
      if (!isDestroyed()) engine.dispose_draw_set(id);
      requestRender('draw.models.dispose');
    },
  };

  if (capabilities.has('columns')) {
    handle.setColumns = () => {};
  }

  return handle;
}
