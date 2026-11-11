/**
 * The train.
 *
 * Three cars in the concept's metro livery: a silver shell, a blue band, a
 * red line under the windows, a dark underframe, a grey roof and a warm lit
 * window band. The two end cars taper into a cab; the middle car is the
 * articulated body between them.
 *
 * Each car is its own group, placed on the track independently, so the set
 * bends through the jogs instead of sliding along a straight axis. Each car
 * merges its geometry by material: one vertex-coloured body, one glass mesh,
 * and on the end cars one light mesh. That is eight draw calls for the set.
 *
 * The train is powered by the third rail. There is no pantograph and no
 * roof wire; the collector shoes sit on the +Z side of each bogie, over the
 * third rail.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { JSX, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { RAIL_GAUGE, SCENE_COLORS } from './constants';
import { makePose, poseAt, routeDistance, yawAlong, type LinePath } from './path';
import { nightAmount } from './Sky';
import { rideProgress } from './ride';

/* ------------------------------------------------------------------ *
 * The dimensions of one car, in world units.
 *
 * The rail head is y = 0. The floor of the car is at y = 1, level with the
 * platform, and the roof is at y = 3.5.
 * ------------------------------------------------------------------ */

const CAR_LENGTH = 8;
const CAR_WIDTH = 2.9;
const CAR_HEIGHT = 2.5;
const BODY_FLOOR = 1;
const BODY_CENTRE = BODY_FLOOR + CAR_HEIGHT / 2;
const ROOF_TOP = 3.62;

/** How far apart two car centres are. Three cars span 25.6 units. */
export const CAR_PITCH = 8.8;

/** The nose taper: the last stretch of an end car narrows to this scale. */
const NOSE_LENGTH = 1.15;
const NOSE_SCALE = 0.76;

const WHEEL_RADIUS = 0.45;
const WHEEL_WIDTH = 0.22;
const WHEEL_Z = RAIL_GAUGE / 2;
const WHEEL_Y = WHEEL_RADIUS + 0.03;

const BAND_Y = 1.35;
const STRIPE_Y = 1.7;
const BAND_LENGTH = 5.8;
const STRIPE_LENGTH = 6;

/* ------------------------------------------------------------------ *
 * The palette
 * ------------------------------------------------------------------ */

const SILVER = SCENE_COLORS.silver;
const BLUE = SCENE_COLORS.blue;
const RED = SCENE_COLORS.red;
const ROOF = SCENE_COLORS.grey;
const DARK = SCENE_COLORS.inkRaise;
const BLACK = '#15161a';
const GLASS = SCENE_COLORS.window;

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

type Painted = { geometry: THREE.BufferGeometry; colour: string };

function box(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  colour: string,
): Painted {
  return {
    geometry: new THREE.BoxGeometry(width, height, depth).translate(x, y, z),
    colour,
  };
}

function rounded(
  width: number,
  height: number,
  depth: number,
  segments: number,
  radius: number,
  x: number,
  y: number,
  z: number,
  colour: string,
): Painted {
  const geometry = new RoundedBoxGeometry(width, height, depth, segments, radius);
  geometry.translate(x, y, z);
  return { geometry, colour };
}

/**
 * Paint every vertex of a geometry one colour, ready for a merge.
 *
 * `RoundedBoxGeometry` is non-indexed and every other primitive here is
 * indexed. The merge needs one or the other, so every part is flattened to
 * non-indexed geometry first. The triangle count does not change.
 */
