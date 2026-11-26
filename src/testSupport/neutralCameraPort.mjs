/** A settable camera contract double for tests. */
import { createCameraEvents } from '../render/camera/events.js';

const DEFAULT_POSE = Object.freeze({
  lon: 0,
  lat: 0,
  height: 1000,
  heading: 0,
  pitch: -Math.PI / 2,
  roll: 0,
  position: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  right: { x: 1, y: 0, z: 0 },
  fovy: Math.PI / 3,
  aspectRatio: 1,
  near: 1,
  far: 5e8,
  frameIsIdentity: true,
});

/**
 * @param {{pose?: object, viewRectangle?: object|null}} [initial]
 */
export function fakeCameraPort({ pose = {}, viewRectangle = null } = {}) {
  let current = { ...DEFAULT_POSE, ...pose };
  let rect = viewRectangle;
  const events = createCameraEvents({
    pose: () => ({ ...current }),
    report: (error) => {
      throw error;
    },
  });
  const counts = {};
  const port = {
    pose: () => ({ ...current }),
    viewRectangle: () => (rect ? { ...rect } : null),
    on(event, cb, options) {
      const off = events.on(event, cb, options);
      counts[event] = (counts[event] ?? 0) + 1;
      let live = true;
      return () => {
        if (live) counts[event] -= 1;
        live = false;
        off();
      };
    },
  };
  return {
    port,
    /** Change the pose the port reports. */
    setPose: (fields) => (current = { ...current, ...fields }),
    setViewRectangle: (next) => (rect = next),
    emit: (event) => events.emit(event),
    /** Run the contract's `changed` measure, as a frame would. */
    stepChanged: () => events.stepChanged(),
    listenerCount: (event) => counts[event] ?? 0,
  };
}
