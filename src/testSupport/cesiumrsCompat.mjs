/**
 * @module testSupport/cesiumrsCompat
 * @description A CesiumJS-shaped namespace for tests that have not been
 * ported to the renderer contract yet, implemented over the project's own
 * Cesium-free geodesy (`src/geo`) and colours (`src/render/color.js`).
 *
 * This is a test-only bridge: it is not a renderer and must not be imported
 * by runtime code. Port a test to `createRendererHarness` (or the flat
 * `geo` functions) when you touch it; this module shrinks as that happens.
 *
 * The maths, geometry, colours and events the tests use are provided, plus
 * a Cesium-shaped `Camera`, `EntityView`, collections and primitives for
 * tests whose code still holds a viewer double. There is no `Viewer`,
 * `CesiumWidget` or rendering engine: nobody renders here, and a test that
 * needs drawing belongs on the stub renderer's harness instead.
 */
import {
  WGS84 as GEO_WGS84,
  add,
  addSeconds,
  clone,
  cloneJulian,
  compareJulian,
  cross,
  distance,
  distanceSquared,
  dot,
  eastNorthUp,
  equalsEpsilon,
  fromDegrees,
  fromRadians,
  geodeticSurfaceNormal,
  geodesicAt,
  headingPitchRollFrame,
  headingPitchRollQuaternion,
  horizonFrom,
  julianFromEpochMs,
  julianNow,
  julianToEpochMs,
  magnitude,
  moonPositionInertial,
  multiplyQuaternions,
  negativePiToPi,
  negate,
  normalize,
  offsetFromHeadingPitchRange,
  quat,
  rayEllipsoid,
  scale,
  scaleToGeodeticSurface,
  secondsDifference,
  sub,
  sunPositionInertial,
  temeToPseudoFixed,
  toCartographicRadians,
  toDegrees,
  toRadians,
  totalDays,
  vec,
  zeroToTwoPi,
} from '../geo/index.js';
import {
  fromAxes,
  fromAxisAngle as geoFromAxisAngle,
  fromHeadingPitchRoll as geoFromHpr,
  toAxes,
} from '../geo/quaternion.js';
import { geodesicInverse } from '../geo/geodesic.js';
import {
  rectangleCenter,
  rectangleHeight,
  rectangleWidth,
} from '../geo/rectangle.js';
import { rhumbLine } from '../geo/rhumb.js';
import {
  IDENTITY as GEO_IDENTITY,
  framePoint,
  frameVector,
  inverseFramePoint,
  inverseFrameVector,
  isIdentity as isIdentityFrame,
} from '../geo/frames.js';
import { headingPitchRollColumns } from '../render/stub/math.js';
import { NAMED_COLORS, cssColor, hslColor } from '../render/color.js';
import { frustumPlanes, poseProjector } from '../geo/frustum.js';
import { sphereFromPoints, sphereUnion } from '../geo/sphere.js';

const PI = Math.PI;
const TWO_PI = PI * 2;
const PI_OVER_TWO = PI / 2;

const plain = (p) => ({ x: p.x, y: p.y, z: p.z });

/** A Julian date's epoch ms, exact when the compat made it from one. */
const epochMsOf = (value) =>
  Number.isFinite(value?._epochMs) ? value._epochMs : julianToEpochMs(value);

const EPSILON3 = 1e-3;

/** Rodrigues' rotation of `v` about unit `axis` by `angle`. */
const rotateAboutAxis = (v, axis, angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = dot(axis, v) * (1 - c);
  return {
    x: v.x * c + (axis.y * v.z - axis.z * v.y) * s + axis.x * k,
    y: v.y * c + (axis.z * v.x - axis.x * v.z) * s + axis.y * k,
    z: v.z * c + (axis.x * v.y - axis.y * v.x) * s + axis.z * k,
  };
};

/** Heading of a local direction and up, radians clockwise from north. */
const cameraHeadingOf = (direction, up) => {
  const h = !equalsEpsilon(Math.abs(direction.z), 1.0, EPSILON3)
    ? Math.atan2(direction.y, direction.x) - PI_OVER_TWO
    : Math.atan2(up.y, up.x) - PI_OVER_TWO;
  return TWO_PI - zeroToTwoPi(h);
};

const cameraPitchOf = (direction) =>
  PI_OVER_TWO - Math.acos(Math.max(-1, Math.min(1, direction.z)));

const cameraRollOf = (direction, up, right) =>
  equalsEpsilon(Math.abs(direction.z), 1.0, EPSILON3)
    ? 0
    : zeroToTwoPi(Math.atan2(-right.z, up.z) + TWO_PI);

/** A 4x4 matrix as Cesium stores one: column-major, 16 numbers. */
export class Matrix4 extends Float64Array {
  constructor(...values) {
    if (values.length === 16) super(values);
    else if (values.length === 1 && values[0] instanceof Float64Array)
      super(values[0]);
    else if (values.length === 1 && Array.isArray(values[0])) super(values[0]);
    else super(16);
  }
}

/** A 3x3 matrix, column-major, 9 numbers. */
export class Matrix3 extends Float64Array {
  constructor(...values) {
    if (values.length === 9) super(values);
    else if (values.length === 1 && values[0] instanceof Float64Array)
      super(values[0]);
    else if (values.length === 1 && Array.isArray(values[0])) super(values[0]);
    else super(9);
  }
}

const IDENTITY4 = new Matrix4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
const IDENTITY3 = new Matrix3(1, 0, 0, 0, 1, 0, 0, 0, 1);

export class Cartesian3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static fromDegrees(lon, lat, height = 0, ellipsoid, result) {
    const p = fromDegrees(lon, lat, height);
    return Cartesian3.clone(p, result);
  }

  static fromRadians(lon, lat, height = 0, ellipsoid, result) {
    const p = fromRadians(lon, lat, height);
    return Cartesian3.clone(p, result);
  }

  static fromElements(x, y, z, result) {
    if (!result) return new Cartesian3(x, y, z);
    result.x = x;
    result.y = y;
    result.z = z;
    return result;
  }

  static clone(value, result) {
    if (!value) return undefined;
    if (!result) return new Cartesian3(value.x, value.y, value.z);
    result.x = value.x;
    result.y = value.y;
    result.z = value.z;
    return result;
  }

  static add(left, right, result) {
    const v = add(left, right);
    return Cartesian3.clone(v, result);
  }

  static subtract(left, right, result) {
    const v = sub(left, right);
    return Cartesian3.clone(v, result);
  }

  static multiplyByScalar(value, scalar, result) {
    return Cartesian3.clone(scale(value, scalar), result);
  }

  static divideByScalar(value, scalar, result) {
    return Cartesian3.clone(scale(value, 1 / scalar), result);
  }

  static multiplyComponents(left, right, result) {
    return Cartesian3.clone(
      {
        x: left.x * right.x,
        y: left.y * right.y,
        z: left.z * right.z,
      },
      result,
    );
  }

  static negate(value, result) {
    return Cartesian3.clone(negate(value), result);
  }

  static abs(value, result) {
    return Cartesian3.clone(
      { x: Math.abs(value.x), y: Math.abs(value.y), z: Math.abs(value.z) },
      result,
    );
  }

  static dot(left, right) {
    return dot(left, right);
  }

  static cross(left, right, result) {
    return Cartesian3.clone(cross(left, right), result);
  }

  static magnitude(value) {
    return magnitude(value);
  }

  static magnitudeSquared(value) {
    return dot(value, value);
  }

  static distance(left, right) {
    return distance(left, right);
  }

  static distanceSquared(left, right) {
    return distanceSquared(left, right);
  }

  static normalize(value, result) {
    return Cartesian3.clone(normalize(value), result);
  }

  static lerp(start, end, t, result) {
    return Cartesian3.clone(
      {
        x: (1 - t) * start.x + t * end.x,
        y: (1 - t) * start.y + t * end.y,
        z: (1 - t) * start.z + t * end.z,
      },
      result,
    );
  }

  static angleBetween(left, right) {
    const denominator = magnitude(left) * magnitude(right);
    const cosine = dot(left, right) / denominator;
    return Math.acos(Math.max(-1, Math.min(1, cosine)));
  }

  static equals(left, right) {
    return (
      left === right ||
      (left.x === right.x && left.y === right.y && left.z === right.z)
    );
  }

  static equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
    const epsilon = absoluteEpsilon ?? relativeEpsilon ?? 0;
    const scale = Math.max(
      1,
      Math.abs(left.x),
      Math.abs(left.y),
      Math.abs(left.z),
      Math.abs(right.x),
      Math.abs(right.y),
      Math.abs(right.z),
    );
    const tolerance = Math.max(epsilon, (relativeEpsilon ?? epsilon) * scale);
    return (
      Math.abs(left.x - right.x) <= tolerance &&
      Math.abs(left.y - right.y) <= tolerance &&
      Math.abs(left.z - right.z) <= tolerance
    );
  }

  static fromCartesian4(cartesian, result) {
    return Cartesian3.clone(cartesian, result);
  }
}

Cartesian3.ZERO = Object.freeze(new Cartesian3(0, 0, 0));
Cartesian3.UNIT_X = Object.freeze(new Cartesian3(1, 0, 0));
Cartesian3.UNIT_Y = Object.freeze(new Cartesian3(0, 1, 0));
Cartesian3.UNIT_Z = Object.freeze(new Cartesian3(0, 0, 1));

export class Cartesian2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static clone(value, result) {
    if (!value) return undefined;
    const out = result ?? new Cartesian2();
    out.x = value.x;
    out.y = value.y;
    return out;
  }

  static fromElements(x, y, result) {
    const out = result ?? new Cartesian2();
    out.x = x;
    out.y = y;
    return out;
  }

  static ZERO;

  static distance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  static add(left, right, result) {
    const out = result ?? new Cartesian2();
    out.x = left.x + right.x;
    out.y = left.y + right.y;
    return out;
  }

  static subtract(left, right, result) {
    const out = result ?? new Cartesian2();
    out.x = left.x - right.x;
    out.y = left.y - right.y;
    return out;
  }
}

Cartesian2.ZERO = Object.freeze(new Cartesian2(0, 0));

export class Cartesian4 {
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static clone(value, result) {
    const out = result ?? new Cartesian4();
    out.x = value.x;
    out.y = value.y;
    out.z = value.z;
    out.w = value.w;
    return out;
  }

  static fromElements(x, y, z, w, result) {
    const out = result ?? new Cartesian4();
    out.x = x;
    out.y = y;
    out.z = z;
    out.w = w;
    return out;
  }

  static fromCartesian3(value, w = 0, result) {
    return Cartesian4.fromElements(value.x, value.y, value.z, w, result);
  }
}

const carto = (lon, lat, height = 0) => ({
  longitude: lon,
  latitude: lat,
  height,
});

export class Cartographic {
  constructor(longitude = 0, latitude = 0, height = 0) {
    this.longitude = longitude;
    this.latitude = latitude;
    this.height = height;
  }

  static fromRadians(longitude, latitude, height = 0, result) {
    return Cartographic.clone(carto(longitude, latitude, height), result);
  }

  static fromDegrees(longitude, latitude, height = 0, result) {
    return Cartographic.fromRadians(
      toRadians(longitude),
      toRadians(latitude),
      height,
      result,
    );
  }

