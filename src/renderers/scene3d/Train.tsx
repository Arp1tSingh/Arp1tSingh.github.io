/**
 * The train.
 *
 * Three articulated cars built out of three.js primitives and nothing else:
 * a chassis, a roof, an inset window band, a skirt, six wheels, a bogie
 * under each end, a coupling bar between every pair of cars and a red lamp
 * at each end of the set.
 *
 * Two rules shape the file.
 *
 *   1. The geometry is plain three.js. `buildTrain` returns a `THREE.Group`
 *      and the React component hands that group to the scene as a single
 *      `<primitive>`. React only animates the door leaves and the
 *      brightness of the windows. That keeps the budget honest: the
 *      function that draws the train is the same function the triangle
 *      count is measured against, so the number in the report is the
 *      number that ships.
 *
 *   2. Draw calls are the other half of the budget. Everything that shares
 *      a material is merged with `BufferGeometryUtils.mergeGeometries`, so
 *      eighteen wheels, three roofs, two cab noses and a pantograph cost
 *      nine draw calls in total.
 *
 * The palette is the tokens of the site and nothing else: navy for the
 * body, a darker navy for the recesses, grey for the running gear, paper
 * for the lit windows, red for the stripe under the windows and for the
 * lamps. No texture maps, no environment maps, no shadows.
 */

import type { JSX } from 'react';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { RAIL_GAUGE, SCENE_COLORS, TRACK_Y } from './constants';

/* ------------------------------------------------------------------ *
 * The palette, straight from the shared scene colours.
 * ------------------------------------------------------------------ */

const NAVY = SCENE_COLORS.navy;
const NAVY_PANEL = SCENE_COLORS.navyPanel;
const PAPER = SCENE_COLORS.paper;
const GREY = SCENE_COLORS.grey;
const RED = SCENE_COLORS.red;

/* ------------------------------------------------------------------ *
 * The dimensions of one car, in world units.
 *
 * The rail head is y = 0 and the gauge is 2.4, so the wheels sit at
 * z = +/-1.2 and everything else is measured up from the rail.
 * ------------------------------------------------------------------ */

const CAR_LENGTH = 5.3; // one car, cab nose included
const CAR_GAP = 0.35; // the gap the coupling bar bridges
const NOSE_LENGTH = 0.91; // the cab nose, a rounded extrusion

const BODY_WIDTH = 2.6;
const HALF_WIDTH = BODY_WIDTH / 2;

const FLOOR_Y = 0.66; // the underside of the body
const BAND_BOTTOM = 1.28; // the window band, bottom
const BAND_TOP = 1.84; // the window band, top
const HEADER_Y = 2.1; // the top of the doorway
const ROOF_Y = 2.24; // the top of the body
const ROOF_BOX_TOP = 2.5; // the top of the flat roof
const ROOF_WIDTH = 2.26;
const CROWN_RADIUS = ROOF_WIDTH / 2;
const CROWN_HEIGHT = 0.22;

const BAND_RECESS = 0.09; // how far the window band sits inside the body
const BAND_HALF = HALF_WIDTH - BAND_RECESS;

const SKIRT_BOTTOM = 0.4;
const SKIRT_WIDTH = 2.3;

const FAIRING_RADIUS = 0.42;
const FAIRING_HEIGHT = 0.2;

const WHEEL_RADIUS = 0.34;
const WHEEL_Z = RAIL_GAUGE / 2; // the rail centres
const WHEEL_CENTRE_Y = TRACK_Y + WHEEL_RADIUS; // the wheel rests on the rail head

const DOOR_HALF = 0.9; // the doorway is 1.8 wide
const DOOR_TRAVEL = 0.9; // how far each leaf slides
const DOOR_THICKNESS = 0.05; // the leaf is a thin panel
const INTERIOR_HALF = 1.15; // the recess behind the doors
const LEAF_CENTRE_Y = (FLOOR_Y + HEADER_Y) / 2; // the middle of a leaf

/* ------------------------------------------------------------------ *
 * The segment counts.
 *
 * These are the only knobs that move the triangle count, so they are
 * named, and the budget test reads the number they produce.
 * ------------------------------------------------------------------ */