function paint(source: THREE.BufferGeometry, colour: string): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();

  const tint = new THREE.Color(colour);
  const count = geometry.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colours[i * 3] = tint.r;
    colours[i * 3 + 1] = tint.g;
    colours[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function mergePainted(parts: Painted[]): THREE.BufferGeometry {
  const sources = parts.map((part) => paint(part.geometry, part.colour));
  const merged = mergeGeometries(sources, false);
  sources.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('train: the car geometry could not be merged');
  return merged;
}

/**
 * Narrow the last stretch of a car towards its cab end.
 *
 * The shell is built as a rounded box and its end vertices are scaled in
 * Y and Z, which gives a tapered nose without a second extrusion.
 */
function taperNose(geometry: THREE.BufferGeometry, direction: -1 | 1): void {
  const position = geometry.getAttribute('position');
  const half = CAR_LENGTH / 2;
  const start = half - NOSE_LENGTH;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const along = direction > 0 ? x : -x;
    if (along <= start) continue;

    const raw = Math.min(1, Math.max(0, (along - start) / NOSE_LENGTH));
    const eased = raw * raw * (3 - 2 * raw);
    const scale = 1 - (1 - NOSE_SCALE) * eased;
    position.setY(i, position.getY(i) * scale);
    position.setZ(i, position.getZ(i) * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function wheelGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 20, 1);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/* ------------------------------------------------------------------ *
 * One car
 * ------------------------------------------------------------------ */

interface CarSpec {
  name: string;
  /** Where this car sits along the set at rest. */
  offset: number;
  /** Which end is a cab. */
  nose: 'front' | 'rear' | 'none';
}

function buildCar(spec: CarSpec, materials: ReturnType<typeof buildMaterials>): THREE.Group {
  const body: Painted[] = [];
  const glass: Painted[] = [];
  const lights: Painted[] = [];

  /* The shell. */
  const shell = new RoundedBoxGeometry(CAR_LENGTH, CAR_HEIGHT, CAR_WIDTH, 8, 0.36);
  if (spec.nose === 'front') taperNose(shell, 1);
  if (spec.nose === 'rear') taperNose(shell, -1);
  shell.translate(0, BODY_CENTRE, 0);
  body.push({ geometry: shell, colour: SILVER });

  /* The blue band and the red line under the windows. */
  body.push(box(BAND_LENGTH, 0.34, CAR_WIDTH + 0.04, 0, BAND_Y, 0, BLUE));
  body.push(box(STRIPE_LENGTH, 0.09, CAR_WIDTH + 0.05, 0, STRIPE_Y, 0, RED));

  /* The window band: four panels, slightly proud of the shell. */
  [-2.55, -1.0, 1.0, 2.55].forEach((x) => {
    glass.push(box(1.35, 0.9, CAR_WIDTH + 0.06, x, 2.58, 0, GLASS));
  });

  /* The double doorway in the middle of each side. */
  [-1, 1].forEach((side) => {
    const z = side * (CAR_WIDTH / 2 + 0.02);
    body.push(box(1.55, 1.95, 0.07, 0, 2.02, z, DARK));
    glass.push(box(1.25, 0.68, 0.03, 0, 2.6, z + side * 0.02, GLASS));
    body.push(box(0.055, 1.95, 0.09, 0, 2.02, z + side * 0.01, SILVER));
    body.push(box(1.4, 0.42, 0.09, 0, 1.35, z + side * 0.01, BLUE));
  });

  /* The roof, its air-conditioning pod and the vents. */
  body.push(rounded(7.9, 0.24, 2.48, 3, 0.1, 0, ROOF_TOP, 0, ROOF));
  body.push(rounded(2.6, 0.32, 1.75, 2, 0.1, -0.6, ROOF_TOP + 0.28, 0, ROOF));
  [-2.6, 2.6].forEach((x) => {
    body.push(box(0.8, 0.18, 1.0, x, ROOF_TOP + 0.2, 0, DARK));
  });

  /* The underframe and the equipment boxes between the bogies. */
  body.push(rounded(6.5, 0.55, 2.34, 2, 0.08, 0, 0.78, 0, DARK));
  body.push(box(1.5, 0.32, 1.5, 0, 0.62, 0, BLACK));

  /* The bogies, the axles and the wheels. */
  const wheel = wheelGeometry();
  [-2.55, 2.55].forEach((x) => {
    body.push(box(1.7, 0.42, 1.62, x, 0.52, 0, DARK));
    body.push({
      geometry: new THREE.CylinderGeometry(0.08, 0.08, WHEEL_Z * 2, 12)
        .rotateX(Math.PI / 2)
        .translate(x, WHEEL_Y, 0),
      colour: ROOF,
    });

    [-1, 1].forEach((side) => {
      body.push({
        geometry: wheel.clone().translate(x, WHEEL_Y, side * WHEEL_Z),
        colour: BLACK,
      });
    });

    /* The collector shoe, over the third rail on the +Z side. */
    body.push(box(0.62, 0.16, 0.24, x, 0.31, 1.16, DARK));
    body.push(box(0.12, 0.3, 0.12, x, 0.42, 1.05, ROOF));
  });
  wheel.dispose();

  /* The cab. The end face is already tapered by the shell, so the glass
   * and the lamps only have to sit on it. */
  if (spec.nose !== 'none') {
    const direction = spec.nose === 'front' ? 1 : -1;
    const face = direction * (CAR_LENGTH / 2 + 0.02);

    body.push(box(0.06, 0.66, 1.75, face, 2.72, 0, '#171d2b'));
    body.push(box(0.08, 0.16, 1.9, face - direction * 0.01, 1.98, 0, DARK));
    body.push(box(0.08, 0.16, 1.9, face - direction * 0.01, 3.34, 0, DARK));

    const lampColour = spec.nose === 'front' ? '#fff2c2' : '#ff2b2b';
    [-0.78, 0.78].forEach((z) => {
      lights.push({
        geometry: new THREE.SphereGeometry(0.17, 12, 8)
          .translate(direction * (CAR_LENGTH / 2 + 0.1), 1.55, z),
        colour: lampColour,
      });
    });
  }

  const group = new THREE.Group();
  group.name = spec.name;
  group.userData.offset = spec.offset;
  group.position.x = spec.offset;

  const bodyMesh = new THREE.Mesh(mergePainted(body), materials.body);
  bodyMesh.name = `${spec.name}-body`;
  group.add(bodyMesh);

  const glassMesh = new THREE.Mesh(mergePainted(glass), materials.glass);
  glassMesh.name = `${spec.name}-glass`;
  group.add(glassMesh);

  if (lights.length > 0) {
    const lightMesh = new THREE.Mesh(mergePainted(lights), materials.lights);
    lightMesh.name = `${spec.name}-lights`;
    group.add(lightMesh);
  }

  group.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });

  return group;
}

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

