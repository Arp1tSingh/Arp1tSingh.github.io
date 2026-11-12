/**
 * The line.
 *
 * A station sits in one of two lanes. The track runs through each platform,
 * then jogs to the other lane before the next one. Four rounds of Chaikin
 * smoothing turn the control polygon into a gentle wave, and the tangent is
 * blended between samples so the heading never steps at a vertex.
 *
 * Everything in the scene reads from this module: the rails, the sleepers,
 * the carriages, the camera and the station anchors. It is pure geometry, so
 * the layout is unit-tested without a canvas.
 */

import * as THREE from 'three';

import {
  LEAD_IN,
  LEAD_OUT,
  STATION_SPACING,
  STRAIGHT_HALF,
  laneAt,
} from './constants';

export interface LinePath {
  /** The smoothed centreline, in order. */
  points: THREE.Vector3[];
  /** Arc length at each point. */
  cum: number[];
  /** Total length of the line. */
  total: number;
  /** Arc distance of each station centre. */
  stations: number[];
}

/** One position and direction on the line. */
export interface Pose {
  p: THREE.Vector3;
  t: THREE.Vector3;
}

/** A reusable pose, so a frame does not allocate. */
export function makePose(): Pose {
  return { p: new THREE.Vector3(), t: new THREE.Vector3() };
}

/** Scratch direction for blending a tangent into the next sample. */
const nextTangent = new THREE.Vector3();

/** How many corner-cutting rounds the control polygon gets. */
const SMOOTHING_ROUNDS = 4;

function chaikin(points: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [points[0].clone()];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    out.push(
      new THREE.Vector3().lerpVectors(a, b, 0.25),
      new THREE.Vector3().lerpVectors(a, b, 0.75),
    );
  }
  out.push(points[points.length - 1].clone());
  return out;
}

/** The raw control points: straight through each platform, jogging between. */
function controlPoints(stopCount: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [
    new THREE.Vector3(-LEAD_IN, 0, laneAt(0)),
  ];
  for (let k = 0; k < stopCount; k += 1) {
    const x = k * STATION_SPACING;
    const z = laneAt(k);
    points.push(
      new THREE.Vector3(x - STRAIGHT_HALF, 0, z),
      new THREE.Vector3(x + STRAIGHT_HALF, 0, z),
    );
  }
  points.push(
    new THREE.Vector3((stopCount - 1) * STATION_SPACING + LEAD_OUT, 0, laneAt(stopCount - 1)),
  );
  return points;
}

/**
 * Find the distance along the line nearest to a station anchor.
 *
 * The result is asserted against the anchor in the path tests.
 */
function nearestDistance(line: { points: THREE.Vector3[]; cum: number[]; total: number }, x: number, z: number): number {
  const pose = makePose();
  let best = Infinity;
  let bestDistance = 0;

  for (let d = 0; d <= line.total; d += 0.5) {
    poseAtRaw(line, d, pose);
    const dx = pose.p.x - x;
    const dz = pose.p.z - z;
    const squared = dx * dx + dz * dz;
    if (squared < best) {
      best = squared;
      bestDistance = d;
    }
  }

  const from = Math.max(0, bestDistance - 1);
  const to = Math.min(line.total, bestDistance + 1);
  for (let d = from; d <= to; d += 0.02) {
    poseAtRaw(line, d, pose);
    const dx = pose.p.x - x;
    const dz = pose.p.z - z;
    const squared = dx * dx + dz * dz;
    if (squared < best) {
      best = squared;
      bestDistance = d;
    }
  }

  return bestDistance;
}

function poseAtRaw(
  line: { points: THREE.Vector3[]; cum: number[]; total: number },
  distance: number,
  out: Pose,
): void {
  const d = Math.min(line.total, Math.max(0, distance));
  let lo = 0;
  let hi = line.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (line.cum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }

  const a = line.points[lo];
  const b = line.points[lo + 1];
  const span = line.cum[lo + 1] - line.cum[lo];
  const alpha = span > 0 ? (d - line.cum[lo]) / span : 0;
  out.p.lerpVectors(a, b, alpha);
  out.t.subVectors(b, a).normalize();

  // Blend towards the next sample's direction. The centreline is a polyline,
  // so without this the heading would step at every vertex; with it, the
  // train, the sleepers and the camera all follow a continuous turn.
  const after = line.points[lo + 2];
  if (after) {
    nextTangent.subVectors(after, b).normalize();
    out.t.lerp(nextTangent, alpha).normalize();
  }
}

/** Build the whole line for a route with this many stops. */
export function buildLine(stopCount: number): LinePath {
  let points = controlPoints(Math.max(1, stopCount));
  for (let round = 0; round < SMOOTHING_ROUNDS; round += 1) points = chaikin(points);

  const cum: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    cum.push(cum[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const total = cum[cum.length - 1];

  const base = { points, cum, total };
  const stations: number[] = [];
  for (let k = 0; k < Math.max(1, stopCount); k += 1) {
    stations.push(nearestDistance(base, k * STATION_SPACING, laneAt(k)));
  }

  return { ...base, stations };
}

/** The distance along the line for a fractional stop position. */
export function routeDistance(stations: number[], s: number): number {
  if (stations.length === 0) return 0;
  if (stations.length === 1) return stations[0];
  const clamped = Math.min(stations.length - 1, Math.max(0, s));
  const k = Math.min(stations.length - 2, Math.floor(clamped));
  const f = clamped - k;
  return stations[k] + (stations[k + 1] - stations[k]) * f;
}

/** A position and tangent at a distance along the line. */
export function poseAt(line: LinePath, distance: number, out: Pose): Pose {
  poseAtRaw(line, distance, out);
  return out;
}

/**
 * The yaw that points a local +X model along a tangent.
 *
 * The line is flat, so this is a pure Y rotation and the train never rolls.
 */
export function yawAlong(tangent: THREE.Vector3): number {
  return Math.atan2(-tangent.z, tangent.x);
}