const WHEEL_SEGMENTS = 32; // around the rim of a wheel
const CROWN_SEGMENTS = 36; // around the arc of the roof
const CROWN_SEGMENTS_LONG = 10; // along the length of the roof
const FAIRING_SEGMENTS = 20; // around the arc of the roof fairing
const FAIRING_SEGMENTS_LONG = 10; // along the length of the roof fairing
const NOSE_BEVEL_SEGMENTS = 6;
const NOSE_CURVE_SEGMENTS = 4;
const LAMP_SEGMENTS = 16;

/* ------------------------------------------------------------------ *
 * The materials, one per bin of geometry.
 * ------------------------------------------------------------------ */

type BinKey = 'body' | 'glass' | 'trim' | 'lamp' | 'metal' | 'dark';

type Bins = Record<BinKey, THREE.BufferGeometry[]>;

function emptyBins(): Bins {
  return { body: [], glass: [], trim: [], lamp: [], metal: [], dark: [] };
}

/**
 * The materials.
 *
 * Lambert, not Standard. The art direction is flat colour and flat shading,
 * and Standard's physical shading is a lot of shader to compile for an
 * effect nobody can see in a faceted scene. Lambert takes the same two
 * lights, costs a fraction of the compile, and is what the rest of the scene
 * already uses.
 */
function buildMaterials(): Record<BinKey, THREE.Material> {
  return {
    /* The body: navy, matte, faceted. */
    body: new THREE.MeshLambertMaterial({
      color: NAVY,
      flatShading: true,
    }),
    /* The window band: paper, lit from inside so the train reads at night. */
    glass: new THREE.MeshLambertMaterial({
      color: PAPER,
      emissive: PAPER,
      emissiveIntensity: 0.85,
      flatShading: true,
    }),
    /* The stripe under the windows: the one red line on the body. */
    trim: new THREE.MeshLambertMaterial({
      color: RED,
      emissive: RED,
      emissiveIntensity: 0.2,
      flatShading: true,
    }),
    /* The lamps at the ends of the set. */
    lamp: new THREE.MeshLambertMaterial({
      color: RED,
      emissive: RED,
      emissiveIntensity: 1.6,
      flatShading: true,
    }),
    /* The running gear: wheels, axles, bogies, couplings, pantograph. */
    metal: new THREE.MeshLambertMaterial({
      color: GREY,
      flatShading: true,
    }),
    /* The recesses: the inside of a doorway and the cab windscreen. */
    dark: new THREE.MeshLambertMaterial({
      color: NAVY_PANEL,
      flatShading: true,
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Small helpers that place primitives.
 * ------------------------------------------------------------------ */

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function tube(
  radius: number,
  length: number,
  segments: number,
  axis: 'x' | 'y' | 'z',
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo.translate(x, y, z);
}

/** A thin box that reaches from one point to another in the XY plane. */
function strut(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  depth: number,
): THREE.BufferGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const geo = new THREE.BoxGeometry(Math.hypot(dx, dy), thickness, depth);
  geo.rotateZ(Math.atan2(dy, dx));
  return geo.translate((x1 + x2) / 2, (y1 + y2) / 2, 0);
}

/** A rounded rectangle, the cross section of a cab. */
function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

/**
 * The cab nose.
 *
 * A rounded rectangle extruded along the length of the car and bevelled at
 * the front, so the cab tapers into a flat face that carries the windscreen
 * and the lamp. The base of the nose sits at x = 0 and the tip at x =
 * NOSE_LENGTH.
 */
function noseGeometry(): THREE.BufferGeometry {
  const depth = NOSE_LENGTH - 2 * 0.28;
  const shape = roundedRect(BODY_WIDTH, ROOF_Y - FLOOR_Y, 0.22);
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.3,
    bevelSegments: NOSE_BEVEL_SEGMENTS,
    curveSegments: NOSE_CURVE_SEGMENTS,
    steps: 1,
  });
  /* ExtrudeGeometry is not indexed and the merge needs one shape. */
  const geo = mergeVertices(raw);
  raw.dispose();
  geo.rotateY(Math.PI / 2);
  geo.translate(0.28, (FLOOR_Y + ROOF_Y) / 2, 0);
  return geo;
}

/**
 * A wheel.
 *
 * A lathed profile: a hub, a dish and a flat tread. Lathed rather than a
 * plain cylinder so the rim catches the light in bands.
 */
function wheelGeometry(): THREE.BufferGeometry {
  const r = WHEEL_RADIUS;
  const half = 0.08;
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.09, -half),
    new THREE.Vector2(0.27, -half),
    new THREE.Vector2(r, -half * 0.55),
    new THREE.Vector2(r, half * 0.55),
    new THREE.Vector2(0.27, half),
    new THREE.Vector2(0.09, half),
    new THREE.Vector2(0.09, -half),
  ];
  const geo = new THREE.LatheGeometry(profile, WHEEL_SEGMENTS);
  geo.rotateX(Math.PI / 2);
  return geo;
}
/**
 * A rounded spine along the length of the car.
 *
 * A half cylinder laid down and flattened, so the shape catches the
 * directional light in a long band instead of a flat top. The roof crown
 * and the roof fairing are both made of it.
 */