  static fromCartesian(cartesian, ellipsoid, result) {
    if (!cartesian) return undefined;
    const c = toCartographicRadians(cartesian, ellipsoid?.geo);
    if (!c) return undefined;
    return Cartographic.clone(carto(c.lon, c.lat, c.height), result);
  }

  static toCartesian(cartographic, ellipsoid, result) {
    const p = fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height ?? 0,
    );
    return Cartesian3.clone(p, result);
  }

  static clone(value, result) {
    const out = result ?? new Cartographic();
    out.longitude = value.longitude ?? value.lon;
    out.latitude = value.latitude ?? value.lat;
    out.height = value.height ?? 0;
    return out;
  }

  static equals(left, right) {
    return (
      left === right ||
      (left.longitude === right.longitude &&
        left.latitude === right.latitude &&
        left.height === right.height)
    );
  }

  static equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
    const epsilon = absoluteEpsilon ?? relativeEpsilon ?? 0;
    return (
      Math.abs(left.longitude - right.longitude) <= epsilon &&
      Math.abs(left.latitude - right.latitude) <= epsilon &&
      Math.abs(left.height - right.height) <= epsilon
    );
  }
}

Cartographic.ZERO = Object.freeze(new Cartographic(0, 0, 0));

/** The project's ellipsoid record as Cesium's Ellipsoid object. */
function asEllipsoid(geo) {
  return {
    geo,
    radii: geo.radii,
    radiiSquared: geo.radiiSquared,
    oneOverRadii: geo.oneOverRadii,
    oneOverRadiiSquared: geo.oneOverRadiiSquared,
    minimumRadius: Math.min(geo.radii.x, geo.radii.y, geo.radii.z),
    maximumRadius: Math.max(geo.radii.x, geo.radii.y, geo.radii.z),
    cartographicToCartesian(cartographic, result) {
      return Cartesian3.clone(
        fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height ?? 0,
        ),
        result,
      );
    },
    cartesianToCartographic(cartesian, result) {
      const c = toCartographicRadians(cartesian, geo);
      if (!c) return undefined;
      return Cartographic.clone(carto(c.lon, c.lat, c.height), result);
    },
    geodeticSurfaceNormal(cartesian, result) {
      return Cartesian3.clone(geodeticSurfaceNormal(cartesian, geo), result);
    },
    geodeticSurfaceNormalCartographic(cartographic, result) {
      const p = geodeticSurfaceNormal(
        fromRadians(cartographic.longitude, cartographic.latitude, 0),
        geo,
      );
      return Cartesian3.clone(p, result);
    },
    scaleToGeodeticSurface(cartesian, result) {
      return Cartesian3.clone(scaleToGeodeticSurface(cartesian, geo), result);
    },
  };
}

const fromRadii = (x, y = x, z = x) =>
  asEllipsoid({
    radii: { x, y, z },
    radiiSquared: { x: x * x, y: y * y, z: z * z },
    oneOverRadii: { x: 1 / x, y: 1 / y, z: 1 / z },
    oneOverRadiiSquared: { x: 1 / (x * x), y: 1 / (y * y), z: 1 / (z * z) },
  });

const ellipsoidOf = (value) =>
  value && typeof value === 'object' && 'geo' in value
    ? value
    : value?.radii
      ? asEllipsoid(value)
      : Ellipsoid.WGS84;

export class Ellipsoid {
  constructor(x = 1, y = x, z = x) {
    Object.assign(this, fromRadii(x, y, z));
  }

  static WGS84 = fromRadii(
    GEO_WGS84.radii.x,
    GEO_WGS84.radii.y,
    GEO_WGS84.radii.z,
  );

  static UNIT_SPHERE = fromRadii(1);

  static fromCartesian3(radii) {
    return fromRadii(radii.x, radii.y, radii.z);
  }

  cartographicToCartesian(cartographic, result) {
    return this.geo
      ? Cartesian3.clone(
          fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            cartographic.height ?? 0,
          ),
          result,
        )
      : undefined;
  }

  cartesianToCartographic(cartesian, result) {
    const c = toCartographicRadians(cartesian, this.geo);
    if (!c) return undefined;
    return Cartographic.clone(carto(c.lon, c.lat, c.height), result);
  }

  geodeticSurfaceNormal(point, result) {
    return Cartesian3.clone(geodeticSurfaceNormal(point, this.geo), result);
  }

  scaleToGeodeticSurface(point, result) {
    return Cartesian3.clone(scaleToGeodeticSurface(point, this.geo), result);
  }
}

Ellipsoid.default = Ellipsoid.WGS84;
Ellipsoid.WGS84.geo = GEO_WGS84;
Ellipsoid.UNIT_SPHERE.geo = {
  radii: { x: 1, y: 1, z: 1 },
  radiiSquared: { x: 1, y: 1, z: 1 },
  oneOverRadii: { x: 1, y: 1, z: 1 },
  oneOverRadiiSquared: { x: 1, y: 1, z: 1 },
};

export { ellipsoidOf };

const CesiumMath = {
  PI,
  TWO_PI,
  PI_OVER_TWO,
  PI_OVER_FOUR: PI / 4,
  PI_OVER_SIX: PI / 6,
  ONE_OVER_PI: 1 / PI,
  EPSILON1: 0.1,
  EPSILON2: 0.01,
  EPSILON3: 0.001,
  EPSILON4: 0.0001,
  EPSILON5: 0.00001,
  EPSILON6: 0.000001,
  EPSILON7: 0.0000001,
  EPSILON8: 0.00000001,
  EPSILON9: 0.000000001,
  EPSILON10: 0.0000000001,
  EPSILON11: 0.00000000001,
  EPSILON12: 0.000000000001,
  EPSILON13: 0.0000000000001,
  EPSILON14: 0.00000000000001,
  EPSILON15: 0.000000000000001,
  EPSILON16: 0.0000000000000001,
  EPSILON17: 0.00000000000000001,
  EPSILON18: 0.000000000000000001,
  EPSILON19: 0.0000000000000000001,
  EPSILON20: 0.00000000000000000001,
  toRadians,
  toDegrees,
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  },
  lerp(start, end, t) {
    return start + (end - start) * t;
  },
  sign(value) {
    return value < 0 ? -1 : value > 0 ? 1 : 0;
  },
  equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
    const epsilon = absoluteEpsilon ?? relativeEpsilon ?? 0;
    const tolerance = Math.max(
      Math.abs(left) * (relativeEpsilon ?? epsilon),
      epsilon,
    );
    return Math.abs(left - right) <= tolerance;
  },
  negativePiToPi,
  zeroToTwoPi,
  acosClamped(value) {
    return Math.acos(Math.max(-1, Math.min(1, value)));
  },
  asinClamped(value) {
    return Math.asin(Math.max(-1, Math.min(1, value)));
  },
  mod(m, n) {
    return ((m % n) + n) % n;
  },
  toSNorm(value) {
    return Math.round((Math.min(Math.max(value, 0), 1) * 2 - 1) * 32767);
  },
  fromSNorm(value) {
    return (Math.min(Math.max(value, -32767), 32767) + 32767) / (2 * 32767);
  },
};

export { CesiumMath as Math };

Object.assign(Matrix4, {
  IDENTITY: IDENTITY4,
  ZERO: new Matrix4(),
  clone(matrix, result) {
    const out = result ?? new Matrix4();
    out.set(matrix);
    return out;
  },
  fromTranslation(translation, result) {
    const out = result ?? new Matrix4();
    out.set(IDENTITY4);
    out[12] = translation.x;
    out[13] = translation.y;
    out[14] = translation.z;
    return out;
  },
  fromRotation(rotation, result) {
    const out = result ?? new Matrix4();
    out.set(IDENTITY4);
    for (let column = 0; column < 3; column++)
      for (let row = 0; row < 3; row++)
        out[column * 4 + row] = rotation[column * 3 + row];
    return out;
  },
  fromRotationTranslation(rotation, translation, result) {
    const out = Matrix4.fromRotation(rotation, result);
    out[12] = translation.x;
    out[13] = translation.y;
    out[14] = translation.z;
    return out;
  },
  fromUniformScale(scale, result) {
    const out = result ?? new Matrix4();
    out.set(IDENTITY4);
    out[0] = scale;
    out[5] = scale;
    out[10] = scale;
    return out;
  },
  fromScale(scaleValue, result) {
    const out = result ?? new Matrix4();
    out.set(IDENTITY4);
    out[0] = scaleValue.x;
    out[5] = scaleValue.y;
    out[10] = scaleValue.z;
    return out;
  },
  multiply(left, right, result) {
    const out = result ?? new Matrix4();
    const l = left;
    const r = right;
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        out[column * 4 + row] =
          l[row] * r[column * 4] +
          l[4 + row] * r[column * 4 + 1] +
          l[8 + row] * r[column * 4 + 2] +
          l[12 + row] * r[column * 4 + 3];
      }
    }
    return out;
  },
  multiplyTransformation(left, right, result) {
    return Matrix4.multiply(left, right, result);
  },
  multiplyByVector(matrix, cartesian, result) {
    const x = cartesian.x;
    const y = cartesian.y;
    const z = cartesian.z;
    const w = cartesian.w;
    const out = result ?? new Cartesian4();
    out.x = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    out.y = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    out.z = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    out.w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;
    return out;
  },
  multiplyByPoint(matrix, cartesian, result) {
    const x = cartesian.x;
    const y = cartesian.y;
    const z = cartesian.z;
    const out = result ?? new Cartesian3();
    out.x = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    out.y = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    out.z = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (w !== 1 && w !== 0) {
      out.x /= w;
      out.y /= w;
      out.z /= w;
    }
    return out;
  },
  multiplyByPointAsVector(matrix, cartesian, result) {
    const x = cartesian.x;
    const y = cartesian.y;
    const z = cartesian.z;
    const out = result ?? new Cartesian3();
    out.x = matrix[0] * x + matrix[4] * y + matrix[8] * z;
    out.y = matrix[1] * x + matrix[5] * y + matrix[9] * z;
    out.z = matrix[2] * x + matrix[6] * y + matrix[10] * z;
    return out;
  },
  getColumn(matrix, index, result) {
    const out = result ?? new Cartesian4();
    out.x = matrix[index * 4];
    out.y = matrix[index * 4 + 1];
    out.z = matrix[index * 4 + 2];
    out.w = matrix[index * 4 + 3];
    return out;
  },
  getRow(matrix, index, result) {
    const out = result ?? new Cartesian4();
    out.x = matrix[index];
    out.y = matrix[index + 4];
    out.z = matrix[index + 8];
    out.w = matrix[index + 12];
    return out;
  },
  setTranslation(matrix, translation, result) {
    const out = result ?? matrix;
    if (out !== matrix) out.set(matrix);
    out[12] = translation.x;
    out[13] = translation.y;
    out[14] = translation.z;
    return out;
  },
  getTranslation(matrix, result) {
    const out = result ?? new Cartesian3();
    out.x = matrix[12];
    out.y = matrix[13];
    out.z = matrix[14];
    return out;
  },
  getMatrix3(matrix, result) {
    const out = result ?? new Matrix3();
    for (let column = 0; column < 3; column++)
      for (let row = 0; row < 3; row++)
        out[column * 3 + row] = matrix[column * 4 + row];
    return out;
  },
  computeView(position, direction, up, right, result) {
    const out = result ?? new Matrix4();
    const r = right ?? normalize(cross(direction, up));
    out[0] = r.x;
    out[1] = up.x;
    out[2] = -direction.x;
    out[3] = 0;
    out[4] = r.y;
    out[5] = up.y;
    out[6] = -direction.y;
    out[7] = 0;
    out[8] = r.z;
    out[9] = up.z;
    out[10] = -direction.z;
    out[11] = 0;
    out[12] = -dot(r, position);
    out[13] = -dot(up, position);
    out[14] = dot(direction, position);
    out[15] = 1;
    return out;
  },
  inverse(matrix, result) {
    const out = result ?? new Matrix4();
    const m = matrix;
    const a00 = m[0],
      a01 = m[1],
      a02 = m[2],
      a03 = m[3];
    const a10 = m[4],
      a11 = m[5],
      a12 = m[6],
      a13 = m[7];
    const a20 = m[8],
      a21 = m[9],
      a22 = m[10],
      a23 = m[11];
    const a30 = m[12],
      a31 = m[13],
      a32 = m[14],
      a33 = m[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (det === 0) return undefined;
    const inv = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inv;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inv;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inv;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inv;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inv;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inv;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inv;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inv;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inv;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inv;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inv;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inv;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inv;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inv;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inv;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inv;
    return out;
  },
  inverseTransformation(matrix, result) {
    const out = result ?? new Matrix4();
    const m = matrix;
    // A rigid transform's inverse: transpose the rotation, rotate the
    // translation back and negate it.
    out[0] = m[0];
    out[1] = m[4];
    out[2] = m[8];
    out[3] = 0;
    out[4] = m[1];
    out[5] = m[5];
    out[6] = m[9];
    out[7] = 0;
    out[8] = m[2];
    out[9] = m[6];
    out[10] = m[10];
    out[11] = 0;
    out[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
    out[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
    out[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]);
    out[15] = 1;
    return out;
  },
  equals(left, right) {
    for (let i = 0; i < 16; i++) if (left[i] !== right[i]) return false;
    return true;
  },
  equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
    const epsilon = absoluteEpsilon ?? relativeEpsilon ?? 0;
    for (let i = 0; i < 16; i++)
      if (Math.abs(left[i] - right[i]) > epsilon) return false;
    return true;
  },
  toArray(matrix, result = []) {
    for (let i = 0; i < 16; i++) result[i] = matrix[i];
    return result;
  },
});

