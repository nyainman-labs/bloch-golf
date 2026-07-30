/**
 * Gate Rotation Utility
 *
 * Converts quantum gates to SO(3) rotations (axis + angle) for Bloch sphere animation.
 * This allows us to animate along the TRUE trajectory of the gate operation,
 * not just the shortest path (geodesic).
 */

import * as THREE from "three";
import type { Gate } from "@qamposer/react";

/**
 * Rotation representation: axis and angle
 */
export interface GateRotation {
  /** Normalized rotation axis in Bloch sphere coordinates */
  axis: THREE.Vector3;
  /** Rotation angle in radians */
  angle: number;
}

/**
 * Convert a quantum gate to its Bloch sphere rotation (axis + angle).
 *
 * Gate mappings:
 * - Rx(θ): axis = (1,0,0), angle = θ
 * - Ry(θ): axis = (0,1,0), angle = θ
 * - Rz(θ): axis = (0,0,1), angle = θ
 * - X: axis = (1,0,0), angle = π
 * - Y: axis = (0,1,0), angle = π
 * - Z: axis = (0,0,1), angle = π
 * - H: axis = (1,0,1)/√2, angle = π (rotation around x+z axis)
 */
export function gateToRotation(gate: Gate): GateRotation | null {
  const gateType = gate.type.toUpperCase();

  switch (gateType) {
    // Rotation gates
    case "RX":
      return {
        axis: new THREE.Vector3(1, 0, 0),
        angle: gate.parameter ?? Math.PI / 2,
      };

    case "RY":
      return {
        axis: new THREE.Vector3(0, 1, 0),
        angle: gate.parameter ?? Math.PI / 2,
      };

    case "RZ":
      return {
        axis: new THREE.Vector3(0, 0, 1),
        angle: gate.parameter ?? Math.PI / 2,
      };

    // Pauli gates (π rotations)
    case "X":
      return {
        axis: new THREE.Vector3(1, 0, 0),
        angle: Math.PI,
      };

    case "Y":
      return {
        axis: new THREE.Vector3(0, 1, 0),
        angle: Math.PI,
      };

    case "Z":
      return {
        axis: new THREE.Vector3(0, 0, 1),
        angle: Math.PI,
      };

    // Hadamard: π rotation around (x+z)/√2 axis
    case "H":
      return {
        axis: new THREE.Vector3(1, 0, 1).normalize(),
        angle: Math.PI,
      };

    // S gate: π/2 rotation around Z
    case "S":
      return {
        axis: new THREE.Vector3(0, 0, 1),
        angle: Math.PI / 2,
      };

    // T gate: π/4 rotation around Z
    case "T":
      return {
        axis: new THREE.Vector3(0, 0, 1),
        angle: Math.PI / 4,
      };

    // Multi-qubit gates - not applicable for single-qubit Bloch sphere
    case "CNOT":
    case "CX":
    case "CZ":
    case "SWAP":
      return null;

    default:
      console.warn(`Unknown gate type for rotation: ${gateType}`);
      return null;
  }
}

/**
 * Apply a rotation to a Bloch vector.
 * Uses Rodrigues' rotation formula for efficiency.
 *
 * @param vector - The Bloch vector to rotate (will be modified)
 * @param axis - Normalized rotation axis
 * @param angle - Rotation angle in radians
 */
export function rotateBlochVector(
  vector: THREE.Vector3,
  axis: THREE.Vector3,
  angle: number,
): void {
  // Rodrigues' rotation formula:
  // v_rot = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const oneMinusCosA = 1 - cosA;

  const kCrossV = new THREE.Vector3().crossVectors(axis, vector);
  const kDotV = axis.dot(vector);

  vector.multiplyScalar(cosA);
  vector.addScaledVector(kCrossV, sinA);
  vector.addScaledVector(axis, kDotV * oneMinusCosA);
}

/**
 * Convert Bloch sphere coordinates (theta, phi) to a direction vector.
 * Note: Returns vector in Three.js coordinate system (Y-up).
 *
 * @param theta - Polar angle (0 to π)
 * @param phi - Azimuthal angle (0 to 2π)
 */
export function blochToVector(theta: number, phi: number): THREE.Vector3 {
  // Bloch sphere: x = sin(θ)cos(φ), y = sin(θ)sin(φ), z = cos(θ)
  const x = Math.sin(theta) * Math.cos(phi);
  const y = Math.sin(theta) * Math.sin(phi);
  const z = Math.cos(theta);

  // Convert to Three.js coordinates (swap Y and Z, negate Y)
  return new THREE.Vector3(x, z, -y);
}

/**
 * Convert rotation axis from Bloch sphere to Three.js coordinates.
 * The Bloch sphere uses Z-up, Three.js uses Y-up.
 */
export function blochAxisToThreeJS(axis: THREE.Vector3): THREE.Vector3 {
  // Bloch: (x, y, z) -> Three.js: (x, z, -y)
  return new THREE.Vector3(axis.x, axis.z, -axis.y);
}

/**
 * Smallest |axis × position| we treat as real travel.
 *
 * The ball circles the axis on a arc of radius |axis × position| = sin θ, so
 * below this the furthest it can move is π · 1.5 · 1e-3 ≈ 0.005 units — about
 * 4% of the ball's radius, which is invisible.
 */
const MIN_TRAVEL_SQ = 1e-3 * 1e-3;

/**
 * Direction the ball starts travelling in when a rotation is applied.
 *
 * The ball traces a circle about `axis`, so its velocity at t=0 is along
 * `axis × position`, signed by the direction of rotation. This is what the
 * club aims at, so its face points where the ball will actually go.
 *
 * Returns null when the ball sits on the rotation axis (e.g. Z applied to |0⟩)
 * and therefore cannot move: a phase-only gate has no travel direction, so
 * there is nothing for a club to be aimed along.
 *
 * @param position - Ball position as a unit vector in Three.js coordinates
 * @param axis - Rotation axis in Three.js coordinates (already converted)
 * @param angle - Rotation angle in radians (sign matters)
 */
export function initialTangent(
  position: THREE.Vector3,
  axis: THREE.Vector3,
  angle: number,
): THREE.Vector3 | null {
  const tangent = new THREE.Vector3().crossVectors(axis, position);

  if (tangent.lengthSq() < MIN_TRAVEL_SQ) {
    return null;
  }

  tangent.normalize();
  if (angle < 0) {
    tangent.negate();
  }
  return tangent;
}

/**
 * Calculate animation duration based on rotation angle.
 * Larger rotations take longer to animate.
 *
 * Formula: T = 0.8s + 0.6s * min(|θ|/π, 1)
 * Range: 0.8s to 1.4s. Combined with the club's ~0.45s wind-up this puts a
 * single gate at roughly 1.25–1.85s, which keeps a multi-gate sequence brisk.
 */
export function calculateAnimationDuration(angle: number): number {
  const normalizedAngle = Math.min(Math.abs(angle) / Math.PI, 1);
  return 0.8 + 0.6 * normalizedAngle;
}
