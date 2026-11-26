/**
 * @module testSupport/cesiumFrame
 * @description A frame port over a Cesium-shaped scene double: its own
 * `preUpdate`, `preRender` and `postRender` events are the phases, its
 * `requestRender` draws, and continuous holds are counted here.
 */
import { provideUnboundFrame } from '../render/rendererOf.js';

function listen(source, cb) {
  const off = source?.addEventListener?.(cb);
  if (typeof off === 'function') return off;
  return () => source?.removeEventListener?.(cb);
}

/** A frame port over `viewer`'s scene. */
export function fakeFramePort(viewer) {
  const scene = viewer.scene ?? viewer;
  const holds = new Set();
  const heldListeners = new Set();
  let frames = 0;
  let rendered = 0;
  let reasons = [];
  let suspended = false;
  let frame = 0;
  let last = 0;

  const fireHold = () => {
    for (const cb of [...heldListeners]) cb(holds.size > 0);
  };

  return {
    on(phase, cb) {
      return listen(scene?.[phase], (time) => {
        if (phase === 'preUpdate') {
          const now = Date.now();
          frame += 1;
          frames += 1;
          const dt = last ? (now - last) / 1000 : 0;
          last = now;
          const didRender =
            holds.size > 0 || reasons.length > 0 || frame % 60 === 0;
          rendered += didRender ? 1 : 0;
          return cb({
            frame,
            now,
            time: now,
            dt,
            rendering: didRender,
          });
        }
        return cb({
          frame,
          now: Date.now(),
          time: Date.now(),
          dt: 0,
          rendering: true,
        });
      });
    },
    requestRender(reason = '') {
      reasons.push(reason);
      scene?.requestRender?.();
    },
    holdContinuous(reason) {
      const hold = { reason };
      holds.add(hold);
      if (holds.size === 1) fireHold();
      return () => {
        if (!holds.delete(hold)) return;
        if (holds.size === 0) fireHold();
      };
    },
    onHeldChange(cb) {
      heldListeners.add(cb);
      return () => heldListeners.delete(cb);
    },
    mode: () => 'demand',
    diagnostics: () => ({
      mode: 'demand',
      frames,
      rendered,
      pendingReasons: [...reasons],
      holds: [...holds].map((hold) => hold.reason),
      suspended,
      targetFps: 0,
    }),
    suspend(hidden) {
      suspended = Boolean(hidden);
    },
    setTargetFps() {},
    time: () => Date.now(),
    endFrame() {
      reasons = [];
    },
  };
}

// A Cesium-shaped viewer with no renderer bound gets a frame port when code
// first asks `findFrame` for one.
provideUnboundFrame((viewer) => {
  const scene = viewer?.scene;
  // By shape, as the default renderer's adapter asked: only a viewer with a
  // full frame loop (each phase, a forced render and a clock) gets one.
  if (
    !scene ||
    ['preUpdate', 'preRender', 'postRender'].some(
      (phase) => typeof scene[phase]?.addEventListener !== 'function',
    ) ||
    typeof scene.requestRender !== 'function' ||
    typeof scene.forceRender !== 'function' ||
    !viewer.clock
  )
    return null;
  return { port: fakeFramePort(viewer), dispose() {} };
});
