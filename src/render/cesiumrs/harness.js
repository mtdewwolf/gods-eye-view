/**
 * @module render/cesiumrs/harness
 * @description Conformance harness for the CesiumRS renderer in
 * `/dev/conformance/`.
 */
import { DEFAULT_TOLERANCE } from '../conformance/index.js';
import { toEcef } from '../stub/math.js';
import {
  createCesiumRsRenderer,
  hasPendingDecodesOf,
  manualTickerOf,
  pointerFeedOf,
  scriptHeightsSetterOf,
} from './renderer.js';

const FRAME_MS = 1000 / 60;

/**
 * Build a standard `ConformanceHarness` over `createCesiumRsRenderer`.
 * @param {string} [name]
 * @returns {import('../conformance/index.js').ConformanceHarness}
 */
export function createCesiumRsConformanceHarness(
  name = 'cesiumrs',
  { model, modelNode, missingModel } = {},
) {
  const state = new WeakMap();

  return {
    name,
    async create({ viewport, capabilities }) {
      const container = document.createElement('div');
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      document.body.appendChild(container);

      let now = 0;
      const wallStart = Date.UTC(2026, 5, 21, 18, 0, 0);
      const clock = {
        now: () => now,
        date: () => wallStart + now,
      };

      const r = await createCesiumRsRenderer({
        container,
        viewport,
        capabilities,
        time: wallStart,
        clock,
        manualLoop: true,
        signal: new AbortController().signal,
        onDestroy: () => container.remove(),
      });
      state.set(r, {
        container,
        getNow: () => now,
        stepNow: () => {
          now += FRAME_MS;
        },
        wallTime: () => wallStart + now,
        tick: manualTickerOf(r),
        feed: pointerFeedOf(r),
      });
      return r;
    },
    resizeContainer(r, { width, height }) {
      const s = state.get(r);
      if (!s) return;
      s.container.style.width = `${width}px`;
      s.container.style.height = `${height}px`;
    },
    async frame(r) {
      const s = state.get(r);
      if (!s) return;
      if (hasPendingDecodesOf(r)) {
        const deadline = Date.now() + 200;
        while (hasPendingDecodesOf(r) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 4));
        }
      }
      s.stepNow();
      s.tick();
    },
    now: (r) => state.get(r)?.getNow() ?? 0,
    wallTime: (r) => state.get(r)?.wallTime() ?? 0,
    toEcef,
    tolerance: DEFAULT_TOLERANCE,
    flightPaths: 'trace',
    pixels: true,
    cameraInput: true,
    pointer(r, type, x, y, extra) {
      state.get(r)?.feed?.(type, x, y, extra);
    },
    scriptHeights(r, fn) {
      scriptHeightsSetterOf(r)?.(fn);
    },
    ...(model
      ? {
          assets: {
            model,
            ...(modelNode ? { modelNode } : {}),
            missingModel,
            modelBytes: async () =>
              new Uint8Array(await (await fetch(model)).arrayBuffer()),
          },
        }
      : {}),
  };
}