export { Matrix4 as Matrix4Class };

Object.assign(Matrix3, {
  IDENTITY: IDENTITY3,
  ZERO: new Matrix3(),
  clone(matrix, result) {
    const out = result ?? new Matrix3();
    out.set(matrix);
    return out;
  },
  fromRotationX(angle, result) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return Matrix3.clone(new Matrix3(1, 0, 0, 0, c, s, 0, -s, c), result);
  },
  fromRotationY(angle, result) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return Matrix3.clone(new Matrix3(c, 0, -s, 0, 1, 0, s, 0, c), result);
  },
  fromRotationZ(angle, result) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return Matrix3.clone(new Matrix3(c, s, 0, -s, c, 0, 0, 0, 1), result);
  },
  fromQuaternion(quaternion, result) {
    const axes = toAxes(quaternion);
    const out = result ?? new Matrix3();
    out[0] = axes.x.x;
    out[1] = axes.x.y;
    out[2] = axes.x.z;
    out[3] = axes.y.x;
    out[4] = axes.y.y;
    out[5] = axes.y.z;
    out[6] = axes.z.x;
    out[7] = axes.z.y;
    out[8] = axes.z.z;
    return out;
  },
  fromHeadingPitchRoll(headingPitchRoll, result) {
    return Matrix3.fromQuaternion(
      Quaternion.fromHeadingPitchRoll(headingPitchRoll),
      result,
    );
  },
  multiply(left, right, result) {
    const out = result ?? new Matrix3();
    for (let column = 0; column < 3; column++) {
      for (let row = 0; row < 3; row++) {
        out[column * 3 + row] =
          left[row] * right[column * 3] +
          left[3 + row] * right[column * 3 + 1] +
          left[6 + row] * right[column * 3 + 2];
      }
    }
    return out;
  },
  multiplyByVector(matrix, cartesian, result) {
    const out = result ?? new Cartesian3();
    out.x =
      matrix[0] * cartesian.x +
      matrix[3] * cartesian.y +
      matrix[6] * cartesian.z;
    out.y =
      matrix[1] * cartesian.x +
      matrix[4] * cartesian.y +
      matrix[7] * cartesian.z;
    out.z =
      matrix[2] * cartesian.x +
      matrix[5] * cartesian.y +
      matrix[8] * cartesian.z;
    return out;
  },
  getColumn(matrix, index, result) {
    const out = result ?? new Cartesian3();
    out.x = matrix[index * 3];
    out.y = matrix[index * 3 + 1];
    out.z = matrix[index * 3 + 2];
    return out;
  },
  toArray(matrix, result = []) {
    for (let i = 0; i < 9; i++) result[i] = matrix[i];
    return result;
  },
  equals(left, right) {
    for (let i = 0; i < 9; i++) if (left[i] !== right[i]) return false;
    return true;
  },
});

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static fromAxisAngle(axis, angle, result) {
    return Object.assign(
      result ?? new Quaternion(),
      geoFromAxisAngle(axis, angle),
    );
  }

  static fromHeadingPitchRoll(headingPitchRoll, result) {
    return Object.assign(
      result ?? new Quaternion(),
      geoFromHpr(hprOf(headingPitchRoll)),
    );
  }

  static fromRotationMatrix(matrix, result) {
    const axes = {
      x: { x: matrix[0], y: matrix[1], z: matrix[2] },
      y: { x: matrix[3], y: matrix[4], z: matrix[5] },
      z: { x: matrix[6], y: matrix[7], z: matrix[8] },
    };
    return Object.assign(result ?? new Quaternion(), fromAxes(axes));
  }

  static multiply(left, right, result) {
    return Object.assign(
      result ?? new Quaternion(),
      multiplyQuaternions(left, right),
    );
  }

  static conjugate(quaternion, result) {
    return Object.assign(result ?? new Quaternion(), {
      x: -quaternion.x,
      y: -quaternion.y,
      z: -quaternion.z,
      w: quaternion.w,
    });
  }

  static clone(quaternion, result) {
    return Object.assign(result ?? new Quaternion(), quaternion);
  }

  static equals(left, right) {
    return (
      left === right ||
      (left.x === right.x &&
        left.y === right.y &&
        left.z === right.z &&
        left.w === right.w)
    );
  }

  static equalsEpsilon(left, right, epsilon = 0) {
    return (
      Math.abs(left.x - right.x) <= epsilon &&
      Math.abs(left.y - right.y) <= epsilon &&
      Math.abs(left.z - right.z) <= epsilon &&
      Math.abs(left.w - right.w) <= epsilon
    );
  }
}

Quaternion.IDENTITY = Object.freeze(new Quaternion(0, 0, 0, 1));
Quaternion.ZERO = Object.freeze(new Quaternion(0, 0, 0, 0));

export const HeadingPitchRange = class HeadingPitchRange {
  constructor(heading = 0, pitch = 0, range = 0) {
    this.heading = heading;
    this.pitch = pitch;
    this.range = range;
  }
};

export const HeadingPitchRoll = class HeadingPitchRoll {
  constructor(heading = 0, pitch = 0, roll = 0) {
    this.heading = heading;
    this.pitch = pitch;
    this.roll = roll;
  }
};

function frameToMatrix4(frame, result) {
  const out = result ?? new Matrix4();
  out[0] = frame.x.x;
  out[1] = frame.x.y;
  out[2] = frame.x.z;
  out[3] = 0;
  out[4] = frame.y.x;
  out[5] = frame.y.y;
  out[6] = frame.y.z;
  out[7] = 0;
  out[8] = frame.z.x;
  out[9] = frame.z.y;
  out[10] = frame.z.z;
  out[11] = 0;
  out[12] = frame.origin.x;
  out[13] = frame.origin.y;
  out[14] = frame.origin.z;
  out[15] = 1;
  return out;
}

function frameToMatrix3(frame, result) {
  const out = result ?? new Matrix3();
  out[0] = frame.x.x;
  out[1] = frame.x.y;
  out[2] = frame.x.z;
  out[3] = frame.y.x;
  out[4] = frame.y.y;
  out[5] = frame.y.z;
  out[6] = frame.z.x;
  out[7] = frame.z.y;
  out[8] = frame.z.z;
  return out;
}

const hprOf = (hpr) =>
  hpr instanceof HeadingPitchRoll
    ? hpr
    : {
        heading: hpr?.heading ?? 0,
        pitch: hpr?.pitch ?? 0,
        roll: hpr?.roll ?? 0,
      };

export const Transforms = {
  eastNorthUpToFixedFrame(origin, ellipsoid, result) {
    // At a pole the default renderer's frame keeps its signed zeros: east
    // is +y and north points away from the pole.
    if (Math.abs(origin.x) <= 1e-14 && Math.abs(origin.y) <= 1e-14) {
      const sign = Math.abs(origin.z) <= 1e-14 ? 1 : origin.z > 0 ? 1 : -1;
      return frameToMatrix4(
        {
          x: vec(0, 1, 0),
          y: vec(-1 * sign, 0 * sign, 0 * sign),
          z: vec(0, 0, sign),
          origin,
        },
        result,
      );
    }
    return frameToMatrix4(eastNorthUp(origin), result);
  },
  northEastDownToFixedFrame(origin, ellipsoid, result) {
    const enu = eastNorthUp(origin);
    return frameToMatrix4(
      { x: enu.y, y: enu.x, z: negate(enu.z), origin: enu.origin },
      result,
    );
  },
  headingPitchRollToFixedFrame(
    origin,
    headingPitchRoll,
    ellipsoid,
    fixedFrameTransform,
    result,
  ) {
    return frameToMatrix4(
      headingPitchRollFrame(origin, hprOf(headingPitchRoll)),
      result,
    );
  },
  headingPitchRollQuaternion(
    origin,
    headingPitchRoll,
    ellipsoid,
    fixedFrameTransform,
    result,
  ) {
    return Object.assign(
      result ?? {},
      headingPitchRollQuaternion(origin, hprOf(headingPitchRoll)),
    );
  },
  computeTemeToPseudoFixedMatrix(date, result) {
    return frameToMatrix3(temeToPseudoFixed(epochMsOf(date)), result);
  },
  computeIcrfToFixedMatrix(date, result) {
    return frameToMatrix3(temeToPseudoFixed(epochMsOf(date)), result);
  },
  computeFixedToIcrfMatrix(date, result) {
    return Matrix4.inverse(
      frameToMatrix4(temeToPseudoFixed(epochMsOf(date))),
      result,
    );
  },
};

const frameOfMatrix = (matrix) => ({
  x: { x: matrix[0], y: matrix[1], z: matrix[2] },
  y: { x: matrix[4], y: matrix[5], z: matrix[6] },
  z: { x: matrix[8], y: matrix[9], z: matrix[10] },
  origin: { x: matrix[12], y: matrix[13], z: matrix[14] },
});

