/**
 * @module testSupport/cesiumCamera
 * @description The camera port over a Cesium-shaped camera double, ported
 * from the default renderer's adapter so tests that still hand their code a
 * Cesium-shaped viewer keep the camera behaviour they wrote against. No
 * engine: views, flights, looks and events map onto the double's own
 * Cesium-shaped calls, and the maths they need comes from `cesiumrsCompat`
 * (itself over `src/geo`).
 *
 * A viewer with no renderer bound gets a port over its camera when code
 * first asks `cameraOf` for one; the port wraps the viewer's `clock.tick`
 * to measure `changed`, and gives it back when a renderer is bound.
 */
import * as Cesium from './cesiumrsCompat.mjs';
import { createCameraEvents } from '../render/camera/events.js';
import { computeViewRectangle } from '../render/stub/viewRectangle.js';
import { findCamera, provideUnboundCamera } from '../render/rendererOf.js';
import {
  listenerList,
  pickEllipsoidAt,
  sameEye,
  toCartesian,
  uncaught,
} from './cesiumCommon.mjs';

export { findCamera };

// Loads the other unbound factories, as the default renderer's camera
// module did: a viewer with no renderer bound gets its input port, its
// click picks, its query port and its globe port too.
import './cesiumInput.mjs';
import './cesiumNativeClick.mjs';
import './cesiumQuery.mjs';
import './cesiumGlobe.mjs';
import './cesiumFrame.mjs';

/** The contract's easings as Cesium's. */
export const EASINGS = Object.freeze({
  linear: Cesium.EasingFunction.LINEAR_NONE,
  quadraticInOut: Cesium.EasingFunction.QUADRATIC_IN_OUT,
  cubicInOut: Cesium.EasingFunction.CUBIC_IN_OUT,
  cubicOut: Cesium.EasingFunction.CUBIC_OUT,
  quadraticOut: Cesium.EasingFunction.QUADRATIC_OUT,
  quinticInOut: Cesium.EasingFunction.QUINTIC_IN_OUT,
  sineInOut: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
});

/** A contract destination as Cesium's: a Cartesian3, or a Rectangle. */
export function toDestination(d) {
  if ('rect' in d) {
    const r = d.rect;
    return Cesium.Rectangle.fromDegrees(r.west, r.south, r.east, r.north);
  }
  return toCartesian(d);
}

/** A contract orientation as Cesium's; omitted angles are as the contract says. */
export function toOrientation(o = {}) {
  if ('direction' in o)
    return { direction: toCartesian(o.direction), up: toCartesian(o.up) };
  return {
    heading: o.heading ?? 0,
    pitch: o.pitch ?? -Math.PI / 2,
    roll: o.roll ?? 0,
  };
}

/** The follow offset of a camera that cannot follow. */
const NO_FOLLOW_OFFSET = Object.freeze({ get: () => null, set() {} });

/** A Cesium matrix's 16 values, column by column. */
function matrixArray(matrix) {
  const out = new Float64Array(16);
  for (let i = 0; i < 16; i++) out[i] = matrix[i];
  return out;
}

/** Whether `array` holds a Cesium matrix's 16 values, each the same. */
function sameMatrix(array, matrix) {
  for (let i = 0; i < 16; i++)
    if (!Object.is(array[i], matrix[i])) return false;
  return true;
}

const finiteVector = (v) =>
  !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

/** Whether a Cesium camera has a flight under way. */
export const cameraFlightActive = (camera) => camera?._currentFlight != null;

