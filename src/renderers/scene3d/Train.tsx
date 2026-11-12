/**
 * The train.
 *
 * Three cars in the concept's metro livery: a silver shell, a blue band, a
 * red line under the windows, a warm lit window band and a pair of sliding
 * doors on each side. The two end cars taper into a cab; the middle car is
 * the articulated body between them.
 *
 * The brief was to strip the clutter. The grey roof cap, air-conditioning
 * pod, vents, underframe, equipment box, bogie boxes, axle cylinders and cab
 * bands are gone. What is left is the shell, the livery, the glazing and the
 * wheels, which are the only things a rider actually reads at this scale.
 *
 * Each car is its own group, placed on the track independently, so the set
 * bends through the jogs instead of sliding along a straight axis. Each car
 * merges its geometry by material: one vertex-coloured body, one glass mesh,
 * and on the end cars one light mesh. That is eight draw calls for the set.
 *
 * The train is powered by the third rail. There is no pantograph and no
 * roof wire.
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
 * The rail head is y = 0.22. The floor of the car is at y = 1, level with
 * the platform, and the roof is at y = 3.5.
 * ------------------------------------------------------------------ */

const CAR_LENGTH = 8;
const CAR_WIDTH = 2.9;
const CAR_HEIGHT = 2.5;
const BODY_FLOOR = 1;
const BODY_CENTRE = BODY_FLOOR + CAR_HEIGHT / 2;

/** How far apart two car centres are. Three cars span 25.6 units. */
export const CAR_PITCH = 8.8;

/** The nose taper: the last stretch of an end car narrows to this scale. */
const NOSE_LENGTH = 1.15;
const NOSE_SCALE = 0.76;

/** The wheel rests on the rail head at y = 0.22. */
const RAIL_TOP = 0.22;
const WHEEL_RADIUS = 0.45;
const WHEEL_WIDTH = 0.22;
const WHEEL_Z = RAIL_GAUGE / 2;
const WHEEL_Y = RAIL_TOP + WHEEL_RADIUS;

const BAND_Y = 1.35;
const STRIPE_Y = 1.7;
const BAND_LENGTH = 5.5;
const STRIPE_LENGTH = 5.5;

/* Door and window depths, from the shell outwards. Every visible face has
 * its own depth, so no two of them can z-fight. */
const SHELL_SIDE = CAR_WIDTH / 2;
const GASKET_Z = SHELL_SIDE + 0.005;
const DOOR_Z = SHELL_SIDE + 0.04;
const PANEL_Z = SHELL_SIDE + 0.065;
const WINDOW_Z = SHELL_SIDE + 0.02;

/* ------------------------------------------------------------------ *
 * The palette
 * ------------------------------------------------------------------ */

const SILVER = SCENE_COLORS.silver;
const BLUE = SCENE_COLORS.blue;
const RED = SCENE_COLORS.red;
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

  /* The shell. Its rounded roof is the roof: no cap and no pod above it. */
  const shell = new RoundedBoxGeometry(CAR_LENGTH, CAR_HEIGHT, CAR_WIDTH, 5, 0.36);
  if (spec.nose === 'front') taperNose(shell, 1);
  if (spec.nose === 'rear') taperNose(shell, -1);
  shell.translate(0, BODY_CENTRE, 0);
  body.push({ geometry: shell, colour: SILVER });

  /* The blue band and the red line under the windows. */
  body.push(box(BAND_LENGTH, 0.34, CAR_WIDTH + 0.04, 0, BAND_Y, 0, BLUE));
  body.push(box(STRIPE_LENGTH, 0.09, CAR_WIDTH + 0.05, 0, STRIPE_Y, 0, RED));

  /* The saloon windows: one clean panel either side of the doorway, kept
   * clear of the nose taper so no glass floats off the shell. */
  [-1, 1].forEach((side) => {
    const z = side * WINDOW_Z;
    [-1.95, 1.95].forEach((x) => {
      glass.push(box(1.6, 0.85, 0.05, x, 2.55, z, GLASS));
    });
  });

  /* The double doorway in the middle of each side. The gasket sits against
   * the shell, the two leaves stand proud of it, and the glass and the blue
   * lower panel stand proud of the leaves. Each layer has a different depth,
   * which is what stops the door window from flickering. */
  [-1, 1].forEach((side) => {
    const gasketZ = side * GASKET_Z;
    const doorZ = side * DOOR_Z;
    const panelZ = side * PANEL_Z;

    body.push(box(1.58, 1.96, 0.03, 0, 2.02, gasketZ, DARK));

    [-1, 1].forEach((leaf) => {
      body.push(box(0.72, 1.88, 0.05, leaf * 0.37, 2.02, doorZ, SILVER));
      glass.push(box(0.58, 0.62, 0.02, leaf * 0.37, 2.5, panelZ, GLASS));
      body.push(box(0.62, 0.54, 0.02, leaf * 0.37, 1.37, panelZ, BLUE));
    });

    body.push(box(0.035, 1.88, 0.02, 0, 2.02, panelZ, DARK));
  });

  /* The wheels. Everything between them used to be boxes; the shell is low
   * enough now that the wheels read as the only running gear. */
  const wheel = wheelGeometry();
  [-2.55, 2.55].forEach((x) => {
    [-1, 1].forEach((side) => {
      body.push({
        geometry: wheel.clone().translate(x, WHEEL_Y, side * WHEEL_Z),
        colour: BLACK,
      });
    });
  });
  wheel.dispose();

  /* The cab. The end face is already tapered by the shell, so the glass and
   * the lamps only have to sit on it. */
  if (spec.nose !== 'none') {
    const direction = spec.nose === 'front' ? 1 : -1;
    const face = direction * (CAR_LENGTH / 2 + 0.01);

    glass.push(box(0.05, 0.62, 1.25, face, 2.72, 0, GLASS));

    const lampColour = spec.nose === 'front' ? '#fff2c2' : '#ff2b2b';
    [-0.78, 0.78].forEach((z) => {
      lights.push({
        geometry: new THREE.SphereGeometry(0.14, 12, 8)
          .translate(direction * (CAR_LENGTH / 2 + 0.06), 1.55, z),
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
    // The saloon is dark glass during the day. The interior lights come up
    // gradually after dusk, with only a small lift while standing at a
    // platform so the train reads as occupied without turning brown.
    const target = 0.03 + 0.95 * night + (dwelling ? 0.12 : 0);
    materials.glass.emissiveIntensity = THREE.MathUtils.damp(
      materials.glass.emissiveIntensity,
      Math.min(1.45, target),
      4,
      Math.min(delta, 0.1),
    );
  });

  return <primitive object={train} dispose={null} />;
}