const columnsFor = (heading, pitch, roll) => {
  const c = headingPitchRollColumns(heading, pitch, roll);
  return { direction: c.direction, up: c.up };
};

/**
 * A Cesium-shaped camera over the project's own geodesy, for tests that
 * construct one directly (`new Cesium.Camera(scene)`). It keeps what Cesium
 * keeps: a transform frame, world vectors derived from it, heading, pitch
 * and roll in the east-north-up frame at the eye, and a perspective
 * frustum.
 */
export class Camera {
  constructor(scene = {}) {
    this._scene = scene;
    this._frame = GEO_IDENTITY;
    this._position = vec(0, 0, 0);
    this._direction = vec(0, 0, -1);
    this._up = vec(0, 1, 0);
    this._right = vec(1, 0, 0);
    this.moveStart = new Event();
    this.moveEnd = new Event();
    this.changed = new Event();
    this._currentFlight = null;
    const width = scene.drawingBufferWidth ?? scene.canvas?.clientWidth ?? 1;
    const height = scene.drawingBufferHeight ?? scene.canvas?.clientHeight ?? 1;
    this.frustum = new PerspectiveFrustum({
      fov: PI / 3,
      aspectRatio: height > 0 ? width / height : 1,
      near: 0.1,
      far: 500000000,
    });
    this._pickEllipsoid = scene.mapProjection?.ellipsoid ?? Ellipsoid.WGS84;
    this.mode = scene.mode ?? SceneMode.SCENE3D;
  }

  get viewMatrix() {
    const p = this.positionWC;
    const d = this.directionWC;
    const u = this.upWC;
    const r = this.rightWC;
    return new Matrix4(
      r.x,
      u.x,
      -d.x,
      0,
      r.y,
      u.y,
      -d.y,
      0,
      r.z,
      u.z,
      -d.z,
      0,
      -dot(r, p),
      -dot(u, p),
      dot(d, p),
      1,
    );
  }

  get positionWC() {
    return framePoint(this._frame, this._position);
  }

  get directionWC() {
    return normalize(frameVector(this._frame, this._direction));
  }

  get upWC() {
    return normalize(frameVector(this._frame, this._up));
  }

  get rightWC() {
    return normalize(frameVector(this._frame, this._right));
  }

  get positionCartographic() {
    const c = toCartographicRadians(this.positionWC);
    return c ? carto(c.lon, c.lat, c.height) : undefined;
  }

  get position() {
    return this._position;
  }

  set position(value) {
    this._position = vec(value.x, value.y, value.z);
  }

  get direction() {
    return this._direction;
  }

  set direction(value) {
    this._direction = vec(value.x, value.y, value.z);
  }

  get up() {
    return this._up;
  }

  set up(value) {
    this._up = vec(value.x, value.y, value.z);
  }

  get right() {
    return this._right;
  }

  set right(value) {
    this._right = vec(value.x, value.y, value.z);
  }

  get transform() {
    return frameToMatrix4(this._frame);
  }

  set transform(matrix) {
    this._setFrame(frameOfMatrix(matrix));
  }

  _setFrame(next) {
    const p = this.positionWC;
    const d = this.directionWC;
    const u = this.upWC;
    this._frame = next;
    this._position = inverseFramePoint(next, p);
    this._direction = inverseFrameVector(next, d);
    this._up = inverseFrameVector(next, u);
    this._right = cross(this._direction, this._up);
  }

  /** The eye's direction, up and right in its east-north-up frame. */
  _angles() {
    const enu = eastNorthUp(this.positionWC);
    const d = inverseFrameVector(enu, this.directionWC);
    const u = inverseFrameVector(enu, this.upWC);
    const r = cross(d, u);
    return {
      heading: cameraHeadingOf(d, u),
      pitch: cameraPitchOf(d),
      roll: cameraRollOf(d, u, r),
    };
  }

  get heading() {
    return this._angles().heading;
  }

  set heading(value) {
    this._placeFromAngles({ heading: value });
  }

  get pitch() {
    return this._angles().pitch;
  }

  set pitch(value) {
    this._placeFromAngles({ pitch: value });
  }

  get roll() {
    return this._angles().roll;
  }

  set roll(value) {
    this._placeFromAngles({ roll: value });
  }

  _placeFromAngles(angles) {
    const current = this._angles();
    const { direction, up } = columnsFor(
      angles.heading ?? current.heading,
      angles.pitch ?? current.pitch,
      angles.roll ?? current.roll,
    );
    const enu = eastNorthUp(this.positionWC);
    this._frame = GEO_IDENTITY;
    this._direction = frameVector(enu, direction);
    this._up = frameVector(enu, up);
    this._right = cross(this._direction, this._up);
  }

  setView({ destination, orientation } = {}) {
    const target =
      destination instanceof Object && 'west' in (destination ?? {})
        ? fromRadians(
            (destination.west + destination.east) / 2,
            (destination.south + destination.north) / 2,
            0,
          )
        : (destination ?? this.positionWC);
    const o = orientation ?? {};
    let direction;
    let up;
    if (o.direction) {
      direction = normalize(o.direction);
      const square = sub(o.up, scale(direction, dot(o.up, direction)));
      up = normalize(square);
    } else {
      ({ direction, up } = columnsFor(
        o.heading ?? 0,
        o.pitch ?? -PI_OVER_TWO,
        o.roll ?? 0,
      ));
      const enu = eastNorthUp(target);
      direction = frameVector(enu, direction);
      up = frameVector(enu, up);
    }
    // Cesium keeps the camera's current frame: the view is placed in it.
    const frame = this._frame;
    this._position = inverseFramePoint(frame, target);
    this._direction = inverseFrameVector(frame, direction);
    this._up = inverseFrameVector(frame, up);
    this._right = cross(this._direction, this._up);
  }

  lookAt(target, range = {}) {
    const frame = eastNorthUp(target);
    this._frame = frame;
    this._position = offsetFromHeadingPitchRange(
      range.heading ?? 0,
      range.pitch ?? -PI_OVER_TWO,
      range.range ?? 0,
    );
    this._direction = normalize(negate(this._position));
    this._right = cross(this._direction, vec(0, 0, 1));
    if (dot(this._right, this._right) < 1e-20) this._right = vec(1, 0, 0);
    this._right = normalize(this._right);
    this._up = normalize(cross(this._right, this._direction));
  }

  lookAtTransform(matrix, offset) {
    this._setFrame(frameOfMatrix(matrix));
    if (offset) this._position = vec(offset.x, offset.y, offset.z);
  }

  flyTo(options = {}) {
    const flight = {
      cancel: () => {
        options.cancel?.();
      },
    };
    if (Number.isFinite(options.duration) && options.duration > 0) {
      // A flight Cesium would animate: the eye stays where it is until it
      // ends, and `flying` is true until then.
      this._currentFlight = flight;
      return flight;
    }
    this.setView(options);
    options.complete?.();
    return flight;
  }

  flyToBoundingSphere(sphere, options = {}) {
    const offset = options.offset ?? {};
    const enu = eastNorthUp(sphere.center);
    const eye = framePoint(
      enu,
      offsetFromHeadingPitchRange(
        offset.heading ?? 0,
        offset.pitch ?? -Math.PI / 4,
        offset.range ?? 0,
      ),
    );
    const dir = normalize(sub(sphere.center, eye));
    const up = normalize(cross(cross(dir, vec(0, 0, 1)), dir));
    this.setView({ destination: eye, orientation: { direction: dir, up } });
    const flight = { cancel: () => {} };
    this._currentFlight = flight;
    options.complete?.();
    this._currentFlight = null;
    return flight;
  }

  cancelFlight() {
    const flight = this._currentFlight;
    this._currentFlight = null;
    flight?.cancel?.();
  }

  /** A copy of `camera`, as Cesium's `Camera.clone` gives one. */
  static clone(camera) {
    const copy = Object.create(Camera.prototype);
    copy._scene = camera._scene;
    copy._frame = camera._frame;
    copy._position = vec(
      camera._position.x,
      camera._position.y,
      camera._position.z,
    );
    copy._direction = vec(
      camera._direction.x,
      camera._direction.y,
      camera._direction.z,
    );
    copy._up = vec(camera._up.x, camera._up.y, camera._up.z);
    copy._right = vec(camera._right.x, camera._right.y, camera._right.z);
    copy.moveStart = new Event();
    copy.moveEnd = new Event();
    copy.changed = new Event();
    copy._currentFlight = null;
    copy.frustum = new PerspectiveFrustum({
      fov: camera.frustum.fov,
      aspectRatio: camera.frustum.aspectRatio,
      near: camera.frustum.near,
      far: camera.frustum.far,
    });
    copy._pickEllipsoid = camera._pickEllipsoid;
    copy.mode = camera.mode;
    return copy;
  }

  /** Turn direction, up and right about a world axis through the eye. */
  rotate(axis, angle) {
    const turn = (v) => rotateAboutAxis(v, normalize(axis), angle);
    this._direction = turn(this._direction);
    this._up = turn(this._up);
    this._right = turn(this._right);
  }

  moveForward(distance) {
    this._position = add(this._position, scale(this._direction, distance));
  }

  moveBackward(distance) {
    this.moveForward(-distance);
  }

  moveRight(distance) {
    this._position = add(this._position, scale(this._right, distance));
  }

  moveLeft(distance) {
    this.moveRight(-distance);
  }

  moveUp(distance) {
    this._position = add(this._position, scale(this._up, distance));
  }

  moveDown(distance) {
    this.moveUp(-distance);
  }

  lookRight(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const { direction, up, right } = this;
    this._direction = add(scale(direction, c), scale(right, s));
    this._right = sub(scale(right, c), scale(direction, s));
    this._up = up;
  }

  lookLeft(angle) {
    this.lookRight(-angle);
  }

  lookUp(angle) {
    const axis = normalize(this._right);
    this._direction = rotateAboutAxis(this._direction, axis, angle);
    this._up = rotateAboutAxis(this._up, axis, angle);
  }

  lookDown(angle) {
    this.lookUp(-angle);
  }

  rotateUp(angle) {
    const axis = this.directionWC;
    this._up = rotateAboutAxis(this._up, axis, angle);
    this._right = rotateAboutAxis(this._right, axis, angle);
  }

  rotateDown(angle) {
    this.rotateUp(-angle);
  }

  rotateRight(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const { direction, up, right } = this;
    this._up = add(scale(up, c), scale(right, s));
    this._right = sub(scale(right, c), scale(up, s));
    this._direction = direction;
  }

  rotateLeft(angle) {
    this.rotateRight(-angle);
  }

  getPickRay(position, result) {
    const f = this.frustum;
    const width =
      this._scene.drawingBufferWidth ?? this._scene.canvas?.clientWidth ?? 1;
    const height =
      this._scene.drawingBufferHeight ?? this._scene.canvas?.clientHeight ?? 1;
    const tanPhi = Math.tan(f.fovy * 0.5);
    const tanTheta = f.aspectRatio * tanPhi;
    const nx = (2 / width) * position.x - 1;
    const ny = (2 / height) * (height - position.y) - 1;
    const d = this.directionWC;
    const r = this.rightWC;
    const u = this.upWC;
    const a = nx * tanTheta;
    const b = ny * tanPhi;
    const direction = normalize(
      vec(
        d.x + r.x * a + u.x * b,
        d.y + r.y * a + u.y * b,
        d.z + r.z * a + u.z * b,
      ),
    );
    return new Ray(this.positionWC, direction);
  }

