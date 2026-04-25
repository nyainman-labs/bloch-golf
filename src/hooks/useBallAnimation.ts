/**
 * Ball Animation Hook
 *
 * Manages realistic golf ball animation on the Bloch sphere.
 * Features:
 * - Gate-based rotation trajectory (not shortest path)
 * - EaseOutExpo velocity profile ("hit" feeling)
 * - Ball self-rotation (rolling)
 * - Trail point generation
 * - Partial animation support (animate only added/edited gates)
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { Gate } from '@qamposer/react';
import {
  gateToRotation,
  blochAxisToThreeJS,
  blochToVector,
  calculateAnimationDuration,
  type GateRotation,
} from '../utils/gateRotation';
import type { BlochState } from '../types/game';

/**
 * Easing function - smooth deceleration from start to finish
 * easeOutCubic: starts fast, gradually slows down to a smooth stop
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Animation state for a single gate
 */
interface GateAnimationState {
  rotation: GateRotation;
  startPosition: THREE.Vector3;
  duration: number;
  elapsed: number;
}

/**
 * Trail point for visualization
 */
export interface TrailPoint {
  position: THREE.Vector3;
  age: number;
  maxAge: number;
}

/**
 * Animation result returned each frame
 */
export interface AnimationFrame {
  /** Current ball position (on sphere surface) */
  position: THREE.Vector3;
  /** Ball self-rotation quaternion */
  ballRotation: THREE.Quaternion;
  /** Trail points for visualization */
  trailPoints: TrailPoint[];
  /** Whether animation is complete */
  isComplete: boolean;
  /** Current animation progress (0-1) */
  progress: number;
}

const MAX_TRAIL_POINTS = 120; // ~2 seconds at 60fps
const TRAIL_POINT_INTERVAL = 0.016; // ~60fps
const TRAIL_MAX_AGE = 2.0; // seconds (longer trail for better visibility)

/**
 * Hook for managing ball animation on Bloch sphere
 */