function roundedSpine(
  radius: number,
  height: number,
  length: number,
  radial: number,
  along: number,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, length, radial, along, false, 0, Math.PI);
  geo.rotateZ(-Math.PI / 2);
  geo.scale(1, height / radius, 1);
  geo.rotateX(Math.PI);
  return geo;
}

/**
 * The rounded roof.
 *
 * The crown of the roof, the thing that makes the car read as a train and
 * not as a box on wheels.
 */
function crownGeometry(length: number): THREE.BufferGeometry {
  return roundedSpine(CROWN_RADIUS, CROWN_HEIGHT, length, CROWN_SEGMENTS, CROWN_SEGMENTS_LONG);
}

/* ------------------------------------------------------------------ *
 * One car.
 * ------------------------------------------------------------------ */

interface CarSpec {
  /** Where the middle of the body sits along the train. */
  center: number;
  /** The length of the body, nose excluded. */
  length: number;
  /** Which end of the body carries the cab nose. */
  nose: 'front' | 'rear' | 'none';
  /** Whether the doors of this car slide. */
  doors: 'moving' | 'fixed';
  /** Whether the roof of this car carries the pantograph. */
  pantograph: boolean;
}

/**
 * The two leaves of one doorway, merged into a single geometry.
 *
 * The leaf is built around its own centre so the caller can place it, and
 * it is two panels with a slot between them: the slot is the window in
 * the door, and the recess behind it shows through.
 */
function doorLeafGeometry(): THREE.BufferGeometry {
  const lower = box(DOOR_HALF, 0.72, DOOR_THICKNESS, 0, FLOOR_Y + 0.36 - LEAF_CENTRE_Y, 0);
  const upper = box(DOOR_HALF, 0.2, DOOR_THICKNESS, 0, HEADER_Y - 0.1 - LEAF_CENTRE_Y, 0);
  const merged = mergeGeometries([lower, upper], false);
  lower.dispose();
  upper.dispose();
  return merged ?? lower;
}

/**
 * Builds one car into the shared bins.
 *
 * The car is symmetric about x = 0 and about the z = 0 plane, and the
 * doorway sits in the middle of it. The doors of the middle car are
 * returned as separate meshes so they can slide.
 */