function buildMaterials(): {
  body: THREE.MeshLambertMaterial;
  glass: THREE.MeshLambertMaterial;
  lights: THREE.MeshBasicMaterial;
} {
  return {
    body: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    glass: new THREE.MeshLambertMaterial({
      color: GLASS,
      emissive: '#ffd27a',
      emissiveIntensity: 0.1,
      flatShading: true,
    }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}

/* ------------------------------------------------------------------ *
 * The whole set
 * ------------------------------------------------------------------ */

/**
 * Build the train.
 *
 * The group is returned at the origin with three car groups already at
 * their rest offsets, so the geometry can be counted and measured without a
 * canvas. `Train` moves the car groups along the line.
 */
export function buildTrain(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'train';

  const materials = buildMaterials();
  group.userData.materials = materials;

  const cars: CarSpec[] = [
    { name: 'car-rear', offset: -CAR_PITCH, nose: 'rear' },
    { name: 'car-mid', offset: 0, nose: 'none' },
    { name: 'car-front', offset: CAR_PITCH, nose: 'front' },
  ];

  cars.forEach((car) => group.add(buildCar(car, materials)));
  return group;
}

function disposeTrain(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
  });
  geometries.forEach((geometry) => geometry.dispose());

  const materials = group.userData.materials as ReturnType<typeof buildMaterials> | undefined;
  if (materials) {
    materials.body.dispose();
    materials.glass.dispose();
    materials.lights.dispose();
  }
  group.clear();
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export interface TrainProps {
  /** The line the train is running on. */
  line: LinePath;
  /** The rendered route position, written by the ride driver. */
  clock: MutableRefObject<{ s: number }>;
  /** True while the train is holding at a platform. */
  dwelling: boolean;
}

/**
 * The train.
 *
 * Each car is placed at its own distance along the line, so the set follows
 * the weave. The window band brightens as the day ends and while the train
 * is standing at a platform.
 */
export function Train({ line, clock, dwelling }: TrainProps): JSX.Element {
  const train = useMemo(() => buildTrain(), []);
  const cars = useMemo(
    () => train.children.filter((child): child is THREE.Group => child instanceof THREE.Group),
    [train],
  );
  const materials = train.userData.materials as ReturnType<typeof buildMaterials>;
  const pose = useRef(makePose());

  useEffect(() => () => disposeTrain(train), [train]);

  useFrame((_, delta) => {
    const distance = routeDistance(line.stations, clock.current.s);

    cars.forEach((car) => {
      const offset = car.userData.offset as number;
      poseAt(line, distance + offset, pose.current);
      car.position.copy(pose.current.p);
      car.rotation.y = yawAlong(pose.current.t);
    });

    const progress = rideProgress(clock.current.s, line.stations.length);
    const night = nightAmount(progress);
    const target = 0.1 + 0.9 * night + (dwelling ? 0.35 : 0);
    materials.glass.emissiveIntensity = THREE.MathUtils.damp(
      materials.glass.emissiveIntensity,
      Math.min(1.45, target),
      4,
      Math.min(delta, 0.1),
    );
  });

  return <primitive object={train} dispose={null} />;
}