  pickEllipsoid(position, ellipsoid = this._pickEllipsoid) {
    const ray = this.getPickRay(position);
    const hit = IntersectionTests.rayEllipsoid(ray, ellipsoid);
    if (!hit) return undefined;
    const t = hit.start > 0 ? hit.start : hit.stop;
    return Ray.getPoint(ray, t, new Cartesian3());
  }

  computeViewRectangle(ellipsoid = this._pickEllipsoid) {
    const width =
      this._scene.drawingBufferWidth ?? this._scene.canvas?.clientWidth ?? 1;
    const height =
      this._scene.drawingBufferHeight ?? this._scene.canvas?.clientHeight ?? 1;
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([x, y]) => {
      const ray = this.getPickRay(new Cartesian2(x, y));
      const hit = IntersectionTests.rayEllipsoid(ray, ellipsoid);
      if (!hit) return null;
      const t = hit.start > 0 ? hit.start : hit.stop;
      const c = toCartographicRadians(Ray.getPoint(ray, t));
      return c ? c : null;
    });
    if (corners.some((c) => !c)) return undefined;
    return Rectangle.fromRadians(
      Math.min(...corners.map((c) => c.lon)),
      Math.min(...corners.map((c) => c.lat)),
      Math.max(...corners.map((c) => c.lon)),
      Math.max(...corners.map((c) => c.lat)),
    );
  }

  isDestroyed() {
    return false;
  }
}

export const Ray = class Ray {
  constructor(origin = new Cartesian3(), direction = new Cartesian3()) {
    this.origin = origin;
    this.direction = direction;
  }

  static getPoint(ray, t, result) {
    return Cartesian3.clone(
      {
        x: ray.origin.x + ray.direction.x * t,
        y: ray.origin.y + ray.direction.y * t,
        z: ray.origin.z + ray.direction.z * t,
      },
      result,
    );
  }

  getPoint(t, result) {
    return Ray.getPoint(this, t, result);
  }
};

export const IntersectionTests = {
  rayEllipsoid(ray, ellipsoid) {
    const r =
      (ellipsoid?.geo ?? ellipsoid ?? Ellipsoid.WGS84).oneOverRadii ??
      GEO_WGS84.oneOverRadii;
    const q = {
      x: ray.origin.x * r.x,
      y: ray.origin.y * r.y,
      z: ray.origin.z * r.z,
    };
    const w = {
      x: ray.direction.x * r.x,
      y: ray.direction.y * r.y,
      z: ray.direction.z * r.z,
    };
    const a = dot(w, w);
    const b = 2 * dot(q, w);
    const c = dot(q, q) - 1;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return undefined;
    const root = Math.sqrt(discriminant);
    const start = (-b - root) / (2 * a);
    const stop = (-b + root) / (2 * a);
    if (start > stop) return undefined;
    if (start < 0 && stop < 0) return undefined;
    return { start, stop };
  },
  raySphere(ray, sphere) {
    const m = sub(ray.origin, sphere.center);
    const a = dot(ray.direction, ray.direction);
    const b = 2 * dot(m, ray.direction);
    const c = dot(m, m) - sphere.radius * sphere.radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return undefined;
    const root = Math.sqrt(discriminant);
    return { start: (-b - root) / (2 * a), stop: (-b + root) / (2 * a) };
  },
};

export class Rectangle {
  constructor(west = 0, south = 0, east = 0, north = 0) {
    this.west = west;
    this.south = south;
    this.east = east;
    this.north = north;
  }

  get width() {
    return rectangleWidth(this);
  }

  get height() {
    return rectangleHeight(this);
  }

  static fromDegrees(west, south, east, north, result) {
    return Rectangle.clone(
      {
        west: toRadians(west),
        south: toRadians(south),
        east: toRadians(east),
        north: toRadians(north),
      },
      result,
    );
  }

  static fromRadians(west, south, east, north, result) {
    return Rectangle.clone({ west, south, east, north }, result);
  }

  static clone(value, result) {
    const out = result ?? new Rectangle();
    out.west = value.west;
    out.south = value.south;
    out.east = value.east;
    out.north = value.north;
    return out;
  }

  static equals(left, right) {
    return (
      left === right ||
      (left.west === right.west &&
        left.south === right.south &&
        left.east === right.east &&
        left.north === right.north)
    );
  }

  static computeWidth(rectangle) {
    return rectangleWidth(rectangle);
  }

  static computeHeight(rectangle) {
    return rectangleHeight(rectangle);
  }

  static center(rectangle, result) {
    const c = rectangleCenter(rectangle);
    const out = result ?? new Cartographic();
    out.longitude = c.lon;
    out.latitude = c.lat;
    out.height = 0;
    return out;
  }

  static contains(rectangle, cartographic) {
    const lon = cartographic.longitude;
    const lat = cartographic.latitude;
    if (lat < rectangle.south || lat > rectangle.north) return false;
    if (rectangle.east < rectangle.west)
      return lon >= rectangle.west || lon <= rectangle.east;
    return lon >= rectangle.west && lon <= rectangle.east;
  }
}

Rectangle.MAX_VALUE = Object.freeze(
  new Rectangle(-PI, -PI_OVER_TWO, PI, PI_OVER_TWO),
);
export class GregorianDate {
  constructor(
    year = 2000,
    month = 1,
    day = 1,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
    isLeapSecond = false,
  ) {
    Object.assign(this, {
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      isLeapSecond,
    });
  }
}

export const JulianDate = class JulianDate {
  constructor(dayNumber = 0, secondsOfDay = 0) {
    const j = { dayNumber, secondsOfDay };
    this.dayNumber = j.dayNumber;
    this.secondsOfDay = j.secondsOfDay;
  }

  static fromDate(date, result) {
    const out = JulianDate.clone(julianFromEpochMs(date.getTime()), result);
    out._epochMs = date.getTime();
    return out;
  }

  static fromIso8601(iso8601, result) {
    return JulianDate.fromDate(new Date(iso8601), result);
  }

  static now(result) {
    const ms = Date.now();
    const out = JulianDate.clone(julianFromEpochMs(ms), result);
    out._epochMs = ms;
    return out;
  }

  static clone(value, result) {
    if (!value) return undefined;
    const out = result ?? new JulianDate();
    out.dayNumber = value.dayNumber;
    out.secondsOfDay = value.secondsOfDay;
    if (Number.isFinite(value._epochMs)) out._epochMs = value._epochMs;
    else delete out._epochMs;
    return out;
  }

  static addSeconds(value, seconds, result) {
    const out = addSeconds(value, seconds, result ?? new JulianDate());
    if (Number.isFinite(value?._epochMs))
      out._epochMs = value._epochMs + seconds * 1000;
    else delete out._epochMs;
    return out;
  }

  static secondsDifference(left, right) {
    return secondsDifference(left, right);
  }

  static totalDays(value) {
    return totalDays(value);
  }

  static compare(left, right) {
    return compareJulian(left, right);
  }

  static equals(left, right) {
    return compareJulian(left, right) === 0;
  }

  static lessThan(left, right) {
    return compareJulian(left, right) < 0;
  }

  static lessThanOrEquals(left, right) {
    return compareJulian(left, right) <= 0;
  }

  static toDate(value) {
    return new Date(julianToEpochMs(value));
  }

  static toGregorianDate(value, result = new GregorianDate()) {
    const date = new Date(julianToEpochMs(value));
    result.year = date.getUTCFullYear();
    result.month = date.getUTCMonth() + 1;
    result.day = date.getUTCDate();
    result.hour = date.getUTCHours();
    result.minute = date.getUTCMinutes();
    result.second = date.getUTCSeconds();
    result.millisecond = date.getUTCMilliseconds();
    result.isLeapSecond = false;
    return result;
  }

  static computeTaiMinusUtc(value) {
    return 37;
  }

  clone(result) {
    return JulianDate.clone(this, result);
  }

  addSeconds(seconds, result) {
    return JulianDate.addSeconds(this, seconds, result);
  }

  equals(other) {
    return JulianDate.equals(this, other);
  }

  toDate() {
    return JulianDate.toDate(this);
  }
};

