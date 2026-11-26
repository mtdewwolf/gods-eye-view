import { readLayerSource } from '../testSupport/readLayerSource.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrackingClickGesture,
  isTrackingSelectionGesture,
} from './trackingClickGesture.js';
import { createRendererHarness } from '../testSupport/rendererHarness.mjs';

test('tracking click discrimination pins the travel/duration boundary matrix', () => {
  const matrix = [
    [{ travelPx: 0, durationMs: 0 }, true],
    [{ travelPx: 6, durationMs: 400 }, true],
    [{ travelPx: 6.001, durationMs: 400 }, false],
    [{ travelPx: 6, durationMs: 400.001 }, false],
    [{ travelPx: 20, durationMs: 50 }, false],
    [{ travelPx: 0, durationMs: 1000 }, false],
  ];
  for (const [gesture, expected] of matrix) {
    assert.equal(isTrackingClickGesture(gesture), expected, JSON.stringify(gesture));
  }
  assert.equal(isTrackingSelectionGesture({ travelPx: 0, durationMs: 1000 }), true);
  assert.equal(isTrackingSelectionGesture({ travelPx: 6.001, durationMs: 10 }), false);
});

test('a drag returning to its start cannot untrack, and a later click can', (t) => {
  const scene = createRendererHarness();
  t.after(() => scene.destroy());
  let untracks = 0;
  scene.input.onClick(({ gesture }) => {
    if (isTrackingClickGesture(gesture)) untracks += 1;
  });
  scene.press(10, 10);
  scene.move(14, 10);
  scene.move(10, 10);
  scene.release(10, 10);
  assert.equal(untracks, 0);
  scene.press(10, 10);
  scene.release(10, 10);
  assert.equal(untracks, 1);
});

test('slow clean sprite clicks select, while long presses and orbit nudges cannot untrack', (t) => {
  const scene = createRendererHarness();
  t.after(() => scene.destroy());
  let selections = 0;
  let untracks = 0;
  scene.input.onClick(({ screenPosition: click, gesture }) => {
    if (!isTrackingSelectionGesture(gesture)) return;
    if (click.x === 0 && click.y === 0) selections += 1;
    else if (isTrackingClickGesture(gesture)) untracks += 1;
  });
  scene.press(0, 0);
  scene.advance(450);
  scene.release(0, 0);
  assert.equal(selections, 1);
  assert.equal(untracks, 0);
  scene.press(10, 10);
  scene.move(14, 10);
  scene.move(10, 10);
  scene.release(10, 10);
  assert.equal(untracks, 0);
  scene.press(0, 0);
  scene.advance(150);
  scene.release(3, 4);
  assert.equal(untracks, 1);
});

test('civilian and military click handlers apply duration only at the deselect branch', () => {
  const sources = [
    readLayerSource(new URL('./flights.js', import.meta.url)),
    readLayerSource(new URL('./militaryFlights.js', import.meta.url)),
  ];
  for (const source of sources) {
    assert.match(source, /isTrackingSelectionGesture\(gesture\)[\s\S]+event\.hit/);
    assert.match(source, /isTrackingClickGesture\(gesture\)[\s\S]+(?:parts\.\w+\.)?_clearTracking\([^)]*\{ origin: 'user' \}\)/);
  }
  assert.doesNotMatch(
    sources[0],
    /(?:flightState\.)?_trackedEntity = (?:flightState\.)?_viewer\.entities\.add\(\{\s*id:/,
    'civilian tracked entities must retain Cesium-generated GUIDs',
  );
});

test('a click on an aircraft follows it keeping the camera’s view; other selections frame it', () => {
  const sources = [
    readLayerSource(new URL('./flights.js', import.meta.url)),
    readLayerSource(new URL('./militaryFlights.js', import.meta.url)),
  ];
  for (const source of sources) {
    assert.match(
      source,
      /_trackFlight\(pickedIcao, \{ origin: 'user', keepView: true \}\)/,
    );
    assert.match(
      source,
      /keepView\s*\?\s*followViewFrom\(camera\.pose\(\), getTrackedPosition\(\)\)/,
    );
    assert.match(source, /transitionS: SELECTION_FOLLOW_TRANSITION_S/);
  }
});
