/**
 * @module render/cesiumrs/effects
 * @description Phase 3 effects port (`src/render/contract/effects.d.ts`) for
 * the CesiumRS renderer: custom GLSL post-processing styles with crossfading
 * and animated time uniforms, bloom, sharpen, and per-marker screen modulation.
 */
import { cssColor } from '../color.js';

/** Below this a style, bloom or sharpen draws nothing, so it runs no pass. */
const OFF = 0.001;
/** Bloom below this strength runs no pass. */
const BLOOM_FLOOR = 0.06;
const RESERVED = new Set([
  'colorTexture',
  'colorTextureDimensions',
  'v_textureCoordinates',
  'intensity',
  'time',
]);

const DIM_TINT = Object.freeze([0.62, 0.68, 0.72]);
const FEATHER_DEG = 10;
const FEATHER_SHARE = 0.42;
const CORE_SHARE = 0.025;
const DEG = 180 / Math.PI;

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const finite = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

export const SHARPEN_SHADER = /* glsl */ `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float amount;
  in vec2 v_textureCoordinates;

  void main() {
    vec2 uv = v_textureCoordinates;
    vec2 texel = 1.0 / colorTextureDimensions;
    vec4 center = texture(colorTexture, uv);
    vec4 blur = (
      texture(colorTexture, uv + vec2(-texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,     -texel.y)) +
      texture(colorTexture, uv + vec2( texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2(-texel.x,  0.0))     +
      center +
      texture(colorTexture, uv + vec2( texel.x,  0.0))     +
      texture(colorTexture, uv + vec2(-texel.x,  texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,      texel.y)) +
      texture(colorTexture, uv + vec2( texel.x,  texel.y))
    ) / 9.0;
    vec4 sharpened = center + (center - blur) * amount;
    out_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), center.a);
  }
`;

function bloomUniforms(strength) {
  const s = strength <= BLOOM_FLOOR ? 0 : (strength - BLOOM_FLOOR) / 0.94;
  const eased = s * s * (3 - 2 * s);
  return {
    contrast: 255 - eased * 168,
    brightness: -0.5 + eased * 0.36,
    sigma: 0.28 + eased * 6.3,
    delta: 0.2 + eased * 2.25,
    stepSize: 1 + eased * 1.25,
  };
}

function normalizeSector(sector) {
  const parsed = cssColor(String(sector.color ?? '')) ?? [1, 1, 1, 1];
  return {
    cx: finite(sector.center?.x),
    cy: finite(sector.center?.y),
    angle: (((finite(sector.angle) * DEG) % 360) + 360) % 360,
    width: Math.max(0, finite(sector.width) * DEG),
    radius: Math.max(0, finite(sector.radius)),
    floor: clamp01(finite(sector.floor, 1)),
    strength: clamp01(finite(sector.strength)),
    rgb: [parsed[0], parsed[1], parsed[2]],
  };
}

