import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendererHarness } from './rendererHarness.mjs';
import { findCamera, rendererOf } from '../render/rendererOf.js';

test('camera commands are observable through the scene camera port', () => {
  const scene = createRendererHarness();
  try {
    const camera = findCamera(scene.host);
    camera.setView({ destination: { lon: 15, lat: 25, height: 10000 } });
    assert.ok(Math.abs(camera.pose().lon - 15) < 1e-8);
    assert.ok(Math.abs(camera.pose().lat - 25) < 1e-8);
  } finally {
    scene.destroy();
  }
  assert.equal(scene.host.isDestroyed(), true);
  assert.equal(rendererOf(scene.host), null);
  scene.destroy();
});

test('pointer clicks reach the application dispatcher', () => {
  const scene = createRendererHarness();
  try {
    const positions = [];
    scene.input.onClick((event) => positions.push(event.screenPosition));
    scene.pointer('down', 30, 40);
    scene.pointer('up', 30, 40);
    scene.pointer('click', 30, 40);
    assert.deepEqual(positions, [{ x: 30, y: 40 }]);
  } finally {
    scene.destroy();
  }
});

test('a drag returning to its start does not become a click', () => {
  const scene = createRendererHarness();
  try {
    const clicks = [];
    scene.input.onClick((event) => clicks.push(event.gesture));
    scene.press(10, 10);
    scene.move(14, 10);
    scene.move(10, 10);
    scene.release(10, 10);
    assert.equal(clicks.length, 0);
    scene.press(10, 10);
    scene.advance(100);
    scene.release(13, 14);
    assert.equal(clicks.length, 1);
    assert.equal(clicks[0].travelPx, 5);
    assert.ok(clicks[0].durationMs >= 99);
  } finally {
    scene.destroy();
  }
});
