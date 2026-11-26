/**
 * @module render/cesiumrs/globe
 * @description Phase 2 globe port (`src/render/contract/globe.d.ts`) for the
 * CesiumRS renderer: `setBase`, `vectorBase`, `terrain`, `photoreal`,
 * `globeVisibility`, `surfaceIdentity`, `splitSwipe`, `surfaceShading`,
 * `sky`, `isSettled`, and `progress`.
 */
import { loadVectorStyle } from '../vectorBase/index.js';
import { createCesiumRsImagery } from './imagery.js';
import { createCesiumRsWeather } from './weather.js';

const GOOGLE_TILES_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';
const GOOGLE_ION_ASSET_ID = 2275207;
const WORLD_TERRAIN_ASSET_ID = 1;

let globalSurfaceVersions = 0;

function attributionText(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&copy;/gi, '©')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const clean = (value) => String(value || '').trim();

/**
 * Create the CesiumRS globe port over `BrowserScene` (`engine`).
 */
export function createCesiumRsGlobe(
  engine,
  {
    capabilities,
    credentials = {},
    initialSky,
    credits,
    camera,
    getSceneTime,
    requestRender,
    report,
    subscribe,
    deliver,
  },
) {
  const can = (cap) => capabilities.has(cap);
  let disposed = false;

  // ── Visibility & Surface Identity ────────────────────────────────────────
  let globeVisible = true;
  let terrainToken = { kind: 'ellipsoid' };
  let activePhotorealToken = null;
  let photorealVisible = false;
  let parkedPhotoreal = null; // { spec, status, token }
  let photorealStatus = { route: 'none' };
  let photorealSpec = null;
  let photorealGen = 0;
  let terrainGen = 0;
  let baseGen = 0;
  let drawnGen = 0;
  let baseLoad = null;
  let baseCredit = null;
  const vectorCredits = [];

  let surfaceVersion = 0;
  const surfaceSeen = { globe: null, terrain: null, tiles: null };

  function readSurfaceVersion() {
    const tilesShown = photorealVisible ? activePhotorealToken : null;
    if (
      surfaceSeen.globe !== globeVisible ||
      surfaceSeen.terrain !== terrainToken ||
      surfaceSeen.tiles !== tilesShown
    ) {
      surfaceSeen.globe = globeVisible;
      surfaceSeen.terrain = terrainToken;
      surfaceSeen.tiles = tilesShown;
      surfaceVersion = ++globalSurfaceVersions;
    }
    return surfaceVersion;
  }
  readSurfaceVersion();

  // ── Progress ─────────────────────────────────────────────────────────────
  const progressListeners = [];
  let lastProgressKey = '';
  let cachedTilesPending = 0;
  let cachedTerrainPending = 0;
  let progressMicrotaskQueued = false;

  function emitProgress(fromTick = false) {
    if (disposed || progressListeners.length === 0) return;
    if (fromTick) {
      cachedTerrainPending = globeVisible ? engine.globe_pending_tiles() : 0;
      cachedTilesPending =
        photorealVisible && !engine.photoreal_tiles_loaded() ? 1 : 0;
    }
    const imageryPending = imagery.pending();
    const key = `${cachedTilesPending}/${imageryPending}/${cachedTerrainPending}`;
    if (key === lastProgressKey) return;
    lastProgressKey = key;
    deliver(progressListeners, {
      tilesPending: cachedTilesPending,
      imageryPending,
      terrainPending: cachedTerrainPending,
    });
  }

  function scheduleProgressEmit() {
    if (progressMicrotaskQueued || disposed || progressListeners.length === 0)
      return;
    progressMicrotaskQueued = true;
    queueMicrotask(() => {
      progressMicrotaskQueued = false;
      emitProgress(false);
    });
  }

  // ── Imagery ──────────────────────────────────────────────────────────────
  const imagery = createCesiumRsImagery(engine, {
    capabilities,
    requestRender,
    report,
    subscribe,
    deliver,
    addCredit: (c) => credits.addStatic(c),
    isGlobeVisible: () => globeVisible,
    hasShownTileset: () => !disposed && photorealVisible,
    onPendingChange: scheduleProgressEmit,
  });

  // ── Sky ──────────────────────────────────────────────────────────────────
  const skyState = {
    atmosphere: false,
    stars: false,
    milkyWay: 0,
    sun: false,
    moon: false,
    fog: false,
    lighting: false,
  };
  if (initialSky) Object.assign(skyState, initialSky);
  engine.set_sky(skyState.atmosphere, skyState.fog, skyState.lighting);

  // ── Photoreal 3D Tiles ───────────────────────────────────────────────────
  async function setPhotoreal(spec) {
    const gen = ++photorealGen;
    if (!spec || !can('photoreal')) {
      if (spec) {
        engine.set_photoreal_tileset(null);
        activePhotorealToken = null;
        photorealVisible = false;
        photorealSpec = null;
        parkedPhotoreal = null;
      } else if (activePhotorealToken) {
        parkedPhotoreal = {
          spec: photorealSpec,
          status: photorealStatus,
          token: activePhotorealToken,
        };
        engine.set_photoreal_show(false);
        photorealVisible = false;
        photorealSpec = null;
      }
      photorealStatus = { route: 'none' };
      imagery.sync();
      requestRender('base');
      return photorealStatus;
    }

    if (parkedPhotoreal && parkedPhotoreal.spec === spec) {
      const kept = parkedPhotoreal;
      parkedPhotoreal = null;
      activePhotorealToken = kept.token;
      photorealVisible = true;
      photorealSpec = spec;
      photorealStatus = kept.status;
      engine.set_photoreal_show(true);
      imagery.sync();
      requestRender('base');
      return photorealStatus;
    }

    parkedPhotoreal = null;
    photorealSpec = null;
    activePhotorealToken = null;
    photorealVisible = false;
    engine.set_photoreal_tileset(null);
    photorealStatus = { route: 'none' };

    const googleApiKey = clean(
      spec.key ?? (spec.token ? '' : (credentials.googleApiKey ?? '')),
    );
    const tokenFn = spec.token ?? credentials.googleTokens ?? null;
    const ionToken = spec.fallback ? clean(credentials.worldDataToken) : '';

    const attempts = [];
    if (googleApiKey) {
      attempts.push({
        route: 'google',
        load: () =>
          engine.load_tileset_url(
            `${GOOGLE_TILES_ROOT}?key=${encodeURIComponent(googleApiKey)}`,
            null,
            'Google',
          ),
      });
    } else if (tokenFn) {
      attempts.push({
        route: 'google',
        load: async () => {
          const tok = await tokenFn();
          if (!tok) throw new Error('Google 3D tokens are not offered');
          return engine.load_tileset_url(
            GOOGLE_TILES_ROOT,
            `Bearer ${tok}`,
            'Google',
          );
        },
      });
    }
    if (ionToken) {
      attempts.push({
        route: 'fallback',
        load: () => engine.load_ion_tileset(GOOGLE_ION_ASSET_ID, ionToken),
      });
    }

    const errors = [];
    let loaded = null;
    let route = 'none';
    for (const attempt of attempts) {
      try {
        loaded = await attempt.load();
        route = attempt.route;
        break;
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    if (gen !== photorealGen || disposed) {
      loaded?.free?.();
      return photorealStatus;
    }

    if (!loaded) {
      const lastErr = errors.at(-1);
      photorealStatus = {
        route: 'none',
        error: {
          code: lastErr ? 'load-failed' : 'no-credentials',
          message: lastErr?.message ?? 'No photoreal credentials were given',
        },
      };
    } else {
      engine.set_photoreal_tileset(loaded);
      activePhotorealToken = { spec, route };
      photorealVisible = true;
      photorealSpec = spec;
      photorealStatus = { route };
    }
    imagery.sync();
    requestRender('base');
    return photorealStatus;
  }

  // ── Terrain ──────────────────────────────────────────────────────────────
  async function setTerrain(spec) {
    if (spec && spec.kind !== 'ellipsoid' && !can('terrain')) {
      throw new TypeError('This renderer draws no terrain');
    }
    const gen = ++terrainGen;
    const exaggeration = spec?.exaggeration ?? 1;
    if (!spec || spec.kind === 'ellipsoid') {
      if (disposed) return;
      engine.set_terrain_ellipsoid(exaggeration);
      terrainToken = { kind: 'ellipsoid' };
      requestRender('base');
      return;
    }
    let loaded;
    if (spec.kind === 'quantizedMesh') {
      if (typeof spec.url !== 'string' || !spec.url) {
        throw new TypeError('Quantized-mesh terrain needs its url');
      }
      loaded = await engine.load_terrain_url(
        spec.url,
        Boolean(spec.requestVertexNormals),
      );
    } else if (spec.kind === 'world') {
      const token = clean(credentials.worldDataToken);
      if (!token) {
        throw new TypeError(
          'World terrain needs the renderer’s world data token',
        );
      }
      loaded = await engine.load_ion_terrain(
        WORLD_TERRAIN_ASSET_ID,
        token,
        Boolean(spec.requestVertexNormals),
      );
    } else {
      throw new TypeError(`Unknown terrain kind: ${spec.kind}`);
    }

    if (gen !== terrainGen || disposed) {
      loaded?.free?.();
      return;
    }
    engine.apply_loaded_terrain(loaded, exaggeration);
    loaded.free?.();
    terrainToken = { kind: spec.kind, url: spec.url ?? null };
    requestRender('base');
  }

  // ── Base ─────────────────────────────────────────────────────────────────
  async function setBase(base) {
    if (base?.vector && !can('vectorBase')) {
      throw new TypeError('This renderer draws no vector base');
    }
    const gen = ++baseGen;
    baseLoad?.abort();
    baseLoad = null;
    const current = () => gen === baseGen && !disposed;
    const superseded = () => ({
      photoreal: photorealStatus,
      imagery: [],
      settled: false,
    });
    if (disposed) return superseded();

    let style = null;
    if (base?.vector) {
      const load = new AbortController();
      baseLoad = load;
      try {
        style = await loadVectorStyle(base.vector.styleUrl, undefined, {
          signal: load.signal,
        });
      } catch (error) {
        if (!current()) return superseded();
        throw error;
      } finally {
        if (baseLoad === load) baseLoad = null;
      }
      if (!current()) return superseded();
    }

    drawnGen = gen;
    for (const handle of imagery.list()) handle.remove();
    baseCredit?.();
    baseCredit = base?.credit ? credits.addStatic(base.credit) : null;
    for (const off of vectorCredits.splice(0)) off();

    if (style) {
      imagery.add({ kind: 'vectorStyle', style }, undefined, { base: true });
      for (const text of (style.attribution ?? []).map(attributionText)) {
        if (text) vectorCredits.push(credits.addStatic({ text }));
      }
    }

    const loads = [];
    if (base?.photoreal !== undefined) loads.push(setPhotoreal(base.photoreal));
    if (base?.terrain !== undefined) loads.push(setTerrain(base.terrain));
    const layers = (base?.imagery ?? []).map((spec) =>
      imagery.add(spec, undefined, { base: true }),
    );
    await Promise.all(loads);
    requestRender('base');
    return {
      photoreal: photorealStatus,
      imagery: layers,
      settled: gen === drawnGen && !disposed && isSettled('base'),
    };
  }

  // ── Settling ─────────────────────────────────────────────────────────────
  const terrainLoaded = () => !globeVisible || engine.tiles_loaded();
  const tilesLoaded = () => engine.photoreal_tiles_loaded();
  const imageryLoaded = () => imagery.pending() === 0 && terrainLoaded();

  function surfaceLoaded() {
    if (globeVisible) return engine.tiles_loaded();
    if (!photorealVisible) return false;
    return engine.photoreal_tiles_loaded();
  }

  function isSettled(kind) {
    if (disposed) return true;
    if (kind === 'surface' && can('surfaceIdentity')) return surfaceLoaded();
    if (kind === 'terrain') return terrainLoaded();
    if (kind === 'tiles') return tilesLoaded();
    if (kind === 'imagery') return imageryLoaded();
    return terrainLoaded() && tilesLoaded() && imageryLoaded();
  }

  // ── Surface Shading ──────────────────────────────────────────────────────
  function setSurfaceShading(next) {
    if (next && next.kind !== 'hillshade') {
      throw new TypeError(`This renderer has no ${next.kind} shading`);
    }
    if (disposed) return;
    if (next) {
      const strength = Math.min(1, Math.max(0, Number(next.strength) || 0));
      engine.set_surface_shading(true, strength);
    } else {
      engine.set_surface_shading(false, 0);
    }
    requestRender('base');
  }

  // ── Port ─────────────────────────────────────────────────────────────────
  const port = {
    setBase,
    setPhotoreal,
    setTerrain,
    setGlobeVisible(visible) {
      globeVisible = Boolean(visible);
      if (!disposed) engine.set_globe_visible(globeVisible);
      imagery.sync();
      requestRender('globe.visible');
    },
    imagery: {
      add: (spec, index) => imagery.add(spec, index),
      list: imagery.list,
    },
    sky: {
      get: () => ({ ...skyState }),
      set(settings) {
        if (!settings) return;
        for (const key of Object.keys(skyState)) {
          if (key in settings && settings[key] !== undefined)
            skyState[key] = settings[key];
        }
        if (!disposed)
          engine.set_sky(skyState.atmosphere, skyState.fog, skyState.lighting);
        requestRender('globe.sky');
      },
    },
    isSettled,
    on(event, cb) {
      if (event !== 'progress') return () => {};
      return subscribe(progressListeners, cb);
    },
  };

  const weatherPart = can('weather')
    ? createCesiumRsWeather(engine, {
        camera,
        getSceneTime,
        requestRender,
        report,
        isDestroyed: () => disposed,
      })
    : null;

  if (can('globeVisibility')) port.isGlobeVisible = () => globeVisible;
  if (can('surfaceIdentity')) port.surfaceVersion = readSurfaceVersion;
  if (can('surfaceShading')) port.setSurfaceShading = setSurfaceShading;
  if (can('splitSwipe')) {
    port.imagery.getSplit = () => (disposed ? 0 : engine.get_split_position());
    port.imagery.setSplit = (x01) => {
      if (disposed) return;
      engine.set_split_position(Math.min(1, Math.max(0, Number(x01))));
      requestRender('imagery');
    };
  }
  if (weatherPart) port.weather = weatherPart.port;

  return {
    port,
    imagery,
    emitProgress,
    stepWeather: () => weatherPart?.stepFrame(),
    dispose() {
      if (disposed) return;
      disposed = true;
      photorealGen += 1;
      terrainGen += 1;
      baseGen += 1;
      baseLoad?.abort();
      baseLoad = null;
      parkedPhotoreal = null;
      activePhotorealToken = null;
      weatherPart?.dispose();
      imagery.dispose();
      baseCredit?.();
      baseCredit = null;
      for (const off of vectorCredits.splice(0)) off();
      progressListeners.length = 0;
    },
  };
}
