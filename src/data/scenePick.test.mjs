import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromDegrees, magnitude, toCartographicRadians, toDegrees, vec } from '../geo/index.js';
import { isPickedWorldPosition } from './scenePick.js';

const describe = (position) =>
  position ? `(${position.x}, ${position.y}, ${position.z})` : String(position);

test('a degenerate depth pick is rejected', () => {
  // These are the shapes `scene.pickPosition()` can produce when the depth read
  // over empty sky is meaningless. Each one is a MISSED pick, not a place.
  const degenerate = [
    null,
    undefined,
    vec(Number.NaN, Number.NaN, Number.NaN),
    vec(0, 0, 0),
    vec(Number.POSITIVE_INFINITY, 0, 0),
    vec(0, Number.NEGATIVE_INFINITY, 0),
    vec(1, Number.NaN, 1),
    vec(0.2, -0.3, 0.1),
  ];
  for (const position of degenerate) {
    assert.equal(
      isPickedWorldPosition(position),
      false,
      `must reject ${describe(position)}`,
    );
  }
});

test('the guard is an Earth-sized band, not just a non-zero check', () => {
  // Finiteness alone is not validation. A pick has to land in the shell the
  // Earth actually occupies, because the values BETWEEN "zero" and "the globe"
  // are the ones that fail quietly.
  const belowTheFloor = [
    // The adversarial probe: finite, non-zero, and 6,378 km underground. A bare
    // non-zero check accepts it, and the shipped path then reverse-geocodes
    // 0°, 0° as if the operator were looking at the Gulf of Guinea.
    vec(500, 0, 0),
    vec(0, 1_000_000, 0),
    vec(0, 0, 5_999_999),
  ];
  for (const position of belowTheFloor) {
    assert.equal(
      isPickedWorldPosition(position),
      false,
      `must reject ${describe(position)}`,
    );
    // Each one converts WITHOUT throwing — that is exactly what makes it dangerous.
    const carto = toCartographicRadians(position);
    assert.ok(carto, `coordinates convert ${describe(position)} without complaint`);
    assert.ok(
      carto.height < -300_000,
      'and puts the "target" hundreds of km underground',
    );
  }

  const aboveTheCeiling = [
    vec(1_000_000_001, 0, 0),
    vec(0, 1e12, 0),
    // Large enough to overflow ordinary squared-distance arithmetic.
    vec(1e155, 0, 0),
  ];
  for (const position of aboveTheCeiling) {
    assert.equal(
      isPickedWorldPosition(position),
      false,
      `must reject ${describe(position)}`,
    );
  }
  // Both edges of the band are inclusive, and both are real magnitudes.
  assert.equal(
    isPickedWorldPosition(vec(6_000_000, 0, 0)),
    true,
  );
  assert.equal(
    isPickedWorldPosition(vec(1_000_000_000, 0, 0)),
    true,
  );
});

test('a real picked position is accepted', () => {
  const real = [
    // Ground, a cruising airliner, and the deepest surface point on the globe.
    fromDegrees(-97.7431, 30.2672, 0),
    fromDegrees(139.6917, 35.6895, 12_000),
    fromDegrees(0, -89.9, -400),
    fromDegrees(142.2, 11.35, -10_935),
    // A tall structure: pickPosition returns the mesh, not the terrain.
    fromDegrees(55.2744, 25.1972, 828),
    // The polar surface is the smallest magnitude the globe can produce.
    fromDegrees(0, 90, 0),
    // Satellites are real contacts too, up to geostationary.
    fromDegrees(0, 0, 550_000),
    fromDegrees(0, 0, 35_786_000),
  ];
  for (const position of real) {
    assert.equal(
      isPickedWorldPosition(position),
      true,
      `must accept ${describe(position)}`,
    );
  }

  // The floor has real margin under the smallest legitimate magnitude, so no
  // plausible pick sits anywhere near the boundary.
  const polarSurface = magnitude(
    fromDegrees(0, 90, -10_935),
  );
  assert.ok(
    polarSurface > 6_300_000,
    `smallest real magnitude was ${polarSurface}`,
  );
});

test('an accepted pick converts back to its location', () => {
  const position = fromDegrees(-97.7431, 30.2672, 250);
  assert.equal(isPickedWorldPosition(position), true);
  const carto = toCartographicRadians(position);
  assert.ok(Math.abs(toDegrees(carto.lon) + 97.7431) < 1e-6);
  assert.ok(Math.abs(toDegrees(carto.lat) - 30.2672) < 1e-6);
  assert.ok(Math.abs(carto.height - 250) < 1e-6);
});

test('the ground under a click: the rendered surface, else the ellipsoid, never the sky', async () => {
  const { pickGroundPosition } = await import('../input/dispatcher.js');
  const { bindRenderer } = await import('../render/rendererOf.js');
  const ground = { x: 6378137, y: 0, z: 0 };
  const sky = { x: 500, y: 0, z: 0 };
  // Through the renderer's query port.
  const viewer = (picked, ellipsoid) => {
    const host = {};
    bindRenderer(host, {
      query: { pickPosition: () => picked, pickEllipsoid: () => ellipsoid },
    });
    return host;
  };
  assert.equal(pickGroundPosition(viewer(ground, null), {}), ground);
  assert.equal(pickGroundPosition(viewer(sky, ground), {}), ground);
  assert.equal(pickGroundPosition(viewer(undefined, undefined), {}), null);
  assert.equal(pickGroundPosition(null, {}), null);
  assert.equal(pickGroundPosition({}, {}), null, 'no query port');
});

test('a surface pick is nothing, or Google 3D tile content without an id', async () => {
  const { isSurfacePick } = await import('./scenePick.js');
  assert.equal(isSurfacePick(undefined), true);
  assert.equal(isSurfacePick({ content: {} }), true);
  assert.equal(isSurfacePick({ primitive: { isCesium3DTileset: true } }), true);
  assert.equal(isSurfacePick({ id: 'flight:1', content: {} }), false);
  assert.equal(isSurfacePick({ primitive: {} }), false, 'an unnamed primitive');
});