/** Conservative globe/frustum visibility; null means unknown. */
export function createPointsVisibility(scene, camera) {
  const visibilitySphere = new Cesium.BoundingSphere();
  let visibilityMargin = null;
  let visibilityEllipsoid = null;
  let visibilityOccluder = null;
  return function visiblePoints(points, marginM) {
    const eye = camera.positionWC;
    const direction = camera.directionWC;
    const up = camera.upWC;
    if (
      scene.mode !== Cesium.SceneMode.SCENE3D ||
      !points?.length ||
      !finiteVector(eye) ||
      !finiteVector(direction) ||
      !finiteVector(up) ||
      !points.every(finiteVector)
    )
      return null;
    if (visibilityMargin !== marginM) {
      const radii = Cesium.Ellipsoid.WGS84.radii;
      visibilityMargin = marginM;
      visibilityEllipsoid = new Cesium.Ellipsoid(
        radii.x - marginM,
        radii.y - marginM,
        radii.z - marginM,
      );
      visibilityOccluder = new Cesium.EllipsoidalOccluder(visibilityEllipsoid);
    }
    const inverse = visibilityEllipsoid.oneOverRadii;
    const outside =
      Math.hypot(eye.x * inverse.x, eye.y * inverse.y, eye.z * inverse.z) >= 1;
    if (outside) {
      visibilityOccluder.cameraPosition = eye;
      let visible = false;
      for (const p of points) {
        if (visibilityOccluder.isPointVisible(p)) {
          visible = true;
          break;
        }
      }
      if (!visible) return false;
    }
    const frustum = camera.frustum;
    if (typeof frustum?.computeCullingVolume === 'function') {
      const culling = frustum.computeCullingVolume(eye, direction, up);
      return (
        culling.computeVisibility(
          Cesium.BoundingSphere.fromPoints(points, visibilitySphere),
        ) !== Cesium.Intersect.OUTSIDE
      );
    }
    return null;
  };
}

const HALF_PI = Math.PI / 2;

const { WHEEL, PINCH, RIGHT_DRAG } = Cesium.CameraEventType;
const { CTRL } = Cesium.KeyboardEventModifier;

const ZOOM_BINDINGS = Object.freeze({
  wheel: WHEEL,
  pinch: PINCH,
  rightDrag: RIGHT_DRAG,
  ctrlWheel: Object.freeze({ eventType: WHEEL, modifier: CTRL }),
});

function zoomInputName(binding) {
  const type = binding?.eventType ?? binding;
  const modifier = binding?.modifier;
  if (modifier === undefined) {
    if (type === WHEEL) return 'wheel';
    if (type === PINCH) return 'pinch';
    if (type === RIGHT_DRAG) return 'rightDrag';
    return null;
  }
  return type === WHEEL && modifier === CTRL ? 'ctrlWheel' : null;
}

const bindingList = (types) =>
  Array.isArray(types) ? types : types === undefined ? [] : [types];

const coastToInertia = (seconds) => (seconds > 0 ? 1 - 1 / (25 * seconds) : 1);
const inertiaToCoast = (c) =>
  Number.isFinite(c) && c < 1 ? 1 / (25 * (1 - c)) : 0;

/** The controller a scene without one of its own reads back. */
export const controllerDefaults = () => ({
  enableInputs: true,
  enableTilt: true,
  enableRotate: true,
  enableZoom: true,
  inertiaSpin: 0.9,
  inertiaTranslate: 0.9,
  inertiaZoom: 0.8,
  minimumZoomDistance: 1,
  maximumZoomDistance: Number.POSITIVE_INFINITY,
  zoomFactor: 5,
  zoomEventTypes: [RIGHT_DRAG, WHEEL, PINCH],
  enableCollisionDetection: true,
  maximumTiltAngle: undefined,
});

/** One set of holds per controller, shared by the camera and input ports. */
const cameraInputs = new WeakMap();

/** Take over a controller's `enableInputs` for counted holds. */
function ownCameraInput(controller, holds) {
  if (!controller) return () => {};
  const own = Object.getOwnPropertyDescriptor(controller, 'enableInputs');
  if (own && !own.configurable) return () => {};
  // A class may define it on its prototype; the hold shadows that for a while.
  let original = own;
  for (let proto = Object.getPrototypeOf(controller); !original && proto;) {
    original = Object.getOwnPropertyDescriptor(proto, 'enableInputs');
    proto = Object.getPrototypeOf(proto);
  }
  original ??= { value: true, writable: true, enumerable: true };
  let written = Boolean(original.get ? true : original.value);
  const read = () =>
    original.get ? Boolean(original.get.call(controller)) : written;
  Object.defineProperty(controller, 'enableInputs', {
    configurable: true,
    enumerable: original.enumerable ?? true,
    get: () => read() && holds.size === 0,
    set: (value) => {
      written = Boolean(value);
      original.set?.call(controller, value);
    },
  });
  return () => {
    delete controller.enableInputs;
    if (own?.get || own?.set)
      Object.defineProperty(controller, 'enableInputs', own);
    else if (own || !(original.get || original.set))
      controller.enableInputs = written;
  };
}

