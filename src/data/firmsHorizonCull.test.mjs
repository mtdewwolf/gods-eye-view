import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from '../testSupport/cesiumrsCompat.mjs';
import { createFirmsHeatmapLayer, fireCullPosition } from './firmsHeatmap.js';
import { FIRE_ANCHOR_LIFT_M } from './fireAnchors.js';
import { FIRMS_AMBIENT_COHORT_LIMIT, FIRMS_OVERLAY_SOURCE_ID } from './firmsLabels.js';
import {
  _clearMeshFloorCellsForTest,
  reportMeshFloorCell,
  setMeshFloorPreferred,
} from './groundFloor.js';
import { isOverlayPointVisible, normalizeOverlayEntry } from '../overlays/worldOverlay.js';
import { createIconSet, ICON_CULL_LIFT } from './iconSet.js';
import { writeHoldSegment } from './iconSegment.js';
import { fakeInput } from '../input/testDoubles.mjs';
import { bindFakeCesiumScene } from '../testSupport/fakeCesiumScene.mjs';

const AUSTIN = { lon: -97.7, lat: 30.2 };
/** Antipode of Austin — as far behind the limb as a point on Earth can be. */
const ANTIPODE = { lon: 82.3, lat: -30.2 };
const TOKYO = { lon: 139.7, lat: 35.7 };
/** Reported repro altitude for the through-the-globe defect. */
const REPRO_HEIGHT_M = 1_500_000;
/**
 * Longitude offset east of Austin where the horizon test DIVERGES between a
 * sub-ellipsoid anchor and a lifted one: at 1.5 Mm a point here reads hidden
 * at −22 m but visible at +5/+12 m. Measured against Cesium's own occluder.
 */
const LIMB_DLON = 41.87;
/** Farther east, where 11 m reads hidden and 12 m visible from the same camera. */
const LIFT_BAND_DLON = 41.9452;

/**
 * Whether the icon set's GPU pass draws `row` from `occluder`'s camera: the
 * shader's horizon test on the row's cull point (its CPU twin).
 */
function gpuShows(set, row, occluder) {
  const position = set.position(row, 0, new Cesium.Cartesian3());
  return set.shown(row) && occluder.isPointVisible(set.cullPoint(row, position));
}

/** A fire-shaped row (shown, CULL_LIFT) held at `position`. */
function fireRow(set, id, position) {
  const row = set.add(id, { layer: 'firms', id });
  set.setFlag(row, ICON_CULL_LIFT, true);
  set.setShown(row, true);
  writeHoldSegment(set.segments, row, position, 0);
  set.segmentWritten(row);
  return row;
}

/** Horizon occluder for a camera directly above Austin at `heightM`. */
function occluderOverAustin(heightM) {
  return new Cesium.EllipsoidalOccluder(
    Cesium.Ellipsoid.WGS84,
    Cesium.Cartesian3.fromDegrees(AUSTIN.lon, AUSTIN.lat, heightM),
  );
}

// ---------------------------------------------------------------------------
// The GPU horizon cull a fire row gets
// ---------------------------------------------------------------------------

