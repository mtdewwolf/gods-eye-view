/**
 * @module testSupport/cesiumInput
 * @description The input port over a Cesium-shaped viewer double, ported
 * from the default renderer's adapter so tests keep the pointer behaviour
 * they wrote against. No engine: the viewer's own `ScreenSpaceEventHandler`
 * (or the `createHandler` a test passes) answers Cesium's event types, and
 * `cesiumrsCompat` supplies the constants.
 */
import * as Cesium from './cesiumrsCompat.mjs';
import { createInputRouter } from '../render/input/router.js';
import { wheelLines } from '../render/input/wheel.js';
import { provideUnboundInput } from '../render/rendererOf.js';
import { acquireCameraInput } from './cesiumCamera.mjs';

const T = Cesium.ScreenSpaceEventType;
const MODIFIERS = [
  undefined,
  Cesium.KeyboardEventModifier.SHIFT,
  Cesium.KeyboardEventModifier.CTRL,
  Cesium.KeyboardEventModifier.ALT,
];
const BUTTONS = ['LEFT', 'MIDDLE', 'RIGHT'];
const STOCK = { select: T.LEFT_CLICK, dblclickFollow: T.LEFT_DOUBLE_CLICK };
const DOM_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'mousedown',
  'mousemove',
  'mouseup',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'dblclick',
];
const DRILL_DEPTH = 16;
const NO_MODIFIERS = Object.freeze({
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
});
const POINTER_TYPES = new Set(['mouse', 'touch', 'pen']);
const CESIUM_MODIFIER = {
  [Cesium.KeyboardEventModifier.SHIFT]: { shift: true },
  [Cesium.KeyboardEventModifier.CTRL]: { ctrl: true },
  [Cesium.KeyboardEventModifier.ALT]: { alt: true },
};

const xy = (p) => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const modifiersOf = (dom) =>
  dom
    ? {
        shift: Boolean(dom.shiftKey),
        ctrl: Boolean(dom.ctrlKey),
        alt: Boolean(dom.altKey),
        meta: Boolean(dom.metaKey),
      }
    : { ...NO_MODIFIERS };

function pointerTypeOf(dom, otherwise = 'mouse') {
  if (POINTER_TYPES.has(dom?.pointerType)) return dom.pointerType;
  if (dom?.type?.startsWith('touch')) return 'touch';
  if (dom?.type?.startsWith('mouse')) return 'mouse';
  return otherwise;
}

/** @type {WeakMap<object, object>} scene -> its input port */
const inputs = new WeakMap();

export const cesiumInputOf = (scene) => inputs.get(scene) ?? null;

/**
 * @param {object} widget A Cesium-shaped `CesiumWidget` or `Viewer`.
 * @param {object} options
 * @returns {{port: object, feed: Function, listenerCount: () => number,
 *   dispose: () => void}}
 */