/** Counted camera-input holds over a scene's controller. */
export function acquireCameraInput(scene) {
  const controller = scene?.screenSpaceCameraController;
  const key = controller ?? scene;
  let state = key && typeof key === 'object' ? cameraInputs.get(key) : null;
  if (!state) {
    const holds = new Set();
    state = {
      holds,
      users: 0,
      restore: ownCameraInput(controller, holds),
    };
    if (key && typeof key === 'object') cameraInputs.set(key, state);
  }
  const s = state;
  s.users += 1;
  const mine = new Set();
  let released = false;
  return {
    suspend(reason) {
      if (released) return () => {};
      const hold = { reason: String(reason) };
      s.holds.add(hold);
      mine.add(hold);
      return () => {
        if (!mine.delete(hold)) return;
        s.holds.delete(hold);
      };
    },
    get enabled() {
      return s.holds.size === 0;
    },
    reasons: () => [...s.holds].map((hold) => hold.reason),
    release() {
      if (released) return;
      released = true;
      for (const hold of mine) s.holds.delete(hold);
      mine.clear();
      s.users -= 1;
      if (s.users > 0) return;
      s.restore();
      if (cameraInputs.get(key) === s) cameraInputs.delete(key);
    },
  };
}

/**
 * @param {{scene: object, camera: object, report: (error: unknown) => void,
 *   widget?: object, capabilities?: ReadonlySet<string>,
 *   now?: () => number, itemPosition?: Function}} options
 * @returns {{port: object, measureChanged: () => void,
 *   emit: (event: string) => void, dispose: () => void}}
 */
