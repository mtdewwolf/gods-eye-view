import { inputFor } from '../input/dispatcher.js';
import { createSceneHost } from '../render/rendererOf.js';
import { createStubRenderer } from '../render/stub/index.js';
import {
  beginGesture,
  endGesture,
  moveGesture,
} from '../render/input/gesture.js';

/** A renderer-backed scene that tests can drive through the application ports. */
export function createRendererHarness(options = {}) {
  const renderer = createStubRenderer(options);
  const scene = createSceneHost(renderer, {
    container: options.container ?? null,
  });
  const input = inputFor(scene.host);
  let destroyed = false;
  let gesture = null;
  return {
    host: scene.host,
    renderer,
    input,
    pointer: renderer.testing.pointer,
    press(x, y) {
      gesture = beginGesture({ x, y }, renderer.testing.now());
      renderer.testing.pointer('down', x, y);
    },
    move(x, y) {
      if (gesture) moveGesture(gesture, { x, y });
      renderer.testing.pointer('move', x, y);
    },
    release(x, y) {
      renderer.testing.pointer('up', x, y);
      if (!gesture) return;
      const result = endGesture(gesture, { x, y }, renderer.testing.now());
      gesture = null;
      if (result.travelPx <= 6)
        renderer.testing.pointer('click', x, y, { gesture: result });
    },
    tick: renderer.testing.tick,
    advance: renderer.testing.advance,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      input.destroy();
      scene.release();
      renderer.destroy();
    },
  };
}