export function createCesiumInput(
  widget,
  {
    query,
    report,
    createHandler = () => new Cesium.ScreenSpaceEventHandler(),
    now = () => performance.now(),
    document: dom = globalThis.document,
    takeStock = true,
    suspendCamera,
  },
) {
  const scene = widget.scene;
  if (inputs.has(scene))
    throw new TypeError('This scene already has an input port');
  const canvas = scene.canvas;
  let disposed = false;

  const stockHandler = widget.screenSpaceEventHandler;
  const stock = {};
  const has = {};
  for (const [name, type] of Object.entries(STOCK)) {
    const action = stockHandler?.getInputAction?.(type);
    has[name] = Boolean(action);
    if (!action || !takeStock) continue;
    stock[name] = action;
    stockHandler.removeInputAction(type);
  }
  const borrowed = {};
  const giveBack = (name) => {
    const action = borrowed[name];
    delete borrowed[name];
    if (!action || !stockHandler || stockHandler.isDestroyed?.()) return;
    if (!stockHandler.getInputAction(STOCK[name]))
      stockHandler.setInputAction(action, STOCK[name]);
  };
  function borrowStock(name, enabled) {
    if (takeStock || !stockHandler) return;
    if (enabled) return giveBack(name);
    const action = stockHandler.getInputAction?.(STOCK[name]);
    if (!action) return;
    borrowed[name] = action;
    stockHandler.removeInputAction(STOCK[name]);
  }

  const cameraInput = suspendCamera ? null : acquireCameraInput(scene);
  const router = createInputRouter({
    report,
    suspendCamera: suspendCamera ?? ((reason) => cameraInput.suspend(reason)),
    supported: { select: has.select, dblclickFollow: has.dblclickFollow },
    onBehaviour: borrowStock,
  });
  const { behaviours } = router.port;

  let lastDom = null;
  let lastPointerType = 'mouse';
  let clearing = false;
  const clear = () => {
    clearing = false;
    lastDom = null;
  };
  const record = (event) => {
    lastDom = event;
    lastPointerType = pointerTypeOf(event, lastPointerType);
    if (clearing) return;
    clearing = true;
    setTimeout(clear, 0);
  };
  for (const type of DOM_EVENTS)
    dom?.addEventListener?.(type, record, { capture: true, passive: true });

  const pressing = new Map();
  const finished = new Map();
  let lastUp = null;
  let lastType = null;
  let stockAtDown = null;
  const heldButton = () => {
    for (const button of [0, 1, 2]) if (pressing.has(button)) return button;
    return 0;
  };

  function track(type, position, endPosition, button) {
    const at = now();
    if (type === 'down') {
      pressing.set(button, { start: at, last: position, travel: 0 });
      finished.delete(button);
    } else if (type === 'move') {
      for (const press of pressing.values()) {
        press.travel += distance(press.last, endPosition);
        press.last = endPosition;
      }
    } else if (type === 'up') {
      const press = pressing.get(button);
      if (!press) return;
      press.travel += distance(press.last, position);
      pressing.delete(button);
      finished.set(button, {
        travelPx: press.travel,
        durationMs: Math.max(0, at - press.start),
      });
    }
  }

  function withPicks(ev) {
    const { x, y } = ev.position;
    let hit;
    let picked = false;
    let ground;
    let grounded = false;
    const drills = new Map();
    ev.pick = () => {
      if (!picked) {
        picked = true;
        hit = query.pick(x, y) ?? null;
      }
      return hit;
    };
    ev.drill = (options = {}) => {
      const { limit, ...window } = options;
      const want = limit ?? Infinity;
      const depth = want === Infinity ? Infinity : Math.max(want, DRILL_DEPTH);
      const key = `${window.width ?? ''}x${window.height ?? ''}:${window.purpose ?? ''}:${depth}`;
      let hits = drills.get(key);
      if (!hits) {
        hits = query.drillPick(x, y, {
          ...window,
          ...(depth === Infinity ? {} : { limit: depth }),
        });
        drills.set(key, hits);
      }
      return want === Infinity ? hits.slice() : hits.slice(0, want);
    };
    ev.ground = () => {
      if (!grounded) {
        grounded = true;
        ground = query.pickPosition(x, y) ?? query.pickEllipsoid(x, y);
      }
      return ground;
    };
    return ev;
  }

  function deliver(type, position, extra = {}, source = lastDom) {
    if (disposed) return;
    const released = source && /(?:pointer|mouse)up$/.test(source.type);
    if (type === 'click' && released && source.button !== extra.button) {
      finished.delete(extra.button);
      return;
    }
    const at = xy(position);
    const end = extra.endPosition ? xy(extra.endPosition) : undefined;
    const button = extra.button ?? heldButton();
    track(type, at, end ?? at, button);
    const justUp = lastUp;
    lastUp = type === 'up' ? button : null;
    const previous = lastType;
    lastType = type;
    if (type === 'down' && button === 0)
      stockAtDown = {
        select: behaviours.select.enabled,
        dblclickFollow: behaviours.dblclickFollow.enabled,
      };
    const ofPress =
      (type === 'click' && justUp === 0) ||
      (type === 'dblclick' && previous === 'click');
    const ev = {
      type,
      position: at,
      button,
      modifiers: extra.modifiers
        ? { ...NO_MODIFIERS, ...extra.modifiers }
        : source
          ? modifiersOf(source)
          : { ...NO_MODIFIERS, ...CESIUM_MODIFIER[extra.modifier] },
      timestamp: now(),
      pointerType: extra.pointerType ?? pointerTypeOf(source, lastPointerType),
      ...(end ? { endPosition: end } : {}),
      ...(extra.delta !== undefined ? { delta: extra.delta } : {}),
    };
    if (type === 'click' || type === 'dblclick') {
      const press =
        type === 'click' && justUp === button
          ? finished.get(button)
          : undefined;
      finished.delete(button);
      ev.gesture = extra.gesture ?? press ?? { travelPx: 0, durationMs: 0 };
      if (query) withPicks(ev);
    }
    router.dispatch(ev, (to) => runStock(ev, to, ofPress ? stockAtDown : null));
    if (type === 'down' && button === 0 && stockAtDown)
      stockAtDown = {
        select: stockAtDown.select && behaviours.select.enabled,
        dblclickFollow:
          stockAtDown.dblclickFollow && behaviours.dblclickFollow.enabled,
      };
  }

  function runStock(ev, to, atDown) {
    const name =
      ev.type === 'click'
        ? 'select'
        : ev.type === 'dblclick'
          ? 'dblclickFollow'
          : null;
    if (!name || !stock[name] || ev.button !== 0 || !to.ambient) return;
    const { shift, ctrl, alt } = ev.modifiers;
    if (shift || ctrl || alt || !behaviours[name].enabled) return;
    if (atDown && !atDown[name]) return;
    try {
      stock[name]({
        position: new Cesium.Cartesian2(ev.position.x, ev.position.y),
      });
    } catch (error) {
      report(error);
    }
  }

  const handler = createHandler(canvas);
  const bind = (type, action) => {
    for (const modifier of MODIFIERS)
      handler.setInputAction(
        (event) => action(event, modifier),
        type,
        modifier,
      );
  };
  BUTTONS.forEach((name, button) => {
    bind(T[`${name}_DOWN`], (e, modifier) =>
      deliver('down', e.position, { button, modifier }),
    );
    bind(T[`${name}_UP`], (e, modifier) =>
      deliver('up', e.position, { button, modifier }),
    );
    bind(T[`${name}_CLICK`], (e, modifier) =>
      deliver('click', e.position, { button, modifier }),
    );
  });
  bind(T.LEFT_DOUBLE_CLICK, (e, modifier) =>
    deliver('dblclick', e.position, { button: 0, modifier }),
  );
  bind(T.MOUSE_MOVE, (e, modifier) =>
    deliver('move', e.startPosition ?? e.endPosition, {
      endPosition: e.endPosition,
      modifier,
    }),
  );
  let pinchAt = null;
  bind(T.PINCH_START, (e) => {
    pinchAt = {
      x: (e.position1.x + e.position2.x) / 2,
      y: (e.position1.y + e.position2.y) / 2,
    };
  });
  bind(T.PINCH_MOVE, (e) => {
    const from = e.distance.startPosition.y;
    const to = e.distance.endPosition.y;
    if (!(from > 0) || !(to > 0) || !pinchAt) return;
    deliver('pinch', pinchAt, { delta: to / from });
  });
  bind(T.PINCH_END, () => {
    pinchAt = null;
  });

  const onWheel = (event) => {
    const rect = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    deliver(
      'wheel',
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { delta: wheelLines(event) },
      event,
    );
  };
  canvas?.addEventListener?.('wheel', onWheel, { passive: true });

  const self = {
    port: router.port,
    feed(type, x, y, extra = {}) {
      deliver(type, { x, y }, extra, null);
    },
    listenerCount: router.listenerCount,
    dispose() {
      if (disposed) return;
      disposed = true;
      router.dispose();
      if (inputs.get(scene) === self) inputs.delete(scene);
      canvas?.removeEventListener?.('wheel', onWheel, { passive: true });
      for (const type of DOM_EVENTS)
        dom?.removeEventListener?.(type, record, { capture: true });
      if (!handler.isDestroyed?.()) handler.destroy?.();
      cameraInput?.release();
      for (const name of Object.keys(borrowed)) giveBack(name);
      if (stockHandler && !stockHandler.isDestroyed?.())
        for (const [name, type] of Object.entries(STOCK))
          if (stock[name] && !stockHandler.getInputAction(type))
            stockHandler.setInputAction(stock[name], type);
    },
  };
  inputs.set(scene, self);
  return self;
}

// A Cesium-shaped viewer with no renderer bound to it gets an input port
// over its canvas when code first asks `findInput` for one.
provideUnboundInput((viewer, options = {}) => {
  const scene = viewer?.scene;
  if (!scene || typeof scene !== 'object') return null;
  const made = inputs.get(scene);
  if (made) return { port: made.port, dispose() {} };
  const { createHandler, now, document } = options;
  const input = createCesiumInput(viewer, {
    report: (error) => console.error('Pointer input failed', error),
    takeStock: false,
    ...(createHandler ? { createHandler } : {}),
    ...(now ? { now } : {}),
    ...(document !== undefined ? { document } : {}),
  });
  return { port: input.port, dispose: () => input.dispose(), keep: true };
});