function buildCar(
  spec: CarSpec,
  bins: Bins,
  materials: Record<BinKey, THREE.Material>,
  sliding: THREE.Mesh[],
): void {
  const half = spec.length / 2;
  const body = (): number => spec.center;

  /* The body is cut open at the doorway, so the sides are in two runs. */
  const runs: [number, number][] = [
    [-half, -DOOR_HALF],
    [DOOR_HALF, half],
  ];

  runs.forEach(([from, to]) => {
    const mid = (from + to) / 2;
    const len = to - from;

    /* The chassis, in two levels, with the window slot between them. */
    bins.body.push(box(len, BAND_BOTTOM - FLOOR_Y, BODY_WIDTH, body() + mid, (FLOOR_Y + BAND_BOTTOM) / 2, 0));
    bins.body.push(
      box(len, HEADER_Y - BAND_TOP, BODY_WIDTH, body() + mid, (BAND_TOP + HEADER_Y) / 2, 0),
    );

    /* The window band, inset into the slot it leaves behind. */
    bins.glass.push(
      box(len, BAND_TOP - BAND_BOTTOM, BAND_HALF * 2, body() + mid, (BAND_BOTTOM + BAND_TOP) / 2, 0),
    );

    /* The red line under the windows. */
    [-1, 1].forEach((side) => {
      bins.trim.push(
        box(len, 0.06, 0.04, body() + mid, BAND_BOTTOM - 0.03, side * (HALF_WIDTH + 0.01)),
      );
    });

    /* The mullions that break the band into windows. */
    const span = to - from;
    const count = Math.max(1, Math.round(span / 0.85));
    for (let index = 1; index < count; index += 1) {
      const at = from + (span * index) / count;
      bins.body.push(
        box(0.1, BAND_TOP - BAND_BOTTOM + 0.05, BAND_HALF * 2 + 0.03, body() + at, (BAND_BOTTOM + BAND_TOP) / 2, 0),
      );
    }
  });

  /* The strip above the doorway keeps the body closed at the top. */
  bins.body.push(
    box(spec.length, ROOF_Y - HEADER_Y, BODY_WIDTH, body(), (HEADER_Y + ROOF_Y) / 2, 0),
  );

  /* The recess behind the doors and the frame that edges it. */
  bins.dark.push(
    box(DOOR_HALF * 2 + 0.12, HEADER_Y - FLOOR_Y, INTERIOR_HALF * 2, body(), (FLOOR_Y + HEADER_Y) / 2, 0),
  );
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((end) => {
      bins.body.push(
        box(
          0.06,
          HEADER_Y - FLOOR_Y,
          HALF_WIDTH - INTERIOR_HALF,
          body() + end * DOOR_HALF,
          (FLOOR_Y + HEADER_Y) / 2,
          side * (INTERIOR_HALF + (HALF_WIDTH - INTERIOR_HALF) / 2),
        ),
      );
    });
  });

  /* The roof: a flat box and a rounded crown on top of it. */
  bins.body.push(box(spec.length - 0.16, ROOF_BOX_TOP - ROOF_Y, ROOF_WIDTH, body(), (ROOF_Y + ROOF_BOX_TOP) / 2, 0));
  const crown = crownGeometry(spec.length - 0.16);
  crown.translate(body(), ROOF_BOX_TOP - 0.01, 0);
  bins.body.push(crown);

  /* The roof fairing: the raised spine that carries the cable run. */
  const fairingLength = spec.length - 1.8;
  if (fairingLength > 0.4) {
    const fairing = roundedSpine(
      FAIRING_RADIUS,
      FAIRING_HEIGHT,
      fairingLength,
      FAIRING_SEGMENTS,
      FAIRING_SEGMENTS_LONG,
    );
    fairing.translate(body(), ROOF_BOX_TOP + CROWN_HEIGHT - 0.02, 0);
    bins.body.push(fairing);
  }

  /* The skirt under the chassis. */
  bins.body.push(
    box(spec.length - 0.44, FLOOR_Y + 0.02 - SKIRT_BOTTOM, SKIRT_WIDTH, body(), (SKIRT_BOTTOM + FLOOR_Y + 0.02) / 2, 0),
  );

  /* The box that hangs under the floor between the bogies. */
  bins.metal.push(box(1.1, 0.18, 1.7, body(), SKIRT_BOTTOM - 0.02, 0));

  /* The bogies, the axles and the wheels. */
  const axle = half - 0.95;
  const wheel = wheelGeometry();
  [-axle, 0, axle].forEach((at) => {
    bins.metal.push(tube(0.08, WHEEL_Z * 2, 12, 'z', body() + at, WHEEL_CENTRE_Y, 0));
    [-1, 1].forEach((side) => {
      const copy = wheel.clone();
      copy.translate(body() + at, WHEEL_CENTRE_Y, side * WHEEL_Z);
      bins.metal.push(copy);
    });
  });
  wheel.dispose();
  [-axle, axle].forEach((at) => {
    /* The bogie frame, and the two axle boxes that hold the axle. */
    bins.metal.push(box(1.3, 0.4, 1.74, body() + at, 0.46, 0));
    [-1, 1].forEach((side) => {
      bins.metal.push(box(0.26, 0.26, 0.18, body() + at, 0.42, side * 0.88));
    });
  });

  /* The roof vents, outboard of the fairing. */
  [-1, 1].forEach((side) => {
    const at = body() + side * (half - 0.45);
    bins.metal.push(box(0.6, 0.12, 0.7, at, ROOF_BOX_TOP + CROWN_HEIGHT + 0.05, 0));
    bins.metal.push(tube(0.22, 0.1, 12, 'y', at, ROOF_BOX_TOP + CROWN_HEIGHT + 0.16, 0));
  });

  /* The doors. */
  [-1, 1].forEach((side) => {
    const leaf = doorLeafGeometry();
    const at = side * (HALF_WIDTH + 0.005);
    if (spec.doors === 'moving') {
      /* The two leaves of this doorway slide apart along the car. */
      [-1, 1].forEach((end) => {
        const copy = leaf.clone();
        copy.translate(body() + end * DOOR_HALF * 0.5, LEAF_CENTRE_Y, at);
        const mesh = new THREE.Mesh(copy, materials.metal);
        mesh.name = `door-${end < 0 ? 'left' : 'right'}-${side > 0 ? 'near' : 'far'}`;
        /* Where the leaf sits when the doors are shut, and which way it goes. */
        mesh.userData.closedX = body() + end * DOOR_HALF * 0.5;
        mesh.userData.direction = end;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        sliding.push(mesh);
      });
    } else {
      const copy = leaf.clone();
      copy.translate(body(), LEAF_CENTRE_Y, at);
      bins.metal.push(copy);
    }
    leaf.dispose();
  });

  /* The pantograph, standing on the roof between the insulators. */
  if (spec.pantograph) {
    const at = body();
    const base = ROOF_BOX_TOP + CROWN_HEIGHT - 0.03;
    /* Four insulators and the frame they carry. */
    [-1, 1].forEach((x) => {
      [-1, 1].forEach((z) => {
        bins.metal.push(tube(0.07, 0.18, 10, 'y', at + x * 0.35, base + 0.09, z * 0.58));
      });
    });
    bins.metal.push(box(1, 0.07, 1.2, at, base + 0.22, 0));
    /* The lower arms and the elbow between them. */
    [-1, 1].forEach((side) => {
      bins.metal.push(strut(at + side * 0.45, base + 0.26, at, base + 0.68, 0.06, 0.06));
    });
    bins.metal.push(box(0.18, 0.1, 0.14, at, base + 0.68, 0));
    /* The upper arms and the contact strip. */
    [-1, 1].forEach((side) => {
      bins.metal.push(strut(at, base + 0.68, at + side * 0.62, base + 1.02, 0.06, 0.06));
    });
    bins.metal.push(box(1.5, 0.06, 0.1, at, base + 1.04, 0));
    bins.metal.push(box(1.4, 0.05, 0.16, at, base + 1.1, 0));
    [-1, 1].forEach((side) => {
      bins.metal.push(box(0.18, 0.04, 0.1, at + side * 0.68, base + 1.11, 0));
    });
  }

  /* The cab nose, with its windscreen and its lamp. */
  if (spec.nose !== 'none') {
    const nose = noseGeometry();
    const at = body() + (spec.nose === 'front' ? half : -half);
    if (spec.nose === 'rear') nose.rotateY(Math.PI);
    nose.translate(at, 0, 0);
    bins.body.push(nose);

    const tip = at + (spec.nose === 'front' ? NOSE_LENGTH : -NOSE_LENGTH);
    /* The windscreen: a dark panel set into the flat front face. */
    bins.dark.push(box(0.06, 0.46, 1.6, tip + (spec.nose === 'front' ? 0.02 : -0.02), 1.66, 0));
    /* The lamp housing and the lamp itself. */
    bins.metal.push(
      tube(0.24, 0.14, LAMP_SEGMENTS, 'x', tip + (spec.nose === 'front' ? -0.02 : 0.02), 1.2, 0),
    );
    bins.lamp.push(
      tube(0.17, 0.08, LAMP_SEGMENTS, 'x', tip + (spec.nose === 'front' ? 0.04 : -0.04), 1.2, 0),
    );
  }
}