export const Color = class Color {
  constructor(red = 1, green = 1, blue = 1, alpha = 1) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  static fromCssColorString(color, result) {
    const rgba = cssColor(color);
    if (!rgba) return undefined;
    const out = result ?? new Color();
    out.red = rgba[0];
    out.green = rgba[1];
    out.blue = rgba[2];
    out.alpha = rgba[3];
    return out;
  }

  static fromHsl(hue, saturation, lightness, alpha = 1, result) {
    const rgba = hslColor(hue, saturation, lightness, alpha);
    const out = result ?? new Color();
    out.red = rgba[0];
    out.green = rgba[1];
    out.blue = rgba[2];
    out.alpha = rgba[3];
    return out;
  }

  static fromBytes(red, green, blue, alpha = 255, result) {
    const out = result ?? new Color();
    out.red = red / 255;
    out.green = green / 255;
    out.blue = blue / 255;
    out.alpha = alpha / 255;
    return out;
  }

  static clone(value, result) {
    const out = result ?? new Color();
    out.red = value.red;
    out.green = value.green;
    out.blue = value.blue;
    out.alpha = value.alpha;
    return out;
  }

  static equals(left, right) {
    return (
      left === right ||
      (left.red === right.red &&
        left.green === right.green &&
        left.blue === right.blue &&
        left.alpha === right.alpha)
    );
  }

  static equalsEpsilon(left, right, epsilon = 0) {
    return (
      Math.abs(left.red - right.red) <= epsilon &&
      Math.abs(left.green - right.green) <= epsilon &&
      Math.abs(left.blue - right.blue) <= epsilon &&
      Math.abs(left.alpha - right.alpha) <= epsilon
    );
  }

  static floatToByte(value) {
    return value <= 0 ? 0 : value >= 1 ? 255 : Math.round(value * 255);
  }

  static byteToFloat(value) {
    return value / 255;
  }

  static toCssColorString(color) {
    const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const base = `${byte(color.red)},${byte(color.green)},${byte(color.blue)}`;
    return color.alpha === 1 ? `rgb(${base})` : `rgba(${base},${color.alpha})`;
  }

  static withAlpha(color, alpha, result) {
    return Color.clone({ ...color, alpha }, result);
  }

  static pack(color, result) {
    if (Array.isArray(result)) {
      result[0] = color.red;
      result[1] = color.green;
      result[2] = color.blue;
      result[3] = color.alpha;
      return result;
    }
    const value =
      ((Math.round(color.red * 255) << 24) |
        (Math.round(color.green * 255) << 16) |
        (Math.round(color.blue * 255) << 8) |
        Math.round(color.alpha * 255)) >>>
      0;
    return result ? ((result.value = value), result) : value;
  }

  static unpack(value, result) {
    const out = result ?? new Color();
    out.red = ((value >>> 24) & 0xff) / 255;
    out.green = ((value >>> 16) & 0xff) / 255;
    out.blue = ((value >>> 8) & 0xff) / 255;
    out.alpha = (value & 0xff) / 255;
    return out;
  }

  toCssHexString() {
    const byte = (v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0');
    const base = `#${byte(this.red)}${byte(this.green)}${byte(this.blue)}`;
    return this.alpha < 1 ? `${base}${byte(this.alpha)}` : base;
  }

  toCssColorString() {
    return Color.toCssColorString(this);
  }

  withAlpha(alpha, result) {
    return Color.withAlpha(this, alpha, result);
  }
};

Object.assign(Color, {
  WHITE: Object.freeze(new Color(1, 1, 1, 1)),
  BLACK: Object.freeze(new Color(0, 0, 0, 1)),
  RED: Object.freeze(new Color(1, 0, 0, 1)),
  GREEN: Object.freeze(new Color(0, 0.5, 0, 1)),
  BLUE: Object.freeze(new Color(0, 0, 1, 1)),
  YELLOW: Object.freeze(new Color(1, 1, 0, 1)),
  CYAN: Object.freeze(new Color(0, 1, 1, 1)),
  MAGENTA: Object.freeze(new Color(1, 0, 1, 1)),
  ORANGE: Object.freeze(new Color(1, 165 / 255, 0, 1)),
  GRAY: Object.freeze(new Color(0.5, 0.5, 0.5, 1)),
  LIGHTGRAY: Object.freeze(new Color(0.827, 0.827, 0.827, 1)),
  DARKGRAY: Object.freeze(new Color(0.663, 0.663, 0.663, 1)),
  TRANSPARENT: Object.freeze(new Color(0, 0, 0, 0)),
});

// Every CSS colour name the default renderer knows, as its own constant.
for (const name of Object.keys(NAMED_COLORS))
  if (!Object.hasOwn(Color, name))
    Color[name] = Object.freeze(Color.fromCssColorString(name));

export const Event = class Event {
  constructor() {
    this._listeners = [];
  }

  addEventListener(listener, scope) {
    const entry = { listener, scope };
    this._listeners.push(entry);
    return () => this.removeEventListener(listener, scope);
  }

  removeEventListener(listener, scope) {
    const index = this._listeners.findIndex(
      (entry) => entry.listener === listener && entry.scope === scope,
    );
    if (index >= 0) this._listeners.splice(index, 1);
  }

  raiseEvent(...args) {
    for (const { listener, scope } of [...this._listeners])
      listener.apply(scope, args);
  }

  get numberOfListeners() {
    return this._listeners.length;
  }
};

export const SceneMode = Object.freeze({
  MORPHING: 0,
  COLUMBUS_VIEW: 1,
  SCENE2D: 2,
  SCENE3D: 3,
});

export const MapMode2D = Object.freeze({ ROTATE: 0, INFINITE_SCROLL: 1 });

export const ScreenSpaceEventType = Object.freeze({
  LEFT_DOWN: 0,
  LEFT_UP: 1,
  LEFT_CLICK: 2,
  LEFT_DOUBLE_CLICK: 3,
  RIGHT_DOWN: 5,
  RIGHT_UP: 6,
  RIGHT_CLICK: 7,
  MIDDLE_DOWN: 10,
  MIDDLE_UP: 11,
  MIDDLE_CLICK: 12,
  MOUSE_MOVE: 15,
  WHEEL: 16,
  PINCH_START: 17,
  PINCH_END: 18,
  PINCH_MOVE: 19,
});

/** A handler with Cesium's action map, for a viewer double with none. */
export class ScreenSpaceEventHandler {
  constructor() {
    this.actions = new Map();
  }

  static key(type, modifier) {
    return modifier === undefined ? type : `${type}+${modifier}`;
  }

  setInputAction(fn, type, modifier) {
    this.actions.set(ScreenSpaceEventHandler.key(type, modifier), fn);
  }

  getInputAction(type, modifier) {
    return this.actions.get(ScreenSpaceEventHandler.key(type, modifier));
  }

  removeInputAction(type, modifier) {
    this.actions.delete(ScreenSpaceEventHandler.key(type, modifier));
  }

  fire(type, event, modifier) {
    this.getInputAction(type, modifier)?.(event);
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    this.actions.clear();
  }
}

export const RequestState = Object.freeze({
  UNISSUED: 0,
  ISSUED: 1,
  ACTIVE: 2,
  RECEIVED: 3,
  CANCELLED: 4,
  FAILED: 5,
});

export const Intersect = Object.freeze({
  OUTSIDE: -1,
  INTERSECTING: 0,
  INSIDE: 1,
});

export const Axis = Object.freeze({
  X: 0,
  Y: 1,
  Z: 2,
  Y_UP_TO_Z_UP: new Matrix4(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1),
  Z_UP_TO_X_UP: new Matrix4(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1),
});

export const CameraEventType = Object.freeze({
  LEFT_DRAG: 0,
  RIGHT_DRAG: 1,
  MIDDLE_DRAG: 2,
  WHEEL: 3,
  PINCH: 4,
});

export const KeyboardEventModifier = Object.freeze({
  SHIFT: 0,
  CTRL: 1,
  ALT: 2,
});

export const Credit = class Credit {
  constructor(html, showOnScreen = false) {
    this.html = html;
    this.showOnScreen = showOnScreen;
    this.id = `${showOnScreen ? 'inline' : 'listed'}:${html}`;
  }

  isIon() {
    return false;
  }
};

export const TrackingReferenceFrame = Object.freeze({
  AUTODETECT: 0,
  ENU: 1,
  NED: 2,
});

const easings = {
  LINEAR_NONE: (t) => t,
  QUADRATIC_IN: (t) => t * t,
  QUADRATIC_OUT: (t) => t * (2 - t),
  QUADRATIC_IN_OUT: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  CUBIC_IN: (t) => t ** 3,
  CUBIC_OUT: (t) => (t - 1) ** 3 + 1,
  CUBIC_IN_OUT: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  QUARTIC_IN: (t) => t ** 4,
  QUARTIC_OUT: (t) => 1 - (t - 1) ** 4,
  QUARTIC_IN_OUT: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  QUINTIC_IN: (t) => t ** 5,
  QUINTIC_OUT: (t) => (t - 1) ** 5 + 1,
  QUINTIC_IN_OUT: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  SINUSOIDAL_IN: (t) => 1 - Math.cos((t * PI) / 2),
  SINUSOIDAL_OUT: (t) => Math.sin((t * PI) / 2),
  SINUSOIDAL_IN_OUT: (t) => 0.5 * (1 - Math.cos(PI * t)),
  EXPONENTIAL_IN: (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1))),
  EXPONENTIAL_OUT: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  EXPONENTIAL_IN_OUT: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? 2 ** (20 * t - 10) / 2
          : (2 - 2 ** (-20 * t + 10)) / 2,
  CIRCULAR_IN: (t) => 1 - Math.sqrt(1 - t * t),
  CIRCULAR_OUT: (t) => Math.sqrt(1 - (t - 1) ** 2),
  CIRCULAR_IN_OUT: (t) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
  ELASTIC_IN: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : -(2 ** (10 * (t - 1))) * Math.sin((t - 1.075) * (TWO_PI / 0.3)),
  ELASTIC_OUT: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : 2 ** (-10 * t) * Math.sin((t - 0.075) * (TWO_PI / 0.3)) + 1,
  ELASTIC_IN_OUT: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(
              2 ** (20 * t - 10) *
              Math.sin((20 * t - 11.125) * (TWO_PI / 0.45))
            ) / 2
          : (2 ** (-20 * t + 10) *
              Math.sin((20 * t - 11.125) * (TWO_PI / 0.45))) /
              2 +
            1,
  BOUNCE_OUT: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  BOUNCE_IN: (t) => 1 - easings.BOUNCE_OUT(1 - t),
  BOUNCE_IN_OUT: (t) =>
    t < 0.5
      ? (1 - easings.BOUNCE_OUT(1 - 2 * t)) / 2
      : (1 + easings.BOUNCE_OUT(2 * t - 1)) / 2,
};
export const EasingFunction = Object.freeze(easings);

export class PerspectiveFrustum {
  constructor(options = {}) {
    this.fov = options.fov ?? PI / 3;
    this.aspectRatio = options.aspectRatio ?? 1;
    this.near = options.near ?? 1;
    this.far = options.far ?? 500000000;
    this.xOffset = options.xOffset ?? 0;
    this.yOffset = options.yOffset ?? 0;
    this._update();
  }

  get fovy() {
    return this.aspectRatio <= 1
      ? this.fov
      : 2 * Math.atan(Math.tan(this.fov * 0.5) / this.aspectRatio);
  }

  get top() {
    return this.near * Math.tan(this.fovy * 0.5);
  }

  get bottom() {
    return -this.top;
  }

  get right() {
    return this.aspectRatio * this.top;
  }

  get left() {
    return -this.right;
  }

  get projectionMatrix() {
    this._update();
    return this._projectionMatrix;
  }

  _update() {
    const top = this.top + (this.yOffset ?? 0);
    const bottom = this.bottom + (this.yOffset ?? 0);
    const right = this.right + (this.xOffset ?? 0);
    const left = this.left + (this.xOffset ?? 0);
    const near = this.near;
    const far = this.far;
    const twoNear = 2 * near;
    const leftRight = 1 / (right - left);
    const bottomTop = 1 / (top - bottom);
    const farNear = 1 / (far - near);
    const m = new Matrix4();
    m[0] = twoNear * leftRight;
    m[5] = twoNear * bottomTop;
    m[8] = (right + left) * leftRight;
    m[9] = (top + bottom) * bottomTop;
    m[10] = -(far + near) * farNear;
    m[11] = -1;
    m[14] = -(twoNear * far) * farNear;
    m[15] = 0;
    this._projectionMatrix = m;
  }

  clone(result) {
    return new PerspectiveFrustum({
      fov: this.fov,
      aspectRatio: this.aspectRatio,
      near: this.near,
      far: this.far,
    });
  }

  /** The six bounding planes at a pose, as the project's frustum gives them. */
  computeCullingVolume(position, direction, up) {
    const planes = frustumPlanes({
      position,
      direction,
      up,
      fovy: this.fovy,
      aspectRatio: this.aspectRatio,
      near: this.near,
      far: this.far,
    });
    return new CullingVolume(
      planes.map(({ normal, w }) => ({ normal, distance: w })),
    );
  }
}

/** A set of planes, inside where `normal · p + distance ≥ 0`. */
export class CullingVolume {
  constructor(planes = []) {
    this.planes = planes;
  }

  computeVisibility(boundingSphere) {
    let inside = true;
    for (const plane of this.planes) {
      const distance =
        plane.normal.x * boundingSphere.center.x +
        plane.normal.y * boundingSphere.center.y +
        plane.normal.z * boundingSphere.center.z +
        plane.distance;
      if (distance < -boundingSphere.radius) return Intersect.OUTSIDE;
      if (distance < boundingSphere.radius) inside = false;
    }
    return inside ? Intersect.INSIDE : Intersect.INTERSECTING;
  }
}

export class OrthographicOffCenterFrustum {
  constructor(options = {}) {
    this.left = options.left ?? -1;
    this.right = options.right ?? 1;
    this.top = options.top ?? 1;
    this.bottom = options.bottom ?? -1;
    this.near = options.near ?? 1;
    this.far = options.far ?? 500000000;
  }