export function createCesiumCamera({
  scene,
  camera,
  report,
  widget,
  capabilities,
  now = () => performance.now(),
  itemPosition,
}) {
  const removers = [];
  let lastWorld = null;
  let lastMatrices = null;
  let lastFollowFrame = null;
  const eye = { position: null, direction: null, up: null };
  const cameraEvents = createCameraEvents({
    pose: () => sharedPose(),
    world: () => {
      const f = camera.frustum;
      eye.position = camera.positionWC;
      eye.direction = camera.directionWC;
      eye.up = camera.upWC;
      if (
        lastWorld &&
        Object.is(lastWorld.fovy, f.fovy) &&
        Object.is(lastWorld.aspectRatio, f.aspectRatio) &&
        sameEye(eye, lastWorld)
      )
        return lastWorld;
      lastWorld = {
        position: Cesium.Cartesian3.clone(eye.position),
        direction: Cesium.Cartesian3.clone(eye.direction),
        up: Cesium.Cartesian3.clone(eye.up),
        fovy: f.fovy,
        aspectRatio: f.aspectRatio,
        lens: `${f.fovy} ${f.aspectRatio}`,
      };
      return lastWorld;
    },
    report,
    thresholds: capabilities?.has('cameraChangeThreshold') ?? true,
  });
  let measured = false;
  const measureChanged = () => {
    if (measured) return;
    measured = true;
    applyFov();
    cameraEvents.stepChanged();
  };
  const clock = widget?.clock;
  if (typeof clock?.tick === 'function') {
    const ownTick = clock.tick;
    let wrapping = true;
    const tick = function (...args) {
      if (wrapping) {
        measured = false;
        measureChanged();
      }
      return ownTick.apply(this, args);
    };
    clock.tick = tick;
    removers.push(() => {
      wrapping = false;
      if (clock.tick !== tick) return;
      if (Object.getPrototypeOf(clock)?.tick === ownTick) delete clock.tick;
      else clock.tick = ownTick;
    });
  }
  const offPreUpdate = scene.preUpdate?.addEventListener?.(measureChanged);
  if (offPreUpdate) removers.push(offPreUpdate);
  const offPostUpdate = scene.postUpdate?.addEventListener?.(() => {
    applyFov();
    measureChanged();
    cameraEvents.stepMoveDetection(now());
    measured = false;
  });
  if (offPostUpdate) removers.push(offPostUpdate);

  const following = createFollow({
    widget,
    scene,
    camera,
    onChanged: () => cameraEvents.emit('followChanged'),
    itemPosition,
    now,
  });

  const commandHooks = listenerList(report);
  const command = (kind) => commandHooks.fire({ kind });

  const controlsPart = createControls({
    scene,
    widget,
    onCommand: (cb) => commandHooks.on(cb),
  });

  let flight = null;
  let inCesiumCall = 0;
  const pendingEnds = [];
  function cesiumCall(fn) {
    inCesiumCall += 1;
    try {
      return fn();
    } finally {
      inCesiumCall -= 1;
      if (inCesiumCall === 0)
        for (const deliver of pendingEnds.splice(0)) deliver();
    }
  }

  function startFlight(start, options) {
    let resolve;
    const done = new Promise((r) => (resolve = r));
    let ended = false;
    const handle = {
      done,
      cancel() {
        if (flight === handle) cesiumCall(() => camera.cancelFlight());
      },
    };
    const end = (outcome) => {
      if (ended) return;
      ended = true;
      if (flight === handle) flight = null;
      const deliver = () => {
        const cb =
          outcome === 'complete' ? options.onComplete : options.onCancel;
        try {
          cb?.();
        } catch (error) {
          report(error);
        }
        resolve(outcome);
        cameraEvents.emit('flightEnd');
      };
      if (inCesiumCall) pendingEnds.push(deliver);
      else deliver();
    };
    flight = handle;
    cesiumCall(() =>
      start({
        complete: () => end('complete'),
        cancel: () => end('cancelled'),
      }),
    );
    if (!ended && !cameraFlightActive(camera)) end('cancelled');
    scene.requestRender?.();
    return handle;
  }

  let heldFovy = null;
  let ownFov = null;
  function applyFov() {
    const frustum = camera.frustum;
    const aspect = frustum?.aspectRatio;
    if (heldFovy === null || !('fov' in frustum) || !(aspect > 0)) return;
    const fov =
      aspect > 1 ? 2 * Math.atan(Math.tan(heldFovy / 2) * aspect) : heldFovy;
    if (frustum.fov !== fov) frustum.fov = fov;
  }

  function placeEye(destination, { direction, up }) {
    const at = toCartesian(destination);
    const dir = Cesium.Cartesian3.normalize(
      toCartesian(direction),
      new Cesium.Cartesian3(),
    );
    const right = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(dir, toCartesian(up), new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    );
    const square = Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3());
    const transform = camera.transform;
    if (
      transform &&
      !Cesium.Matrix4.equals(transform, Cesium.Matrix4.IDENTITY)
    ) {
      const inverse = Cesium.Matrix4.inverseTransformation(
        transform,
        new Cesium.Matrix4(),
      );
      Cesium.Matrix4.multiplyByPoint(inverse, at, camera.position);
      Cesium.Matrix4.multiplyByPointAsVector(inverse, dir, camera.direction);
      Cesium.Matrix4.multiplyByPointAsVector(inverse, square, camera.up);
      Cesium.Matrix4.multiplyByPointAsVector(inverse, right, camera.right);
      return;
    }
    Cesium.Cartesian3.clone(at, camera.position);
    Cesium.Cartesian3.clone(dir, camera.direction);
    Cesium.Cartesian3.clone(square, camera.up);
    Cesium.Cartesian3.clone(right, camera.right);
  }

  const cameraPort = {
    on: (event, cb, options) => cameraEvents.on(event, cb, options),
    onCommand: (cb) => commandHooks.on(cb),
    setView(spec) {
      command('setView');
      const d = spec.destination;
      const o = spec.orientation;
      if (d && !('rect' in d) && o && 'direction' in o) placeEye(d, o);
      else
        camera.setView({
          ...(d ? { destination: toDestination(d) } : {}),
          orientation: toOrientation(o),
        });
      scene.requestRender?.();
    },
    flyTo(destination, options = {}) {
      command('flyTo');
      return startFlight(
        (callbacks) =>
          camera.flyTo({
            destination: toDestination(destination),
            orientation: toOrientation(options.orientation),
            duration: options.durationS,
            easingFunction: options.easing && EASINGS[options.easing],
            maximumHeight: options.maxHeight,
            pitchAdjustHeight: options.pitchAdjustHeight,
            endTransform:
              options.endFrame === 'world'
                ? Cesium.Matrix4.IDENTITY
                : undefined,
            ...callbacks,
          }),
        options,
      );
    },
    flyToBounds(sphere, options = {}) {
      command('flyToBounds');
      const o = options.offset ?? {};
      return startFlight(
        (callbacks) =>
          camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(
              toCartesian(sphere.center),
              sphere.radius,
            ),
            {
              offset: new Cesium.HeadingPitchRange(
                o.heading ?? 0,
                o.pitch ?? -Math.PI / 4,
                o.range ?? 0,
              ),
              duration: options.durationS,
              easingFunction: options.easing && EASINGS[options.easing],
              ...callbacks,
            },
          ),
        options,
      );
    },
    cancelFlight() {
      command('cancelFlight');
      cesiumCall(() => camera.cancelFlight());
    },
    get flying() {
      return cameraFlightActive(camera);
    },
    lookAt(target, offset) {
      command('lookAt');
      camera.lookAt(
        toCartesian(target),
        new Cesium.HeadingPitchRange(
          offset.heading,
          offset.pitch,
          offset.range,
        ),
      );
      scene.requestRender?.();
    },
    follow(target) {
      if (!following)
        throw new Error('This camera cannot follow: it has no entity tracking');
      command('follow');
      following.follow(target);
      scene.requestRender?.();
    },
    get followed() {
      return following?.followed ?? null;
    },
    get followFramed() {
      return following?.followFramed ?? false;
    },
    followOffset: following?.followOffset ?? NO_FOLLOW_OFFSET,
    controls: controlsPart.controls,
    release() {
      command('release');
      camera.lookAtTransform?.(Cesium.Matrix4.IDENTITY);
      scene.requestRender?.();
    },
    setFov(fov) {
      const frustum = camera.frustum;
      if (fov === null) {
        if (heldFovy !== null && ownFov !== null && 'fov' in frustum)
          frustum.fov = ownFov;
        heldFovy = null;
        ownFov = null;
        scene.requestRender?.();
        return;
      }
      const { vertical } = fov;
      if (!(vertical > 0 && vertical < Math.PI))
        throw new RangeError(`no vertical field of view of ${vertical}`);
      if (heldFovy === null && 'fov' in frustum) ownFov = frustum.fov;
      heldFovy = vertical;
      applyFov();
      scene.requestRender?.();
    },
    matrices() {
      const view = camera.viewMatrix;
      const projection = camera.frustum.projectionMatrix;
      if (
        !lastMatrices ||
        !sameMatrix(lastMatrices.view, view) ||
        !sameMatrix(lastMatrices.projection, projection)
      )
        lastMatrices = {
          view: matrixArray(view),
          projection: matrixArray(projection),
        };
      return lastMatrices;
    },
    viewRectangle() {
      if (scene.mode !== Cesium.SceneMode.SCENE3D) {
        const rect = camera.computeViewRectangle?.(Cesium.Ellipsoid.WGS84);
        if (!rect) return null;
        const deg = Cesium.Math.toDegrees;
        return {
          west: deg(rect.west),
          south: deg(rect.south),
          east: deg(rect.east),
          north: deg(rect.north),
        };
      }
      return computeViewRectangle(
        cameraPort.pose(),
        {
          width: scene.canvas?.clientWidth ?? 0,
          height: scene.canvas?.clientHeight ?? 0,
        },
        (x, y) => pickEllipsoidAt(scene, camera, x, y) ?? null,
      );
    },
    pose() {
      return copyPose(sharedPose());
    },
  };

  function sharedPose() {
    if (!poseKeyHolds() || !poseMemo) {
      poseMemo = readPose();
      if (scene.mode !== Cesium.SceneMode.SCENE3D) poseKeyHolds();
    }
    return poseMemo;
  }
  const poseKey = new Float64Array(37);
  let poseMemo = null;
  function poseKeyHolds() {
    const p = camera.positionWC;
    const d = camera.directionWC;
    const u = camera.upWC;
    const r = camera.rightWC;
    const f = camera.frustum;
    const t = camera.transform ?? Cesium.Matrix4.IDENTITY;
    keySame = true;
    keyAt = 0;
    put(p.x);
    put(p.y);
    put(p.z);
    put(d.x);
    put(d.y);
    put(d.z);
    put(u.x);
    put(u.y);
    put(u.z);
    put(r.x);
    put(r.y);
    put(r.z);
    put(f.fovy ?? NaN);
    put(f.aspectRatio ?? NaN);
    put(f.near ?? NaN);
    put(f.far ?? NaN);
    put(f.left ?? NaN);
    put(f.right ?? NaN);
    put(f.top ?? NaN);
    put(f.bottom ?? NaN);
    put(scene.mode ?? NaN);
    for (let i = 0; i < 16; i++) put(t[i]);
    return keySame;
  }
  let keyAt = 0;
  let keySame = true;
  function put(value) {
    if (!Object.is(poseKey[keyAt], value)) {
      keySame = false;
      poseKey[keyAt] = value;
    }
    keyAt += 1;
  }
  const enuScratch = new Cesium.Matrix4();
  function headingPitchRoll() {
    if (scene.mode !== Cesium.SceneMode.SCENE3D)
      return {
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll,
      };
    const m = Cesium.Transforms.eastNorthUpToFixedFrame(
      camera.positionWC,
      scene.mapProjection?.ellipsoid ?? Cesium.Ellipsoid.WGS84,
      enuScratch,
    );
    const d = camera.directionWC;
    const u = camera.upWC;
    const dx = m[0] * d.x + m[1] * d.y + m[2] * d.z;
    const dy = m[4] * d.x + m[5] * d.y + m[6] * d.z;
    const dz = m[8] * d.x + m[9] * d.y + m[10] * d.z;
    const ux = m[0] * u.x + m[1] * u.y + m[2] * u.z;
    const uy = m[4] * u.x + m[5] * u.y + m[6] * u.z;
    const uz = m[8] * u.x + m[9] * u.y + m[10] * u.z;
    const rz = dx * uy - dy * ux;
    const M = Cesium.Math;
    const level = !M.equalsEpsilon(Math.abs(dz), 1.0, M.EPSILON3);
    const heading =
      M.TWO_PI -
      M.zeroToTwoPi(
        (level ? Math.atan2(dy, dx) : Math.atan2(uy, ux)) - M.PI_OVER_TWO,
      );
    const pitch = M.PI_OVER_TWO - M.acosClamped(dz);
    const roll = level ? M.zeroToTwoPi(Math.atan2(-rz, uz) + M.TWO_PI) : 0.0;
    return { heading, pitch, roll };
  }

  function readPose() {
    const v = (c) => ({ x: c.x, y: c.y, z: c.z });
    const { heading, pitch, roll } = headingPitchRoll();
    const carto = camera.positionCartographic ?? {
      longitude: NaN,
      latitude: NaN,
      height: NaN,
    };
    return {
      lon: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
      position: v(camera.positionWC),
      direction: v(camera.directionWC),
      up: v(camera.upWC),
      right: v(camera.rightWC),
      heading,
      pitch,
      roll,
      height: carto.height,
      fovy: camera.frustum.fovy,
      aspectRatio: camera.frustum.aspectRatio,
      near: camera.frustum.near,
      far: camera.frustum.far,
      frameIsIdentity: Cesium.Matrix4.equals(
        camera.transform ?? Cesium.Matrix4.IDENTITY,
        Cesium.Matrix4.IDENTITY,
      ),
    };
  }
  const copyPose = (pose) => ({
    ...pose,
    position: { ...pose.position },
    direction: { ...pose.direction },
    up: { ...pose.up },
    right: { ...pose.right },
  });
  if (!capabilities || capabilities.has('followFrame'))
    cameraPort.followFrame = () => {
      const transform = camera.transform ?? Cesium.Matrix4.IDENTITY;
      if (!lastFollowFrame || !sameMatrix(lastFollowFrame, transform))
        lastFollowFrame = matrixArray(transform);
      return lastFollowFrame;
    };

  return {
    port: cameraPort,
    measureChanged,
    emit: (event) => cameraEvents.emit(event),
    dispose() {
      following?.dispose();
      controlsPart.dispose();
      for (const off of removers.splice(0)) off();
      cameraEvents.clear();
      commandHooks.clear();
    },
  };
}