/* ------------------------------------------------------------------ *
 * The whole set.
 * ------------------------------------------------------------------ */

/**
 * Builds the train.
 *
 * Three cars, nose to nose, with a coupling bar and a gangway in each
 * gap. Everything that shares a material is merged into one mesh, so the
 * set is nine draw calls: five merged bins and four door leaves.
 */
export function buildTrain(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'train';

  const bins = emptyBins();
  const materials = buildMaterials();
  const sliding: THREE.Mesh[] = [];

  const cars: CarSpec[] = [
    {
      center: -(CAR_LENGTH / 2 + CAR_GAP + (CAR_LENGTH - NOSE_LENGTH) / 2),
      length: CAR_LENGTH - NOSE_LENGTH,
      nose: 'rear',
      doors: 'fixed',
      pantograph: true,
    },
    {
      center: 0,
      length: CAR_LENGTH,
      nose: 'none',
      doors: 'moving',
      pantograph: true,
    },
    {
      center: CAR_LENGTH / 2 + CAR_GAP + (CAR_LENGTH - NOSE_LENGTH) / 2,
      length: CAR_LENGTH - NOSE_LENGTH,
      nose: 'front',
      doors: 'fixed',
      pantograph: true,
    },
  ];

  cars.forEach((car) => buildCar(car, bins, materials, sliding));

  /* The couplings and the gangways that make the set read as articulated. */
  const gapCenters = [-(CAR_LENGTH / 2 + CAR_GAP / 2), CAR_LENGTH / 2 + CAR_GAP / 2];
  gapCenters.forEach((at) => {
    /* The draw bar and the knuckle at its middle. */
    bins.metal.push(box(CAR_GAP + 0.1, 0.12, 0.16, at, 0.52, 0));
    bins.metal.push(box(0.3, 0.2, 0.24, at, 0.5, 0));
    /* The air hoses that hang between the cars. */
    [-1, 1].forEach((side) => {
      bins.metal.push(tube(0.05, 0.3, 10, 'z', at, 0.72, side * 0.42));
    });
    /* The gangway: the dark bellows that closes the gap. */
    bins.dark.push(box(CAR_GAP + 0.06, 0.94, 1.5, at, 1.56, 0));
    [-1, 1].forEach((side) => {
      bins.dark.push(box(CAR_GAP + 0.1, 1.0, 0.06, at, 1.56, side * 0.76));
    });
  });

  /* Merge each bin into one mesh. */
  (Object.keys(bins) as BinKey[]).forEach((key) => {
    const parts = bins[key];
    if (parts.length === 0) return;
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, materials[key]);
    mesh.name = `train-${key}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  });

  /* The door leaves are their own meshes so they can slide. */
  sliding.forEach((leaf) => group.add(leaf));

  return group;
}

/** Frees every geometry and material the train built. */
function disposeTrain(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  });
}

/* ------------------------------------------------------------------ *
 * The component.
 * ------------------------------------------------------------------ */

export interface TrainProps {
  /** True while the train is holding at a station. */
  dwelling: boolean;
  /** True when the doors are open. */
  doorsOpen: boolean;
}

/**
 * The train.
 *
 * The parent positions the group: the train does not know where it is.
 */
export function Train({ dwelling, doorsOpen }: TrainProps): JSX.Element {
  const train = useMemo(() => buildTrain(), []);
  const parts = useMemo(
    () => ({
      doors: train.children.filter((child) => child.name.startsWith('door-')) as THREE.Mesh[],
      glass: train.getObjectByName('train-glass') as THREE.Mesh | undefined,
    }),
    [train],
  );
  const openness = useRef(0);

  useEffect(() => () => disposeTrain(train), [train]);

  useFrame((_, delta) => {
    /* The doors ease open and closed rather than snapping. */
    openness.current = THREE.MathUtils.damp(openness.current, doorsOpen ? 1 : 0, 6, delta);
    const travel = openness.current * DOOR_TRAVEL;
    parts.doors.forEach((leaf) => {
      const closed = leaf.userData.closedX as number;
      const direction = leaf.userData.direction as number;
      leaf.position.x = closed + direction * travel;
    });

    /* A train that is standing at a platform is lit from inside. */
    const material = parts.glass?.material as THREE.MeshStandardMaterial | undefined;
    if (material) {
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        dwelling ? 1.45 : 0.85,
        3,
        delta,
      );
    }
  });

  return <primitive object={train} />;
}
