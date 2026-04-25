/**
 * Bloch Golf - Game Types
 */

/**
 * Quantum state represented as a point on the Bloch sphere
 * theta: polar angle (0 to π)
 * phi: azimuthal angle (0 to 2π)
 */
export interface BlochState {
  theta: number;
  phi: number;
}

/**
 * Target state definition for a hole
 */
export interface TargetState {
  id: string;
  name: string;
  displayName: string; // e.g., "|0⟩", "|+⟩"
  state: BlochState;
  par: number;
}

/**
 * Predefined target states for beginner level
 * These correspond to the 6 cardinal points on the Bloch sphere
 */
export const BEGINNER_TARGETS: TargetState[] = [
  // Z-axis states
  {
    id: 'ket0',
    name: 'Ground State',
    displayName: '|0⟩',
    state: { theta: 0, phi: 0 },
    par: 1,
  },
  {
    id: 'ket1',
    name: 'Excited State',
    displayName: '|1⟩',
    state: { theta: Math.PI, phi: 0 },
    par: 1,
  },
  // X-axis states
  {
    id: 'ketPlus',
    name: 'Plus State',
    displayName: '|+⟩',
    state: { theta: Math.PI / 2, phi: 0 },
    par: 1,
  },
  {
    id: 'ketMinus',
    name: 'Minus State',
    displayName: '|−⟩',
    state: { theta: Math.PI / 2, phi: Math.PI },
    par: 2,
  },
  // Y-axis states
  {
    id: 'ketIPlus',
    name: 'i-Plus State',
    displayName: '|i+⟩',
    state: { theta: Math.PI / 2, phi: Math.PI / 2 },
    par: 2,
  },
  {
    id: 'ketIMinus',
    name: 'i-Minus State',
    displayName: '|i−⟩',
    state: { theta: Math.PI / 2, phi: (3 * Math.PI) / 2 },
    par: 2,
  },
];

/**
 * Game state
 */
export interface GameState {
  currentHole: number;
  totalStrokes: number;
  currentStrokes: number;
  currentState: BlochState;
  targetState: TargetState;
  isAnimating: boolean;
  isHoleComplete: boolean;
  completedHoles: number[];
  totalScore: number; // relative to par (negative = under par)
}

/**
 * Convert Bloch state to Cartesian coordinates
 */
export function blochToCartesian(state: BlochState, radius: number = 1): [number, number, number] {
  const { theta, phi } = state;
  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(theta);
  return [x, y, z];
}

/**
 * Convert Cartesian coordinates to Bloch state
 */
export function cartesianToBloch(x: number, y: number, z: number): BlochState {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) return { theta: 0, phi: 0 };

  const theta = Math.acos(z / r);
  let phi = Math.atan2(y, x);
  if (phi < 0) phi += 2 * Math.PI;

  return { theta, phi };
}

/**
 * Calculate angular distance between two Bloch states (in radians)
 */
export function angularDistance(state1: BlochState, state2: BlochState): number {
  const [x1, y1, z1] = blochToCartesian(state1);
  const [x2, y2, z2] = blochToCartesian(state2);

  // Dot product gives cos of angle
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  // Clamp to handle numerical errors
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Check if ball is in the hole (within tolerance)
 */
export function isInHole(currentState: BlochState, targetState: BlochState, tolerance: number = 0.15): boolean {
  const distance = angularDistance(currentState, targetState);
  return distance < tolerance;
}

/**
 * Create initial game state
 */
export function createInitialGameState(): GameState {
  // Start at |0⟩
  const initialState: BlochState = { theta: 0, phi: 0 };

  // Pick a random target that isn't |0⟩
  const availableTargets = BEGINNER_TARGETS.filter((t) => t.id !== 'ket0');
  const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];

  return {
    currentHole: 1,
    totalStrokes: 0,
    currentStrokes: 0,
    currentState: initialState,
    targetState: randomTarget,
    isAnimating: false,
    isHoleComplete: false,
    completedHoles: [],
    totalScore: 0,
  };
}

/**
 * Get a new target state for the next hole
 */
export function getNextTarget(completedTargetId: string): TargetState {
  // Filter out the completed target and pick a new random one
  const availableTargets = BEGINNER_TARGETS.filter((t) => t.id !== completedTargetId);
  return availableTargets[Math.floor(Math.random() * availableTargets.length)];
}

/**
 * Calculate score relative to par
 */
export function getScoreText(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return 'Par';
  if (diff === -1) return 'Birdie!';
  if (diff === -2) return 'Eagle!';
  if (diff < -2) return 'Amazing!';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double Bogey';
  return `+${diff}`;
}