function createSectorSampler(s) {
  const radiusSquared = s.radius * s.radius;
  const feather = Math.min(FEATHER_DEG, s.width * FEATHER_SHARE);
  const sweeping = s.radius > 0;
  return {
    sector: s,
    floor: s.floor,
    key: `${s.cx}|${s.cy}|${s.angle}|${s.width}|${s.radius}|${s.floor}|${s.strength}|${s.rgb.join(',')}`,
    at(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return 1;
      if (!sweeping) return s.floor;
      const dx = x - s.cx;
      const dy = y - s.cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSquared) return s.floor;
      if (distSq < radiusSquared * CORE_SHARE * CORE_SHARE) return 1;
      const delta = (((Math.atan2(dx, -dy) * DEG - s.angle) % 360) + 360) % 360;
      if (delta > s.width) return s.floor;
      return (
        s.floor +
        (1 - s.floor) * Math.min(1, (s.width - delta) / (feather || 1))
      );
    },
    coverage(factor) {
      if (!sweeping || s.floor >= 0.9999) return 1;
      return clamp01((factor - s.floor) / (1 - s.floor));
    },
    modulateRgba(rgba, x, y, preserveAlpha = false) {
      const factor = this.at(x, y);
      const c = this.coverage(factor);
      const k = s.strength;
      let r =
        rgba[0] * (1 - k) + (DIM_TINT[0] + (s.rgb[0] - DIM_TINT[0]) * c) * k;
      let g =
        rgba[1] * (1 - k) + (DIM_TINT[1] + (s.rgb[1] - DIM_TINT[1]) * c) * k;
      let b =
        rgba[2] * (1 - k) + (DIM_TINT[2] + (s.rgb[2] - DIM_TINT[2]) * c) * k;
      if (preserveAlpha) {
        r *= factor;
        g *= factor;
        b *= factor;
        return [r, g, b, rgba[3]];
      }
      // Keep alpha >= 0.01 when the marker itself was visible so BillboardCollection
      // does not discard it from GPU pick passes (BillboardCollectionFS discards < 0.005),
      // while remaining visually indistinguishable from 0.
      const outAlpha = rgba[3] > 0 ? Math.max(0.01, rgba[3] * factor) : 0;
      return [r, g, b, outAlpha];
    },
  };
}

/**
 * Create the CesiumRS effects port over `BrowserScene` (`engine`).
 */