/**
 * The port's follow over a Cesium-shaped widget's entity tracking: the
 * target's position framed with its `viewFrom` offset, re-framed each frame
 * while the target moves.
 */
function createFollow({ widget, scene, camera, onChanged, itemPosition, now }) {
  if (!widget?.trackedEntityChanged) return null;
  let target = null;
  let framed = false;
  let announced = null;
  let offset = null;

  const entityOf = () => widget.trackedEntity ?? null;
  const followed = () => (entityOf() && target ? target : null);

  function positionOf(t) {
    const time = widget.clock?.currentTime;
    if (t.item && itemPosition) return itemPosition(t.item, time) ?? null;
    return t.position?.(time) ?? t.displayPosition?.() ?? null;
  }

  function frame() {
    if (!target) return;
    const at = positionOf(target);
    if (!at) return;
    const viewFrom = target.viewFrom ?? { x: 0, y: -1000, z: 500 };
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(toCartesian(at));
    const p = Cesium.Matrix4.multiplyByPoint(
      enu,
      new Cesium.Cartesian3(viewFrom.x, viewFrom.y, viewFrom.z),
      new Cesium.Cartesian3(),
    );
    const dir = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(toCartesian(at), p, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    );
    const up = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(
        Cesium.Cartesian3.cross(dir, new Cesium.Cartesian3(0, 0, 1)),
        dir,
      ),
      new Cesium.Cartesian3(),
    );
    if (typeof camera.setView === 'function')
      camera.setView({
        destination: p,
        orientation: { direction: dir, up },
      });
    if (!framed) {
      framed = true;
      onChanged?.();
    }
  }

  const follow = (next) => {
    if (next === target) return;
    target = next;
    framed = false;
    if (next) {
      widget.trackedEntity = next.helper ?? next;
      frame();
    } else {
      widget.trackedEntity = undefined;
    }
    if (announced !== next) {
      announced = next;
      onChanged?.();
    }
  };

  // A camera double without the real camera's own frame bookkeeping is
  // re-framed each preUpdate, as Cesium's EntityView does from its clock.
  let offPreUpdate = null;
  if (
    !('_frame' in camera) &&
    typeof camera.lookAtTransform === 'function' &&
    scene.preUpdate?.addEventListener
  )
    offPreUpdate = scene.preUpdate.addEventListener(() => {
      if (!target) return;
      const at = positionOf(target);
      if (at)
        camera.lookAtTransform(
          Cesium.Transforms.eastNorthUpToFixedFrame(toCartesian(at)),
        );
    });

  const onTracked = widget.trackedEntityChanged?.addEventListener?.(
    (entity) => {
      if (target && entity && entity !== (target.helper ?? target)) {
        target = null;
        framed = false;
        announced = null;
        onChanged?.();
      }
    },
  );
  void now;

  return {
    follow,
    get followed() {
      return followed();
    },
    get followFramed() {
      return framed;
    },
    followOffset: {
      get: () => (framed ? Cesium.Cartesian3.clone(camera.positionWC) : null),
      set: () => {},
    },
    dispose() {
      onTracked?.();
    },
  };
}

