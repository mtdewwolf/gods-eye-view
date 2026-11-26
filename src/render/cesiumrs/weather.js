/**
 * @module render/cesiumrs/weather
 * @description Phase 3 `weather` capability for the CesiumRS globe port:
 * deterministic scene-time procedural clouds drifting with wind, plus distance
 * fog, haze, rain, and snow rendered as an internal post-process stage that
 * is never picked and never enters height queries.
 */
import { toCartographicRadians } from '../stub/math.js';

const WEATHER_STAGE_NAME = '__gev_weather__';

const WEATHER_SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform float u_clouds;
uniform float u_fog;
uniform float u_haze;
uniform float u_rain;
uniform float u_snow;
uniform float u_camHeight;
uniform vec3 u_camDir;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform vec3 u_localUp;
uniform vec3 u_localEast;
uniform vec3 u_localNorth;
uniform vec2 u_tanHalfFov;
uniform vec2 u_windDrift;
uniform float u_timeSec;
in vec2 v_textureCoordinates;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = p * 2.07 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec4 base = texture(colorTexture, uv);
  vec3 col = base.rgb;

  vec2 ndc = uv * 2.0 - 1.0;
  vec3 ray = normalize(
    u_camDir +
    u_camRight * (ndc.x * u_tanHalfFov.x) +
    u_camUp * (ndc.y * u_tanHalfFov.y)
  );
  float elev = dot(ray, u_localUp);
  float lowFade = 1.0 - smoothstep(150000.0, 600000.0, u_camHeight);

  // Distance fog and haze strengthen toward the horizon when below orbit.
  float horizonBand = 1.0 - smoothstep(0.02, 0.55, abs(elev));
  float fogAmt = clamp(u_fog * (0.35 + 0.55 * horizonBand) * lowFade, 0.0, 0.92);
  float hazeAmt = clamp(u_haze * (0.18 + 0.42 * horizonBand) * lowFade, 0.0, 0.65);
  col = mix(col, vec3(0.76, 0.80, 0.85), fogAmt);
  col = mix(col, vec3(0.68, 0.74, 0.82), hazeAmt);

  // Procedural cloud deck at ~2400 m above ground, drifting deterministically with scene time and wind.
  if (u_clouds > 0.001) {
    float cloudAlt = 2400.0;
    float dAlt = cloudAlt - u_camHeight;
    float tHit = (abs(elev) > 0.015) ? (dAlt / elev) : -1.0;
    if (tHit > 0.0 && tHit < 180000.0) {
      vec3 hitOffset = ray * tHit;
      vec2 planeKm = vec2(dot(hitOffset, u_localEast), dot(hitOffset, u_localNorth)) * 0.00045;
      vec2 drifted = planeKm - u_windDrift * 0.00045;
      float n = fbm(drifted);
      float thresh = mix(0.76, 0.14, u_clouds);
      float density = smoothstep(thresh, thresh + 0.28, n);
      float distFade = 1.0 - smoothstep(45000.0, 160000.0, tHit);
      float alpha = clamp(density * distFade * (0.35 + 0.62 * u_clouds), 0.0, 0.96);
      vec3 cloudCol = mix(vec3(0.72, 0.76, 0.82), vec3(0.95, 0.97, 0.99), smoothstep(0.25, 0.85, n));
      col = mix(col, cloudCol, alpha);
    }
  }

  // Rain and snow streaks near eye below cloud deck.
  float precipAlt = 1.0 - smoothstep(1800.0, 3200.0, u_camHeight);
  if (u_rain > 0.001 && precipAlt > 0.01) {
    vec2 p = vec2(uv.x * 90.0 + u_timeSec * 0.4, uv.y * 18.0 + u_timeSec * 6.0);
    float s = smoothstep(0.84, 0.98, noise2(p));
    col = mix(col, vec3(0.78, 0.85, 0.94), s * u_rain * precipAlt * 0.35);
  }
  if (u_snow > 0.001 && precipAlt > 0.01) {
    vec2 p = vec2(uv.x * 65.0 + u_timeSec * 0.6, uv.y * 45.0 + u_timeSec * 2.2);
    float s = smoothstep(0.82, 0.97, noise2(p));
    col = mix(col, vec3(0.96, 0.98, 1.0), s * u_snow * precipAlt * 0.45);
  }

  out_FragColor = vec4(col, base.a);
}
`;

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const wrapDeg = (deg) => {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
};

/**
 * Create the CesiumRS `globe.weather` controller.
 */
export function createCesiumRsWeather(
  engine,
  { camera, getSceneTime, requestRender, report, isDestroyed },
) {
  const state = {
    clouds: 0,
    fog: 0,
    haze: 0,
    rain: 0,
    snow: 0,
    wind: { speedMps: 0, fromDeg: 0 },
  };
  let installed = false;
  let enabled = false;

  const isActive = () =>
    state.clouds > 0 ||
    state.fog > 0 ||
    state.haze > 0 ||
    state.rain > 0 ||
    state.snow > 0;

  function buildUniforms() {
    const pose = camera.port.pose();
    const carto = toCartographicRadians(pose.position);
    const lon = carto.lon;
    const lat = carto.lat;
    const sinLon = Math.sin(lon);
    const cosLon = Math.cos(lon);
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const localEast = [-sinLon, cosLon, 0];
    const localNorth = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
    const localUp = [cosLat * cosLon, cosLat * sinLon, sinLat];
    const tanY = Math.tan((pose.fovy || Math.PI / 3) * 0.5);
    const tanX = tanY * (pose.aspectRatio || 1);

    // Wind blows FROM `fromDeg` (clockwise from north), so drift is toward `(fromDeg + 180)`.
    const toRad = ((state.wind.fromDeg + 180) * Math.PI) / 180;
    const timeSec = (getSceneTime() % 86_400_000) / 1000;
    const speed = state.wind.speedMps;
    const driftE = Math.sin(toRad) * speed * timeSec;
    const driftN = Math.cos(toRad) * speed * timeSec;

    return {
      u_clouds: state.clouds,
      u_fog: state.fog,
      u_haze: state.haze,
      u_rain: state.rain,
      u_snow: state.snow,
      u_camHeight: Math.max(0, carto.height),
      u_camDir: [pose.direction.x, pose.direction.y, pose.direction.z],
      u_camRight: [pose.right.x, pose.right.y, pose.right.z],
      u_camUp: [pose.up.x, pose.up.y, pose.up.z],
      u_localUp: localUp,
      u_localEast: localEast,
      u_localNorth: localNorth,
      u_tanHalfFov: [tanX, tanY],
      u_windDrift: [driftE, driftN],
      u_timeSec: timeSec,
    };
  }

  function syncStage() {
    if (isDestroyed()) return;
    const active = isActive();
    if (!active) {
      if (installed && enabled) {
        enabled = false;
        engine.set_post_process_stage_enabled(WEATHER_STAGE_NAME, false);
      }
      return;
    }
    const uniforms = buildUniforms();
    try {
      if (!installed) {
        engine.add_post_process_stage(
          WEATHER_STAGE_NAME,
          WEATHER_SHADER,
          JSON.stringify(uniforms),
          true,
        );
        installed = true;
        enabled = true;
      } else {
        if (!enabled) {
          enabled = true;
          engine.set_post_process_stage_enabled(WEATHER_STAGE_NAME, true);
        }
        engine.set_post_process_stage_uniforms(
          WEATHER_STAGE_NAME,
          JSON.stringify(uniforms),
        );
      }
    } catch (error) {
      report(error);
    }
  }

  const port = {
    get() {
      return {
        clouds: state.clouds,
        fog: state.fog,
        haze: state.haze,
        rain: state.rain,
        snow: state.snow,
        wind: { speedMps: state.wind.speedMps, fromDeg: state.wind.fromDeg },
      };
    },
    set(patch) {
      if (!patch || typeof patch !== 'object') return;
      if ('clouds' in patch) state.clouds = clamp01(patch.clouds);
      if ('fog' in patch) state.fog = clamp01(patch.fog);
      if ('haze' in patch) state.haze = clamp01(patch.haze);
      if ('rain' in patch) state.rain = clamp01(patch.rain);
      if ('snow' in patch) state.snow = clamp01(patch.snow);
      if (patch.wind && typeof patch.wind === 'object') {
        if ('speedMps' in patch.wind)
          state.wind.speedMps = Math.max(0, Number(patch.wind.speedMps) || 0);
        if ('fromDeg' in patch.wind)
          state.wind.fromDeg = wrapDeg(patch.wind.fromDeg);
      }
      syncStage();
      requestRender('globe.weather');
    },
  };

  return {
    port,
    stepFrame() {
      if (enabled || isActive()) syncStage();
    },
    dispose() {
      if (installed && !isDestroyed()) {
        engine.remove_post_process_stage(WEATHER_STAGE_NAME);
      }
      installed = false;
      enabled = false;
    },
  };
}
