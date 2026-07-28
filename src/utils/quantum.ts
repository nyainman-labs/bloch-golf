/**
 * Bloch Golf - Quantum State Calculations
 *
 * This module provides utilities for calculating quantum state transformations
 * from circuit gates, specifically for single-qubit operations on the Bloch sphere.
 */

import type { Circuit, Gate } from '@qamposer/react';
import type { BlochState } from '../types/game';

// Note: In @qamposer/react, Gate uses:
// - position (column index)
// - parameter (rotation angle in radians)
// - qubit (target qubit index)

/**
 * Complex number representation
 */
interface Complex {
  re: number;
  im: number;
}

/**
 * Quantum state as two complex amplitudes [alpha, beta]
 * |ψ⟩ = alpha|0⟩ + beta|1⟩
 */
type QuantumState = [Complex, Complex];

/**
 * 2x2 complex matrix for single-qubit gates
 */
type Matrix2x2 = [[Complex, Complex], [Complex, Complex]];

// Helper functions for complex arithmetic
const complex = (re: number, im: number = 0): Complex => ({ re, im });
const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cAbs = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);
const cPhase = (a: Complex): number => Math.atan2(a.im, a.re);

/**
 * Gate matrices for common single-qubit gates
 */
const GATE_MATRICES: Record<string, Matrix2x2> = {
  // Hadamard gate: (1/√2) * [[1, 1], [1, -1]]
  H: [
    [complex(1 / Math.SQRT2), complex(1 / Math.SQRT2)],
    [complex(1 / Math.SQRT2), complex(-1 / Math.SQRT2)],
  ],
  // Pauli-X gate: [[0, 1], [1, 0]]
  X: [
    [complex(0), complex(1)],
    [complex(1), complex(0)],
  ],
  // Pauli-Y gate: [[0, -i], [i, 0]]
  Y: [
    [complex(0), complex(0, -1)],
    [complex(0, 1), complex(0)],
  ],
  // Pauli-Z gate: [[1, 0], [0, -1]]
  Z: [
    [complex(1), complex(0)],
    [complex(0), complex(-1)],
  ],
  // S gate (√Z): [[1, 0], [0, i]]
  S: [
    [complex(1), complex(0)],
    [complex(0), complex(0, 1)],
  ],
  // T gate (√S): [[1, 0], [0, e^(iπ/4)]]
  T: [
    [complex(1), complex(0)],
    [complex(0), complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))],
  ],
};

/**
 * Get rotation matrix for RX, RY, RZ gates
 */
function getRotationMatrix(gate: string, angle: number): Matrix2x2 {
  const cos = Math.cos(angle / 2);
  const sin = Math.sin(angle / 2);

  switch (gate) {
    case 'RX':
      return [
        [complex(cos), complex(0, -sin)],
        [complex(0, -sin), complex(cos)],
      ];
    case 'RY':
      return [
        [complex(cos), complex(-sin)],
        [complex(sin), complex(cos)],
      ];
    case 'RZ':
      return [
        [complex(cos, -sin), complex(0)],
        [complex(0), complex(cos, sin)],
      ];
    default:
      throw new Error(`Unknown rotation gate: ${gate}`);
  }
}

/**
 * Apply a 2x2 matrix to a quantum state
 */
function applyMatrix(matrix: Matrix2x2, state: QuantumState): QuantumState {
  const [[a, b], [c, d]] = matrix;
  const [alpha, beta] = state;

  return [
    cAdd(cMul(a, alpha), cMul(b, beta)),
    cAdd(cMul(c, alpha), cMul(d, beta)),
  ];
}

/**
 * Convert quantum state to Bloch sphere coordinates
 * |ψ⟩ = cos(θ/2)|0⟩ + e^(iφ)sin(θ/2)|1⟩
 */