export function createCesiumRsEffects(
  engine,
  {
    capabilities,
    frame,
    requestRender,
    report,
    subscribe,
    deliver,
    isDestroyed,
    onModulationChange,
  },
) {
  const canStyles = capabilities.has('styles');
  const canBloom = capabilities.has('bloom');
  const canSharpen = capabilities.has('sharpen');
  const canModulation = capabilities.has('screenModulation');

  /** Defined styles in definition order: id -> record */
  const styles = new Map();
  let current = null;
  const fading = new Set();
  const listeners = [];

  let bloomEnabled = false;
  let bloomStrength = 0;
  let bloomActive = false;

  let sharpenInstalled = false;
  let sharpenEnabled = false;
  let sharpenAmount = 0;
  let sharpenActive = false;

  let modulationSampler = null;

  let releaseClock = null;
  let offClockFrame = null;
  let disposed = false;
  let stageSeq = 0;
  const startedMs = performance.now();

  const gone = () => disposed || isDestroyed();

  function activeStyleRecords() {
    const out = [];
    for (const rec of styles.values()) {
      if (rec.enabled) out.push(rec);
    }
    return out;
  }

  function diagnostics() {
    return {
      style: current,
      passes: [
        ...activeStyleRecords().map((r) => `style:${r.id}`),
        ...(bloomActive ? ['bloom'] : []),
        ...(sharpenActive ? ['sharpen'] : []),
        ...(modulationSampler ? ['screenModulation'] : []),
      ],
    };
  }

  function announce() {
    if (gone()) return;
    deliver(listeners, diagnostics());
  }

  function stopClock() {
    offClockFrame?.();
    offClockFrame = null;
    releaseClock?.();
    releaseClock = null;
  }

  function syncClock() {
    const needsClock = !gone() && activeStyleRecords().some((r) => r.animated);
    if (needsClock && !releaseClock) {
      releaseClock = frame.holdContinuous('effects.style');
      offClockFrame = frame.on('preRender', () => {
        if (gone()) return;
        const elapsedS = (performance.now() - startedMs) / 1000;
        for (const rec of styles.values()) {
          if (rec.enabled && rec.animated) {
            try {
              engine.set_post_process_stage_uniforms(
                rec.stageName,
                JSON.stringify({ time: elapsedS }),
              );
            } catch (error) {
              report(error);
            }
          }
        }
      });
    } else if (!needsClock && releaseClock) {
      stopClock();
    }
  }

  function syncStyleEnabled(rec) {
    const shouldDraw =
      (rec.id === current || fading.has(rec.id)) && rec.intensity > OFF;
    if (rec.enabled !== shouldDraw) {
      rec.enabled = shouldDraw;
      if (!gone()) {
        engine.set_post_process_stage_enabled(rec.stageName, shouldDraw);
      }
      if (!shouldDraw) fading.delete(rec.id);
      return true;
    }
    return false;
  }

  function assignParams(rec, params) {
    if (!params) return false;
    const patch = {};
    let changed = false;
    for (const [key, raw] of Object.entries(params)) {
      if (!(key in rec.values)) continue;
      const val = Number(raw);
      if (!Number.isFinite(val)) continue;
      if (rec.values[key] !== val) {
        rec.values[key] = val;
        patch[key] = val;
        changed = true;
      }
    }
    if (changed && !gone()) {
      try {
        engine.set_post_process_stage_uniforms(
          rec.stageName,
          JSON.stringify(patch),
        );
      } catch (error) {
        report(error);
      }
    }
    return changed;
  }

  const port = {
    styles() {
      if (!canStyles || gone()) return [];
      return [...styles.values()].map((r) => ({
        id: r.id,
        params: r.params.map((p) => ({ ...p })),
        animated: r.animated,
      }));
    },

    defineStyle(definition) {
      if (!canStyles || gone()) return null;
      if (!definition || typeof definition.id !== 'string' || !definition.id)
        return null;
      const glsl = definition.shader?.glsl;
      if (typeof glsl !== 'string' || !glsl.trim()) return null;

      const id = definition.id;
      const params = (definition.params ?? [])
        .filter((p) => p && typeof p.key === 'string' && !RESERVED.has(p.key))
        .map((p) => ({ ...p }));
      const values = {};
      for (const p of params) values[p.key] = Number(p.default ?? 0);

      const prev = styles.get(id);
      const intensity = prev ? prev.intensity : 1;
      if (prev) {
        for (const key of Object.keys(values)) {
          if (key in prev.values) values[key] = prev.values[key];
        }
        engine.remove_post_process_stage(prev.stageName);
      }

      const stageName = `__gev_style_${++stageSeq}_${id}`;
      const shouldDraw = (id === current || fading.has(id)) && intensity > OFF;
      const initUniforms = {
        ...values,
        intensity,
        time: (performance.now() - startedMs) / 1000,
      };
      try {
        engine.add_post_process_stage(
          stageName,
          glsl,
          JSON.stringify(initUniforms),
          shouldDraw,
        );
      } catch (error) {
        report(error);
        return null;
      }

      const record = {
        id,
        stageName,
        params,
        values,
        animated: Boolean(definition.animated),
        intensity,
        enabled: shouldDraw,
      };
      styles.set(id, record);
      syncClock();
      requestRender('effects.defineStyle');
      announce();

      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        // Only remove if this definition is still the active one for `id`.
        if (styles.get(id) !== record) return;
        styles.delete(id);
        fading.delete(id);
        if (!gone()) engine.remove_post_process_stage(record.stageName);
        if (current === id) current = null;
        syncClock();
        requestRender('effects.undefineStyle');
        announce();
      };
    },

    setStyle(id, params) {
      if (!canStyles || gone()) return;
      const nextId = id == null ? null : String(id);
      if (nextId !== null && !styles.has(nextId)) return;

      if (current !== null && current !== nextId) {
        const old = styles.get(current);
        if (old && old.intensity > OFF) {
          fading.add(current);
        } else if (old) {
          fading.delete(current);
          syncStyleEnabled(old);
        }
      }
      current = nextId;
      if (nextId !== null) {
        fading.delete(nextId);
        const rec = styles.get(nextId);
        if (rec) {
          assignParams(rec, params);
          syncStyleEnabled(rec);
        }
      }
      syncClock();
      requestRender('effects.setStyle');
      announce();
    },

    setStyleIntensity(id, intensity) {
      if (!canStyles || gone()) return;
      const rec = styles.get(String(id));
      if (!rec) return;
      const next = clamp01(intensity);
      rec.intensity = next;
      try {
        engine.set_post_process_stage_uniforms(
          rec.stageName,
          JSON.stringify({ intensity: next }),
        );
      } catch (error) {
        report(error);
      }
      if (next <= OFF && rec.id !== current) {
        fading.delete(rec.id);
      }
      const toggled = syncStyleEnabled(rec);
      syncClock();
      requestRender('effects.setStyleIntensity');
      if (toggled) announce();
    },

    setStyleParams(id, params) {
      if (!canStyles || gone()) return;
      const rec = styles.get(String(id));
      if (!rec) return;
      if (assignParams(rec, params)) {
        requestRender('effects.setStyleParams');
      }
    },

    bloom(settings) {
      if (!canBloom || gone() || !settings) return;
      if (typeof settings.enabled === 'boolean')
        bloomEnabled = settings.enabled;
      if (typeof settings.strength === 'number')
        bloomStrength = clamp01(settings.strength);
      const active = bloomEnabled && bloomStrength > BLOOM_FLOOR;
      const changed = active !== bloomActive;
      bloomActive = active;
      const u = bloomUniforms(bloomStrength);
      engine.set_bloom(
        active,
        u.contrast,
        u.brightness,
        u.delta,
        u.sigma,
        u.stepSize,
      );
      requestRender('effects.bloom');
      if (changed) announce();
    },

    sharpen(settings) {
      if (!canSharpen || gone() || !settings) return;
      if (typeof settings.enabled === 'boolean')
        sharpenEnabled = settings.enabled;
      if (typeof settings.amount === 'number')
        sharpenAmount = Math.max(0, Number(settings.amount) || 0);
      const active = sharpenEnabled && sharpenAmount > OFF;
      const changed = active !== sharpenActive;
      sharpenActive = active;
      if (active && !sharpenInstalled) {
        try {
          engine.add_post_process_stage(
            '__gev_sharpen__',
            SHARPEN_SHADER,
            JSON.stringify({ amount: sharpenAmount }),
            true,
          );
          sharpenInstalled = true;
        } catch (error) {
          report(error);
          sharpenActive = false;
        }
      } else if (sharpenInstalled) {
        engine.set_post_process_stage_enabled('__gev_sharpen__', active);
        if (active) {
          try {
            engine.set_post_process_stage_uniforms(
              '__gev_sharpen__',
              JSON.stringify({ amount: sharpenAmount }),
            );
          } catch (error) {
            report(error);
          }
        }
      }
      requestRender('effects.sharpen');
      if (changed) announce();
    },

    diagnostics,

    on(event, cb) {
      if (event !== 'change') return () => {};
      return subscribe(listeners, cb);
    },
  };

  if (canModulation) {
    port.screenModulation = (sector) => {
      if (gone()) return;
      const wasActive = modulationSampler !== null;
      if (!sector) {
        if (!wasActive) return;
        modulationSampler = null;
        onModulationChange?.(null);
        requestRender('effects.screenModulation');
        announce();
        return;
      }
      const next = createSectorSampler(normalizeSector(sector));
      const same = modulationSampler && modulationSampler.key === next.key;
      modulationSampler = next;
      onModulationChange?.(next);
      if (!same || !wasActive) requestRender('effects.screenModulation');
      if (!wasActive) announce();
    };
  }

  return {
    port,
    getModulationSampler: () => modulationSampler,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopClock();
      listeners.length = 0;
      if (modulationSampler) {
        modulationSampler = null;
        onModulationChange?.(null);
      }
      if (!isDestroyed()) {
        for (const rec of styles.values()) {
          engine.remove_post_process_stage(rec.stageName);
        }
        if (sharpenInstalled) {
          engine.remove_post_process_stage('__gev_sharpen__');
        }
        if (bloomActive) {
          engine.set_bloom(false, 128, -0.3, 1, 2, 1);
        }
      }
      styles.clear();
      fading.clear();
    },
  };
}
