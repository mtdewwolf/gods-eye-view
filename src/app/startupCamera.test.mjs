import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStartView, START_VIEW } from '../camera.js';
import { createRendererHarness } from '../testSupport/rendererHarness.mjs';

test('the camera starts over the whole planet, looking straight down', (t) => {
  const scene = createRendererHarness();
  t.after(() => scene.destroy());
  applyStartView(scene.host);
  const pose = scene.renderer.camera.pose();
  assert.ok(START_VIEW.height >= 20000000, 'the whole planet is in view');
  assert.ok(Math.abs(pose.height - START_VIEW.height) < 0.01);
  assert.ok(Math.abs(pose.pitch + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.sin(pose.heading)) < 1e-9);
  assert.ok(Math.cos(pose.heading) > 0);
});

test('a host can start the camera at a city instead', (t) => {
  const scene = createRendererHarness();
  t.after(() => scene.destroy());
  applyStartView(scene.host, {
    lon: 2.35,
    lat: 48.86,
    height: 5000,
    heading: 90,
    pitch: -30,
  });
  const pose = scene.renderer.camera.pose();
  assert.ok(Math.abs(pose.lon - 2.35) < 1e-8);
  assert.ok(Math.abs(pose.lat - 48.86) < 1e-8);
  assert.ok(Math.abs(pose.height - 5000) < 0.01);
  assert.ok(Math.abs(pose.heading - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(pose.pitch + Math.PI / 6) < 1e-9);
});