function stateToBloch(state: QuantumState): BlochState {
  const [alpha, beta] = state;

  // Get the magnitudes
  const alphaAbs = cAbs(alpha);
  const betaAbs = cAbs(beta);

  // Handle edge cases
  if (alphaAbs < 1e-10) {
    // Pure |1⟩ state
    return { theta: Math.PI, phi: 0 };
  }

  if (betaAbs < 1e-10) {
    // Pure |0⟩ state
    return { theta: 0, phi: 0 };
  }

  // Calculate theta from the probability amplitudes
  // |alpha|² = cos²(θ/2), so θ = 2 * acos(|alpha|)
  const theta = 2 * Math.acos(Math.min(1, alphaAbs));

  // Calculate relative phase
  // We need to extract the phase of beta relative to alpha
  // |ψ⟩ = e^(iγ)(cos(θ/2)|0⟩ + e^(iφ)sin(θ/2)|1⟩)
  // The global phase γ doesn't matter for the Bloch sphere
  const alphaPhase = cPhase(alpha);
  const betaPhase = cPhase(beta);
  let phi = betaPhase - alphaPhase;

  // Normalize phi to [0, 2π)
  while (phi < 0) phi += 2 * Math.PI;
  while (phi >= 2 * Math.PI) phi -= 2 * Math.PI;

  return { theta, phi };
}

/**
 * Convert Bloch sphere coordinates to quantum state
 * (Kept for potential future use)
 */
function _blochToState(bloch: BlochState): QuantumState {
  const { theta, phi } = bloch;

  const alpha: Complex = complex(Math.cos(theta / 2));
  const beta: Complex = complex(
    Math.sin(theta / 2) * Math.cos(phi),
    Math.sin(theta / 2) * Math.sin(phi)
  );

  return [alpha, beta];
}
void _blochToState; // Suppress unused warning

/**
 * Get the matrix for a gate
 */
function getGateMatrix(gate: Gate): Matrix2x2 | null {
  const gateType = gate.type.toUpperCase();

  // Check for standard gates
  if (GATE_MATRICES[gateType]) {
    return GATE_MATRICES[gateType];
  }

  // Check for rotation gates
  if (['RX', 'RY', 'RZ'].includes(gateType)) {
    const angle = gate.parameter ?? Math.PI / 2;
    return getRotationMatrix(gateType, angle);
  }

  // Skip multi-qubit gates like CNOT for single-qubit simulation
  if (['CNOT', 'CX', 'CZ', 'SWAP'].includes(gateType)) {
    return null;
  }

  console.warn(`Unknown gate type: ${gateType}`);
  return null;
}

/**
 * Calculate the final Bloch state after applying a circuit
 */
export function calculateBlochState(circuit: Circuit): BlochState {
  // Start at |0⟩
  let state: QuantumState = [complex(1), complex(0)];

  // Sort gates by position (column/time step)
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position);

  // Apply each gate in order
  for (const gate of sortedGates) {
    // Only process gates on qubit 0 (single qubit simulation)
    if (gate.qubit !== 0) continue;

    const matrix = getGateMatrix(gate);
    if (matrix) {
      state = applyMatrix(matrix, state);
    }
  }

  return stateToBloch(state);
}

/**
 * Get the number of single-qubit gates in a circuit
 */
export function countGates(circuit: Circuit): number {
  return circuit.gates.filter((gate) => gate.qubit === 0).length;
}

/**
 * Get sorted single-qubit gates from a circuit
 */
export function getSortedGates(circuit: Circuit): Gate[] {
  return [...circuit.gates]
    .filter((g) => g.qubit === 0 || g.qubit === undefined)
    .sort((a, b) => a.position - b.position);
}

/**
 * Calculate intermediate Bloch state after applying gates up to (but not including) a specific index
 */
export function calculateIntermediateState(gates: Gate[], upToIndex: number): BlochState {
  let state: QuantumState = [complex(1), complex(0)];

  for (let i = 0; i < upToIndex && i < gates.length; i++) {
    const matrix = getGateMatrix(gates[i]);
    if (matrix) {
      state = applyMatrix(matrix, state);
    }
  }

  return stateToBloch(state);
}

/**
 * Compare two gates for equality.
 *
 * Matching is by identity plus parameter: `position` deliberately isn't
 * compared, because inserting a gate shifts the columns of everything after it
 * without changing which gates the ball has already played.
 */
export function gatesEqual(a: Gate, b: Gate): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    Math.abs((a.parameter ?? 0) - (b.parameter ?? 0)) < 1e-10
  );
}