export function useBallAnimation(sphereRadius: number) {
  // Animation state refs
  const animationStateRef = useRef<GateAnimationState | null>(null);
  const gateQueueRef = useRef<GateRotation[]>([]);
  const currentPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const ballQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const trailPointsRef = useRef<TrailPoint[]>([]);
  const lastTrailTimeRef = useRef<number>(0);
  const prevPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));

  const ballRadius = sphereRadius * 0.08;

  /**
   * Start animation for specific gates from a given start state
   */
  const startAnimation = useCallback(
    (gates: Gate[], startState: BlochState) => {
      // Convert start state to position
      const startPos = blochToVector(startState.theta, startState.phi);
      currentPositionRef.current.copy(startPos);
      prevPositionRef.current.copy(startPos);

      // Convert gates to rotations and queue them
      const rotations: GateRotation[] = [];

      // Sort gates by position
      const sortedGates = [...gates]
        .filter((g) => g.qubit === 0 || g.qubit === undefined)
        .sort((a, b) => a.position - b.position);

      for (const gate of sortedGates) {
        const rotation = gateToRotation(gate);
        if (rotation) {
          rotations.push(rotation);
        }
      }

      gateQueueRef.current = rotations;
      trailPointsRef.current = [];
      lastTrailTimeRef.current = 0;

      // Start first gate animation
      startNextGate();
    },
    []
  );

  /**
   * Start animating the next gate in queue
   */
  const startNextGate = useCallback(() => {
    if (gateQueueRef.current.length === 0) {
      animationStateRef.current = null;
      return false;
    }

    const rotation = gateQueueRef.current.shift()!;
    const duration = calculateAnimationDuration(rotation.angle);

    animationStateRef.current = {
      rotation,
      startPosition: currentPositionRef.current.clone(),
      duration,
      elapsed: 0,
    };

    return true;
  }, []);

  /**
   * Update animation frame
   * Call this every frame with delta time
   */
  const updateFrame = useCallback(
    (delta: number): AnimationFrame => {
      const state = animationStateRef.current;

      // Age trail points
      trailPointsRef.current = trailPointsRef.current
        .map((p) => ({ ...p, age: p.age + delta }))
        .filter((p) => p.age < p.maxAge);

      if (!state) {
        return {
          position: currentPositionRef.current.clone().multiplyScalar(sphereRadius + ballRadius),
          ballRotation: ballQuaternionRef.current.clone(),
          trailPoints: trailPointsRef.current,
          isComplete: gateQueueRef.current.length === 0,
          progress: 1,
        };
      }

      // Update elapsed time
      state.elapsed += delta;
      const progress = Math.min(state.elapsed / state.duration, 1);
      const easedProgress = easeOutCubic(progress);

      // Calculate current rotation angle
      const currentAngle = state.rotation.angle * easedProgress;

      // Calculate position by rotating from start position
      const position = state.startPosition.clone();
      const axis = blochAxisToThreeJS(state.rotation.axis);

      // Apply rotation using quaternion
      const rotQuat = new THREE.Quaternion();
      rotQuat.setFromAxisAngle(axis, currentAngle);
      position.applyQuaternion(rotQuat);

      // Calculate ball self-rotation (rolling)
      const movement = position.clone().sub(prevPositionRef.current);
      const movementLength = movement.length();

      if (movementLength > 0.0001) {
        // Calculate roll axis (perpendicular to movement and surface normal)
        const surfaceNormal = position.clone().normalize();
        const tangent = movement.clone().normalize();
        const rollAxis = new THREE.Vector3().crossVectors(surfaceNormal, tangent).normalize();

        // Roll angle based on arc length
        const rollAngle = (movementLength * sphereRadius) / ballRadius;

        // Apply rolling rotation
        const rollQuat = new THREE.Quaternion();
        rollQuat.setFromAxisAngle(rollAxis, rollAngle);
        ballQuaternionRef.current.premultiply(rollQuat);

        // Add trail point
        lastTrailTimeRef.current += delta;
        if (lastTrailTimeRef.current >= TRAIL_POINT_INTERVAL) {
          lastTrailTimeRef.current = 0;

          if (trailPointsRef.current.length < MAX_TRAIL_POINTS) {
            trailPointsRef.current.push({
              position: position.clone().multiplyScalar(sphereRadius),
              age: 0,
              maxAge: TRAIL_MAX_AGE,
            });
          }
        }
      }

      prevPositionRef.current.copy(position);
      currentPositionRef.current.copy(position);

      // Check if this gate animation is complete
      if (progress >= 1) {
        // Start next gate or finish
        startNextGate();
      }

      return {
        position: position.clone().multiplyScalar(sphereRadius + ballRadius),
        ballRotation: ballQuaternionRef.current.clone(),
        trailPoints: trailPointsRef.current,
        isComplete: progress >= 1 && gateQueueRef.current.length === 0,
        progress,
      };
    },
    [sphereRadius, ballRadius, startNextGate]
  );

  /**
   * Reset to a specific state without animation
   */
  const resetToState = useCallback((state: BlochState) => {
    const pos = blochToVector(state.theta, state.phi);
    currentPositionRef.current.copy(pos);
    prevPositionRef.current.copy(pos);
    animationStateRef.current = null;
    gateQueueRef.current = [];
    trailPointsRef.current = [];
    ballQuaternionRef.current.identity();
  }, []);

  /**
   * Check if currently animating
   */
  const isAnimating = useCallback(() => {
    return animationStateRef.current !== null || gateQueueRef.current.length > 0;
  }, []);

  /**
   * Clear trail points (useful when state changes without animation)
   */
  const clearTrail = useCallback(() => {
    trailPointsRef.current = [];
  }, []);

  /**
   * Get current trail points (for rendering in useFrame)
   */
  const getTrailPoints = useCallback(() => {
    return trailPointsRef.current;
  }, []);

  return {
    startAnimation,
    updateFrame,
    resetToState,
    isAnimating,
    clearTrail,
    getTrailPoints,
  };
}