test('icon cull: far-side fires are hidden, near-side fires stay visible', () => {
  const occluder = occluderOverAustin(REPRO_HEIGHT_M);
  const set = createIconSet();
  const at = (p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
  const near = fireRow(set, 'near', at(AUSTIN));
  const nearby = fireRow(set, 'nearby', at({ lon: AUSTIN.lon + 6, lat: AUSTIN.lat + 4 }));
  const far = fireRow(set, 'far', at(ANTIPODE));
  const otherSide = fireRow(set, 'tokyo', at(TOKYO));

  assert.equal(gpuShows(set, near, occluder), true, 'the fire under the camera renders');
  assert.equal(gpuShows(set, nearby, occluder), true, 'a fire well inside the horizon renders');
  assert.equal(gpuShows(set, far, occluder), false, 'the antipodal fire must not shine through the planet');
  assert.equal(gpuShows(set, otherSide, occluder), false, 'Tokyo is beyond the limb from Austin at 1.5 Mm');
});

test('icon cull: raising the camera reveals fires the low camera hid', () => {
  const set = createIconSet();
  const paris = fireRow(set, 'paris', Cesium.Cartesian3.fromDegrees(2.35, 48.86, 0));
  assert.equal(gpuShows(set, paris, occluderOverAustin(REPRO_HEIGHT_M)), false);
  assert.equal(gpuShows(set, paris, occluderOverAustin(35_000_000)), true, 'in view from geostationary height');
});

test('icon cull: a sub-ellipsoid anchor is judged lifted, a far-side one still culls', () => {
  const occluder = occluderOverAustin(REPRO_HEIGHT_M);
  const set = createIconSet();
  const sunken = fireRow(set, 'sunken', Cesium.Cartesian3.fromDegrees(AUSTIN.lon + LIMB_DLON, AUSTIN.lat, -22));
  assert.equal(gpuShows(set, sunken, occluder), true, 'the lifted cull point keeps the near-limb fire on screen');
  set.setFlag(sunken, ICON_CULL_LIFT, false);
  assert.equal(gpuShows(set, sunken, occluder), false, 'baseline: the raw anchor false-hides at the limb');

  const far = fireRow(set, 'far', Cesium.Cartesian3.fromDegrees(ANTIPODE.lon, ANTIPODE.lat, -22));
  assert.equal(gpuShows(set, far, occluder), false, '12 m of lift must not defeat the actual horizon cull');
});

test('fireCullPosition: a card is judged where its sprite is', () => {
  const occluder = occluderOverAustin(REPRO_HEIGHT_M);
  const set = createIconSet();
  setMeshFloorPreferred(true);
  try {
    // Sunk, an 11 m anchor (floor 6 + lift), and well above: each card must
    // agree with the GPU test on its own row, at limb points where they can.
    for (const [i, floor] of [-27, 6, 900].entries()) {
      _clearMeshFloorCellsForTest(); // a reported cell latches its first floor
      for (const dLon of [LIMB_DLON, LIFT_BAND_DLON]) {
        const lat = AUSTIN.lat;
        const lon = AUSTIN.lon + dLon;
        reportMeshFloorCell(lat, lon, floor);
        const fire = { index: i, lat, lon, frp: 10, position: null };
        const cull = fireCullPosition(fire);
        assert.equal(fire.positionHeight, floor + FIRE_ANCHOR_LIFT_M);
        const row = fireRow(set, `${floor}:${dLon}`, fire.position);
        assert.equal(
          occluder.isPointVisible(cull),
          gpuShows(set, row, occluder),
          `floor ${floor} m at +${dLon}°`,
        );
      }
    }
  } finally {
    _clearMeshFloorCellsForTest();
    setMeshFloorPreferred(false);
  }
});

test('fireCullPosition: negative-geoid anchor renders at the datum but culls lifted', () => {
  const lat = 30.2;
  const lon = AUSTIN.lon + LIMB_DLON;
  setMeshFloorPreferred(true);
  reportMeshFloorCell(lat, lon, -27);
  try {
    const fire = { index: 1, lat, lon, frp: 10, position: null };
    const cull = fireCullPosition(fire);
    const render = fire.position;
    const renderCarto = Cesium.Cartographic.fromCartesian(render);
    assert.ok(
      Math.abs(renderCarto.height - (-27 + FIRE_ANCHOR_LIFT_M)) < 0.5,
      `render anchor stays datum-correct at ${-27 + FIRE_ANCHOR_LIFT_M} m, got ${renderCarto.height}`,
    );

    assert.notEqual(cull, render, 'a sub-ellipsoid anchor gets a separate cull point');
    const cullCarto = Cesium.Cartographic.fromCartesian(cull);
    assert.ok(Math.abs(cullCarto.height - 12) < 0.5, `cull point lifted to 12 m, got ${cullCarto.height}`);
    assert.equal(fireCullPosition(fire), cull, 'the lifted point is cached, not re-allocated per call');

    // The whole point: the datum-correct point would be culled here, the lifted one is not.
    const occluder = occluderOverAustin(REPRO_HEIGHT_M);
    assert.equal(occluder.isPointVisible(render), false, 'baseline defect: −22 m reads beyond the horizon');
    assert.equal(occluder.isPointVisible(cull), true, 'lifted cull point reads correctly as in view');
  } finally {
    _clearMeshFloorCellsForTest();
    setMeshFloorPreferred(false);
  }
});

test('fireCullPosition: a healthy above-ellipsoid anchor is its own cull point', () => {
  const lat = 45.5;
  const lon = -122.6;
  setMeshFloorPreferred(true);
  reportMeshFloorCell(lat, lon, 900);
  try {
    const fire = { index: 2, lat, lon, frp: 10, position: null };
    const cull = fireCullPosition(fire);
    assert.equal(cull, fire.position, 'no second Cartesian is allocated for the common case');
  } finally {
    _clearMeshFloorCellsForTest();
    setMeshFloorPreferred(false);
  }
});

// ---------------------------------------------------------------------------
// World-overlay host wiring (cards)
// ---------------------------------------------------------------------------

test('isOverlayPointVisible: horizon test prefers entry.cullPosition when present', () => {
  const viewport = { width: 800, height: 600 };
  const screen = { x: 400, y: 300 };
  const render = Cesium.Cartesian3.fromDegrees(AUSTIN.lon + LIMB_DLON, AUSTIN.lat, -22);
  const lifted = Cesium.Cartesian3.fromDegrees(AUSTIN.lon + LIMB_DLON, AUSTIN.lat, 12);
  const occluder = occluderOverAustin(REPRO_HEIGHT_M);

  assert.equal(
    isOverlayPointVisible({ horizonCull: true }, render, screen, viewport, occluder),
    false,
    'baseline: the render anchor alone false-hides the card',
  );
  assert.equal(
    isOverlayPointVisible({ horizonCull: true, cullPosition: lifted }, render, screen, viewport, occluder),
    true,
    'the supplied cull position is what the horizon test uses',
  );
  assert.equal(
    isOverlayPointVisible(
      { horizonCull: true, cullPosition: Cesium.Cartesian3.fromDegrees(ANTIPODE.lon, ANTIPODE.lat, 12) },
      render,
      screen,
      viewport,
      occluder,
    ),
    false,
    'a far-side cull position still culls',
  );
});

test('normalizeOverlayEntry: carries a valid cullPosition, nulls a junk one', () => {
  const position = { x: 1, y: 2, z: 3 };
  const cullPosition = { x: 4, y: 5, z: 6 };
  const kept = normalizeOverlayEntry('firms', { id: 'a', position, cullPosition });
  assert.notEqual(kept.cullPosition, cullPosition, 'stored as a host-owned copy');
  assert.deepEqual(
    [kept.cullPosition.x, kept.cullPosition.y, kept.cullPosition.z],
    [4, 5, 6],
  );
  const dropped = normalizeOverlayEntry('firms', { id: 'b', position, cullPosition: { x: NaN, y: 5, z: 6 } });
  assert.equal(dropped.cullPosition, null, 'a malformed cull point falls back to the render position');
  const notAnObject = normalizeOverlayEntry('firms', { id: 'b2', position, cullPosition: 42 });
  assert.equal(notAnObject.cullPosition, null, 'a non-object cull point is rejected');
  // Non-adopting sources keep their existing BEHAVIOUR and steady-frame
  // allocation profile; the normalized record does gain an enumerable
  // `cullPosition: null` field, which is why this asserts null rather than
  // absence.
  const absent = normalizeOverlayEntry('firms', { id: 'c', position });
  assert.equal(absent.cullPosition, null, 'sources that do not opt in resolve to no cull anchor');
});

test('normalizeOverlayEntry: the stored cull anchor is a snapshot, not the caller object', () => {
  const position = { x: 1, y: 2, z: 3 };
  const caller = new Cesium.Cartesian3(4, 5, 6);
  const normalized = normalizeOverlayEntry('firms', { id: 'a', position, cullPosition: caller });
  assert.notEqual(normalized.cullPosition, caller, 'the host must not retain the caller reference');

  // Sources legitimately recycle scratch vectors between publishes; a mutation
  // after normalization must never reach the per-frame occluder.
  caller.x = NaN;
  caller.y = 999;
  assert.deepEqual(
    [normalized.cullPosition.x, normalized.cullPosition.y, normalized.cullPosition.z],
    [4, 5, 6],
    'post-normalize mutation of the source vector has no effect',
  );
});

test('normalizeOverlayEntry: an accessor-backed cullPosition is read exactly once', () => {
  const position = { x: 1, y: 2, z: 3 };
  let reads = 0;
  const entry = {
    id: 'a',
    position,
    get cullPosition() {
      reads += 1;
      return new Cesium.Cartesian3(4, 5, 6);
    },
  };
  const normalized = normalizeOverlayEntry('firms', entry);
  assert.equal(reads, 1, 'one property read — not one per validated component');
  assert.deepEqual(
    [normalized.cullPosition.x, normalized.cullPosition.y, normalized.cullPosition.z],
    [4, 5, 6],
  );
});

test('normalizeOverlayEntry: a throwing cullPosition accessor does not abort normalization', () => {
  const position = { x: 1, y: 2, z: 3 };
  const entry = {
    id: 'a',
    position,
    title: 'still normalized',
    get cullPosition() { throw new Error('hostile accessor'); },
  };
  const normalized = normalizeOverlayEntry('firms', entry);
  assert.equal(normalized.cullPosition, null, 'the bad anchor degrades to null');
  assert.equal(normalized.title, 'still normalized', 'the rest of the entry survives');
  assert.equal(normalized.id, 'a');
});