  get projectionMatrix() {
    const m = new Matrix4();
    const left = this.left;
    const right = this.right;
    const top = this.top;
    const bottom = this.bottom;
    const near = this.near;
    const far = this.far;
    const leftRight = 1 / (left - right);
    const bottomTop = 1 / (bottom - top);
    const nearFar = 1 / (near - far);
    m[0] = -2 * leftRight;
    m[5] = -2 * bottomTop;
    m[10] = 2 * nearFar;
    m[12] = (left + right) * leftRight;
    m[13] = (top + bottom) * bottomTop;
    m[14] = (far + near) * nearFar;
    m[15] = 1;
    return m;
  }

  clone() {
    return new OrthographicOffCenterFrustum({
      left: this.left,
      right: this.right,
      top: this.top,
      bottom: this.bottom,
      near: this.near,
      far: this.far,
    });
  }
}

export class OrthographicFrustum {
  constructor(options = {}) {
    this.width = options.width ?? 1;
    this.aspectRatio = options.aspectRatio ?? 1;
    this.near = options.near ?? 1;
    this.far = options.far ?? 500000000;
  }

  get projectionMatrix() {
    const right = this.width * 0.5;
    const left = -right;
    const top = right / this.aspectRatio;
    const bottom = -top;
    return new OrthographicOffCenterFrustum({
      left,
      right,
      top,
      bottom,
      near: this.near,
      far: this.far,
    }).projectionMatrix;
  }
}

export class EllipsoidalOccluder {
  constructor(ellipsoid = Ellipsoid.WGS84, cameraPosition) {
    this.ellipsoid = ellipsoid;
    this._cameraPosition = cameraPosition;
  }

  get cameraPosition() {
    return this._cameraPosition;
  }

  set cameraPosition(value) {
    this._cameraPosition = value;
  }

  isPointVisible(point) {
    if (!this._cameraPosition) return true;
    return horizonFrom(this._cameraPosition, this.ellipsoid.geo).isPointVisible(
      point,
    );
  }

  isScaledSpacePointVisible(scaledSpacePoint) {
    if (!this._cameraPosition) return true;
    const o = this.ellipsoid.oneOverRadii;
    const camera = {
      x: this._cameraPosition.x * o.x,
      y: this._cameraPosition.y * o.y,
      z: this._cameraPosition.z * o.z,
    };
    return horizonFrom(camera, this.ellipsoid.geo).isPointVisible(
      scaledSpacePoint,
    );
  }
}

export class GeographicProjection {
  constructor(ellipsoid = Ellipsoid.WGS84) {
    this.ellipsoid = ellipsoid;
  }

  project(cartesian, result) {
    const c = toCartographicRadians(cartesian, this.ellipsoid.geo);
    if (!c) return undefined;
    const out = result ?? new Cartesian3();
    out.x = c.lon;
    out.y = c.lat;
    out.z = c.height;
    return out;
  }

  unproject(cartesian, result) {
    const p = fromRadians(cartesian.x, cartesian.y, cartesian.z ?? 0);
    return Cartesian3.clone(p, result);
  }
}

export class EllipsoidGeodesic {
  constructor(
    start = new Cartographic(),
    end = new Cartographic(),
    ellipsoid = Ellipsoid.WGS84,
  ) {
    this.start = Cartographic.clone(start) ?? new Cartographic();
    this.end = Cartographic.clone(end) ?? new Cartographic();
    this.ellipsoid = ellipsoid;
    this._distance = undefined;
  }

  setEndPoints(start, end) {
    this.start = Cartographic.clone(start);
    this.end = Cartographic.clone(end);
    this._distance = undefined;
  }

  get surfaceDistance() {
    if (this._distance === undefined) {
      this._distance = geodesicInverse(
        this.start.longitude,
        this.start.latitude,
        this.end.longitude,
        this.end.latitude,
      ).distance;
    }
    return this._distance;
  }

  interpolateUsingFraction(fraction, result) {
    return this.interpolateUsingSurfaceDistance(
      this.surfaceDistance * fraction,
      result,
    );
  }

  interpolateUsingSurfaceDistance(distanceAlong, result) {
    const fraction = this.surfaceDistance
      ? distanceAlong / this.surfaceDistance
      : 0;
    const p = geodesicAt(
      this.start.longitude,
      this.start.latitude,
      this.end.longitude,
      this.end.latitude,
      fraction,
    );
    return Cartographic.clone(carto(p.lon, p.lat, 0), result);
  }
}

export class EllipsoidRhumbLine {
  constructor(
    start = new Cartographic(),
    end = new Cartographic(),
    ellipsoid = Ellipsoid.WGS84,
  ) {
    this.start = Cartographic.clone(start) ?? new Cartographic();
    this.end = Cartographic.clone(end) ?? new Cartographic();
    this.ellipsoid = ellipsoid;
  }

  setEndPoints(start, end) {
    this.start = Cartographic.clone(start);
    this.end = Cartographic.clone(end);
  }

  get surfaceDistance() {
    return this.line().distance ?? 0;
  }

  get heading() {
    return this.line().heading;
  }

  line() {
    return rhumbLine(
      { lon: this.start.longitude, lat: this.start.latitude },
      { lon: this.end.longitude, lat: this.end.latitude },
    );
  }

  /** Where the line crosses a longitude (radians), as Cesium finds it. */
  findIntersectionWithLongitude(longitude, result) {
    const line = rhumbLine(
      { lon: this.start.longitude, lat: this.start.latitude },
      { lon: this.end.longitude, lat: this.end.latitude },
    );
    const delta = (s) => negativePiToPi(line.at(s).lon - longitude);
    let lo = 0;
    let hi = line.distance;
    let flo = delta(lo);
    let fhi = delta(hi);
    if (Math.abs(flo) > Math.PI && Math.abs(fhi) > Math.PI) {
      // A line that goes the other way round: search from the other end.
      [lo, hi, flo, fhi] = [hi, lo, fhi, flo];
    }
    for (let i = 0; i < 80 && lo !== hi; i += 1) {
      const mid = (lo + hi) / 2;
      const fmid = delta(mid);
      if (flo === 0 || Math.sign(fmid) === Math.sign(flo)) {
        lo = mid;
        flo = fmid;
      } else {
        hi = mid;
      }
    }
    const p = line.at((lo + hi) / 2);
    return Cartographic.clone(carto(p.lon, p.lat, 0), result);
  }

  /** Where the line crosses a latitude (radians). */
  findIntersectionWithLatitude(latitude, result) {
    const line = rhumbLine(
      { lon: this.start.longitude, lat: this.start.latitude },
      { lon: this.end.longitude, lat: this.end.latitude },
    );
    let lo = 0;
    let hi = line.distance;
    const delta = (s) => line.at(s).lat - latitude;
    const flo = delta(lo);
    for (let i = 0; i < 80 && lo !== hi; i += 1) {
      const mid = (lo + hi) / 2;
      if (Math.sign(delta(mid)) === Math.sign(flo)) lo = mid;
      else hi = mid;
    }
    const p = line.at((lo + hi) / 2);
    return Cartographic.clone(carto(p.lon, p.lat, 0), result);
  }

  interpolateUsingFraction(fraction, result) {
    return this.interpolateUsingSurfaceDistance(
      this.surfaceDistance * fraction,
      result,
    );
  }

  interpolateUsingSurfaceDistance(distanceAlong, result) {
    const line = this.line();
    const p = line.at(distanceAlong);
    return Cartographic.clone(carto(p.lon, p.lat, 0), result);
  }
}

export const NearFarScalar = class NearFarScalar {
  constructor(near = 0, nearValue = 0, far = 1, farValue = 1) {
    this.near = near;
    this.nearValue = nearValue;
    this.far = far;
    this.farValue = farValue;
  }
};

export const EncodedCartesian3 = class EncodedCartesian3 {
  constructor() {
    this.high = new Cartesian3();
    this.low = new Cartesian3();
  }

  static encode(value, result = { high: 0, low: 0 }) {
    const split = 65536.0;
    let high;
    if (value >= 0) {
      high = Math.floor(value / split) * split;
      result.high = high;
      result.low = value - high;
    } else {
      high = Math.floor(-value / split) * split;
      result.high = -high;
      result.low = value + high;
    }
    return result;
  }

  static fromCartesian(cartesian, result) {
    const out = result ?? new EncodedCartesian3();
    const x = EncodedCartesian3.encode(cartesian.x);
    const y = EncodedCartesian3.encode(cartesian.y);
    const z = EncodedCartesian3.encode(cartesian.z);
    out.high.x = x.high;
    out.high.y = y.high;
    out.high.z = z.high;
    out.low.x = x.low;
    out.low.y = y.low;
    out.low.z = z.low;
    return out;
  }
};

export const BoundingSphere = class BoundingSphere {
  constructor(center = new Cartesian3(), radius = 0) {
    this.center = center;
    this.radius = radius;
  }

  static fromPoints(points, result) {
    const out = result ?? new BoundingSphere();
    if (!points?.length) return out;
    const sphere = sphereFromPoints(points);
    out.center.x = sphere.center.x;
    out.center.y = sphere.center.y;
    out.center.z = sphere.center.z;
    out.radius = sphere.radius;
    return out;
  }

  static union(left, right, result) {
    const out = result ?? new BoundingSphere();
    const sphere = sphereUnion(left, right);
    out.center.x = sphere.center.x;
    out.center.y = sphere.center.y;
    out.center.z = sphere.center.z;
    out.radius = sphere.radius;
    return out;
  }
};

export const Simon1994PlanetaryPositions = {
  computeSunPositionInEarthInertialFrame(date, result) {
    return Cartesian3.clone(sunPositionInertial(epochMsOf(date)), result);
  },
  computeMoonPositionInEarthInertialFrame(date, result) {
    return Cartesian3.clone(moonPositionInertial(epochMsOf(date)), result);
  },
};

export const SceneTransforms = {
  worldToWindowCoordinates(scene, position, result) {
    const camera = scene?.camera;
    if (!camera) return undefined;
    const view =
      camera.viewMatrix ??
      Matrix4.computeView(
        camera.positionWC,
        camera.directionWC,
        camera.upWC,
        camera.rightWC,
      );
    const projection = camera.frustum?.projectionMatrix;
    if (!projection) return undefined;
    const clip = Matrix4.multiplyByVector(
      projection,
      Matrix4.multiplyByVector(
        view,
        new Cartesian4(position.x, position.y, position.z, 1),
      ),
    );
    if (clip.w <= 0) return undefined;
    const ndcX = clip.x / clip.w;
    const ndcY = clip.y / clip.w;
    const width =
      scene.drawingBufferWidth ??
      scene.canvas?.width ??
      scene.canvas?.clientWidth ??
      0;
    const height =
      scene.drawingBufferHeight ??
      scene.canvas?.height ??
      scene.canvas?.clientHeight ??
      0;
    const out = result ?? new Cartesian3();
    out.x = (ndcX * 0.5 + 0.5) * width;
    out.y = (0.5 - ndcY * 0.5) * height;
    out.z = clip.z / clip.w;
    return out;
  },
  wgs84ToWindowCoordinates(scene, position, result) {
    return SceneTransforms.worldToWindowCoordinates(scene, position, result);
  },
};