/** The port's user camera settings over a scene's controller, or defaults. */
function createControls({ scene, widget, onCommand }) {
  const ownController = scene.screenSpaceCameraController;
  const controller = ownController ?? controllerDefaults();
  const cameraInput = acquireCameraInput(scene);
  let collision = controller.enableCollisionDetection ? 'both' : 'none';
  let pitchSet = null;
  let framed = false;
  void widget;
  void onCommand;
  return {
    controls: {
      get enabled() {
        return cameraInput.enabled && controller.enableInputs !== false;
      },
      suspend(reason) {
        return cameraInput.suspend(reason);
      },
      get enableTilt() {
        return Boolean(controller.enableTilt);
      },
      set enableTilt(value) {
        controller.enableTilt = Boolean(value);
      },
      get enableRotate() {
        return Boolean(controller.enableRotate);
      },
      set enableRotate(value) {
        controller.enableRotate = Boolean(value);
      },
      get enableZoom() {
        return Boolean(controller.enableZoom);
      },
      set enableZoom(value) {
        controller.enableZoom = Boolean(value);
      },
      get minDistance() {
        return controller.minimumZoomDistance;
      },
      set minDistance(value) {
        controller.minimumZoomDistance = value;
      },
      get maxDistance() {
        return controller.maximumZoomDistance;
      },
      set maxDistance(value) {
        controller.maximumZoomDistance = value;
      },
      get coast() {
        return Object.freeze({
          drag: inertiaToCoast(controller.inertiaSpin),
          zoom: inertiaToCoast(controller.inertiaZoom),
        });
      },
      set coast(value) {
        for (const key of ['drag', 'zoom'])
          if (!(Number.isFinite(value?.[key]) && value[key] >= 0))
            throw new TypeError(`coast.${key} must be seconds, 0 or more`);
        const drag = coastToInertia(value.drag);
        controller.inertiaSpin = drag;
        controller.inertiaTranslate = drag;
        controller.inertiaZoom = coastToInertia(value.zoom);
      },
      get collision() {
        return controller.enableCollisionDetection
          ? collision === 'none'
            ? 'both'
            : collision
          : 'none';
      },
      set collision(value) {
        if (!['none', 'terrain', 'tiles', 'both'].includes(value))
          throw new TypeError(`no collision setting '${value}'`);
        collision = value;
        controller.enableCollisionDetection = value !== 'none';
      },
      get zoomFactor() {
        return controller.zoomFactor;
      },
      set zoomFactor(value) {
        controller.zoomFactor = value;
      },
      get pitchRange() {
        const tilt = controller.maximumTiltAngle;
        if (pitchSet && pitchSet.tilt === tilt) return [...pitchSet.range];
        const max =
          tilt === undefined ? HALF_PI : Math.min(HALF_PI, tilt - HALF_PI);
        const min = Math.min(pitchSet?.range[0] ?? -HALF_PI, max);
        return [Math.max(-HALF_PI, min), Math.max(-HALF_PI, max)];
      },
      set pitchRange(value) {
        const [min, max] = Array.isArray(value) ? value : [];
        if (!(Number.isFinite(min) && Number.isFinite(max) && min <= max))
          throw new RangeError('pitchRange must be [min, max] radians');
        const range = [
          Math.min(HALF_PI, Math.max(-HALF_PI, min)),
          Math.min(HALF_PI, Math.max(-HALF_PI, max)),
        ];
        const tilt = range[1] >= HALF_PI ? undefined : range[1] + HALF_PI;
        controller.maximumTiltAngle = tilt;
        pitchSet = { range, tilt };
      },
      get zoomInputs() {
        const names = [];
        for (const binding of bindingList(controller.zoomEventTypes)) {
          const name = zoomInputName(binding);
          if (name && !names.includes(name)) names.push(name);
        }
        return names;
      },
      set zoomInputs(value) {
        if (!Array.isArray(value))
          throw new TypeError('zoomInputs must be an array');
        for (const name of value)
          if (!Object.hasOwn(ZOOM_BINDINGS, name))
            throw new TypeError(`no zoom input '${name}'`);
        const kept = bindingList(controller.zoomEventTypes).filter(
          (binding) => zoomInputName(binding) === null,
        );
        controller.zoomEventTypes = [
          ...kept,
          ...[...new Set(value)].map((name) => {
            const binding = ZOOM_BINDINGS[name];
            return typeof binding === 'object' ? { ...binding } : binding;
          }),
        ];
      },
      get keepEarthFramed() {
        return framed;
      },
      set keepEarthFramed(value) {
        framed = Boolean(value);
      },
    },
    dispose() {
      cameraInput.release();
    },
  };
}

// A Cesium-shaped viewer with no renderer bound to it gets a camera port
// over its camera when code first asks `cameraOf` for one.
provideUnboundCamera((viewer) =>
  typeof viewer.camera?.flyTo === 'function' &&
  typeof viewer.camera?.moveStart?.addEventListener === 'function' &&
  typeof viewer.scene?.postUpdate?.addEventListener === 'function'
    ? createCesiumCamera({
        scene: viewer.scene,
        camera: viewer.camera,
        report: uncaught,
        widget: viewer,
      })
    : null,
);