/** A collection keyed by an entity's `id`, as Cesium keeps one. */
export class EntityCollection {
  constructor() {
    this.values = [];
  }

  add(entity) {
    this.values.push(entity);
    return entity;
  }

  remove(entity) {
    const index = this.values.indexOf(entity);
    if (index < 0) return false;
    this.values.splice(index, 1);
    return true;
  }

  removeAll() {
    for (const value of this.values.splice(0)) value?.destroy?.();
  }

  destroy() {
    this.removeAll();
    this.destroyed = true;
  }

  isDestroyed() {
    return this.destroyed === true;
  }

  contains(entity) {
    return this.values.includes(entity);
  }

  getById(id) {
    return this.values.find((entity) => entity?.id === id);
  }

  get length() {
    return this.values.length;
  }
}

export class DataSourceCollection extends EntityCollection {}
export class BillboardCollection extends EntityCollection {}
export class PointPrimitiveCollection extends EntityCollection {}

export class PointPrimitive {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}
export class PrimitiveCollection extends EntityCollection {}
export class LabelCollection extends EntityCollection {}
export class ImageryLayerCollection extends EntityCollection {}
export class TweenCollection extends EntityCollection {}

export class Entity {
  constructor(options = {}) {
    Object.assign(this, options);
    this.id = options.id ?? `${Entity._seq++}`;
  }
}

Entity._seq = 0;

export class EntityView {
  constructor(entity, scene) {
    this.entity = entity ?? null;
    this.scene = scene;
    this._frame = GEO_IDENTITY;
    this._position = vec(0, 0, 0);
  }

  get position() {
    return this._position;
  }

  get viewMatrix() {
    return frameToMatrix4(this._frame);
  }

  /**
   * Track the entity again at `time`: the eye keeps its offset in the
   * entity's east-north-up frame while the entity moves.
   */
  update(time) {
    const camera = this.scene?.camera;
    const entityPosition = this.entity?.position;
    const at =
      typeof entityPosition?.getValue === 'function'
        ? entityPosition.getValue(time)
        : (entityPosition ?? null);
    if (!camera || !at) return;
    const enu = eastNorthUp(at);
    if (isIdentityFrame(camera._frame)) {
      camera._position = inverseFramePoint(enu, camera.positionWC);
      camera._direction = inverseFrameVector(enu, camera.directionWC);
      camera._up = inverseFrameVector(enu, camera.upWC);
    }
    camera._frame = enu;
    camera._right = cross(camera._direction, camera._up);
    this._frame = enu;
  }
}

export class CallbackPositionProperty {
  constructor(callback, isConstant = false) {
    this._callback = callback;
    this.isConstant = isConstant;
  }

  getValue(time, result) {
    return this._callback(time, result) ?? undefined;
  }

  getValueInReferenceFrame(time, referenceFrame, result) {
    return this.getValue(time, result);
  }
}

export class LabelGraphics {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

export class Label {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

export const RequestErrorEvent = class RequestErrorEvent extends Error {
  constructor(statusCode, response, responseHeaders) {
    super(`Request failed with status code ${statusCode}`);
    this.statusCode = statusCode;
    this.response = response;
    this.responseHeaders =
      typeof responseHeaders === 'string'
        ? Object.fromEntries(
            responseHeaders
              .split(/\r?\n/)
              .map((line) => line.split(':'))
              .filter(([name, ...rest]) => name && rest.length)
              .map(([name, ...rest]) => [
                name.trim().toLowerCase(),
                rest.join(':').trim(),
              ]),
          )
        : responseHeaders;
  }
};

export const Request = class Request {
  constructor(options = {}) {
    Object.assign(this, options);
    this.url = options.url ?? '';
    this.headers = options.headers ?? {};
    this.state = options.state ?? RequestState.UNISSUED;
  }

  cancel() {
    this.state = RequestState.CANCELLED;
  }
};

/** A URL with `relative` resolved against it. */
const resolveUrl = (base, relative) => {
  try {
    return new URL(relative, base).href;
  } catch {
    return `${String(base).replace(/\/$/, '')}/${relative}`;
  }
};

/** A Cesium-shaped resource: a URL, its headers, and its retry budget. */
export const Resource = class Resource {
  constructor(options = {}) {
    Object.assign(this, options);
    this.url = options.url ?? '';
    this.headers = options.headers ?? {};
    this.retryCallback = options.retryCallback;
    this.retryAttempts = options.retryAttempts;
    this._failed = 0;
    this.request = options.request ?? new Request({ url: this.url });
  }

  appendForwardSlash() {
    if (!this.url.endsWith('/')) this.url += '/';
  }

  getDerivedResource({ url } = {}) {
    return new Resource({
      url: url ? resolveUrl(this.url, url) : this.url,
      headers: { ...this.headers },
      retryCallback: this.retryCallback,
      retryAttempts: this.retryAttempts,
      request: new Request({ url: url ? resolveUrl(this.url, url) : this.url }),
    });
  }

  async retryOnError(error) {
    if (!this.retryCallback) return false;
    const budget = this.retryAttempts ?? 1;
    if (this._failed >= budget) return false;
    this._failed += 1;
    return Boolean(await this.retryCallback(this, error));
  }
};

export const Ion = { defaultAccessToken: undefined };
export const GoogleMaps = { defaultApiKey: undefined };
export const Material = { DefaultImageId: 'DefaultImage' };

export const EllipsoidSurfaceAppearance = {
  VERTEX_FORMAT: { position: true, st: true },
  MATERIAL_VERTEX_FORMAT: { position: true, st: true },
};

export const BlendingState = Object.freeze({
  ALPHA_BLEND: { enabled: true },
  PRE_MULTIPLIED_ALPHA_BLEND: { enabled: true },
  ADDITIVE_BLEND: { enabled: true },
  DISABLED: { enabled: false },
});
export const ContextLimits = {};

export const GeographicTilingScheme = class GeographicTilingScheme {
  constructor(options = {}) {
    this.ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
    this.rectangle = options.rectangle ?? Rectangle.MAX_VALUE;
    this.numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX ?? 2;
    this.numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY ?? 1;
  }

  getNumberOfXTilesAtLevel(level) {
    return this.numberOfLevelZeroTilesX * 2 ** level;
  }

  getNumberOfYTilesAtLevel(level) {
    return this.numberOfLevelZeroTilesY * 2 ** level;
  }

  tileXYToRectangle(x, y, level, result = {}) {
    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);
    const { west, east, south, north } = this.rectangle;
    const lonSpan = east - west;
    const latSpan = north - south;
    result.west = west + (x / xTiles) * lonSpan;
    result.east = west + ((x + 1) / xTiles) * lonSpan;
    result.north = north - (y / yTiles) * latSpan;
    result.south = north - ((y + 1) / yTiles) * latSpan;
    return result;
  }
};

export const WebMercatorTilingScheme = class WebMercatorTilingScheme {
  constructor(options = {}) {
    this.ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
    this.rectangle = options.rectangle ?? Rectangle.MAX_VALUE;
    this.numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX ?? 1;
    this.numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY ?? 1;
  }

  getNumberOfXTilesAtLevel(level) {
    return this.numberOfLevelZeroTilesX * 2 ** level;
  }

  getNumberOfYTilesAtLevel(level) {
    return this.numberOfLevelZeroTilesY * 2 ** level;
  }

  positionToTileXY(cartographic, level, result = {}) {
    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);
    const lon = cartographic.longitude;
    const lat = cartographic.latitude;
    const x = ((lon + PI) / TWO_PI) * xTiles;
    const mercatorY = Math.log(Math.tan(PI / 4 + lat / 2));
    const y = ((1 - mercatorY / PI) / 2) * yTiles;
    result.x = Math.min(xTiles - 1, Math.max(0, Math.floor(x)));
    result.y = Math.min(yTiles - 1, Math.max(0, Math.floor(y)));
    return result;
  }

  tileXYToRectangle(x, y, level, result = {}) {
    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);
    result.west = -PI + (x / xTiles) * TWO_PI;
    result.east = -PI + ((x + 1) / xTiles) * TWO_PI;
    result.north = Math.atan(Math.sinh(PI * (1 - (2 * y) / yTiles)));
    result.south = Math.atan(Math.sinh(PI * (1 - (2 * (y + 1)) / yTiles)));
    return result;
  }
};

export const ClassificationType = Object.freeze({
  TERRAIN: 0,
  CESIUM_3D_TILE: 1,
  BOTH: 2,
});

export class GroundPolylinePrimitive {
  constructor(options = {}) {
    Object.assign(this, options);
    this.ready = true;
    this.show = options.show ?? true;
  }

  static async initializeTerrainHeights() {}

  isDestroyed() {
    return false;
  }

  destroy() {}
}

export class GroundPrimitive extends GroundPolylinePrimitive {}
export class Primitive extends GroundPolylinePrimitive {}

export class GeometryInstance {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

export class GroundPolylineGeometry {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

export class PolylineCollection extends EntityCollection {}
export class Polyline {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

export class Cesium3DTileset {
  constructor() {
    this.show = true;
    this.tilesLoaded = true;
    this.destroyed = false;
  }

  isDestroyed() {
    return this.destroyed;
  }

  destroy() {
    this.destroyed = true;
  }
}

/** The heightmap (`heightmap-1.0`) terrain provider, as tests fetch one. */
export class CesiumTerrainProvider {
  static async fromUrl(url) {
    const base = String(url).replace(/\/$/, '');
    const response = await fetch(`${base}/layer.json`);
    const layer = await response.json();
    const provider = new CesiumTerrainProvider();
    provider.url = base;
    provider.layer = layer;
    provider.maximumLevel = layer.maxzoom ?? 0;
    provider.tilingScheme = new GeographicTilingScheme({
      numberOfLevelZeroTilesX: (layer.available?.[0]?.[0]?.endX ?? 1) + 1,
      numberOfLevelZeroTilesY: (layer.available?.[0]?.[0]?.endY ?? 0) + 1,
    });
    // heightmap-1.0 decodes a uint16 as value / 5 - 1000.
    provider._heightScale = 1 / 5;
    provider._heightOffset = -1000;
    return provider;
  }

  async requestTileGeometry(x, y, level) {
    const response = await fetch(`${this.url}/${level}/${x}/${y}.terrain`);
    const buffer = await response.arrayBuffer();
    const values = new Uint16Array(buffer);
    const width = 65;
    const height = 65;
    const scale = this._heightScale;
    const offset = this._heightOffset;
    return {
      interpolateHeight(rect, longitude, latitude) {
        const fx =
          ((longitude - rect.west) / (rect.east - rect.west)) * (width - 1);
        const fy =
          ((latitude - rect.south) / (rect.north - rect.south)) * (height - 1);
        const ix = Math.min(width - 1, Math.max(0, Math.round(fx)));
        const iy = Math.min(height - 1, Math.max(0, Math.round(fy)));
        return values[iy * width + ix] * scale + offset;
      },
      isChildAvailable() {
        return false;
      },
    };
  }
}

export const EllipsoidTerrainProvider = class EllipsoidTerrainProvider {
  constructor(options = {}) {
    this.ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
  }
};

/** A pose projector for tests that need one without a scene. */
export function projectorFor(pose, width, height) {
  return poseProjector(pose, width, height);
}

export { poseProjector, offsetFromHeadingPitchRange, zeroToTwoPi };
