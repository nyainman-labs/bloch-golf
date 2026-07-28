/**
 * Ball Animation Hook
 *
 * Plays a single "shot": the club winds up, strikes the ball, and the ball
 * rolls along the gate's true rotation path.
 *
 * Features:
 * - Club swing wind-up, with impact timed to the start of the ball's motion
 * - Gate-based rotation trajectory (not shortest path)
 * - easeOutCubic velocity profile (fastest right after the strike)
 * - Ball self-rotation (rolling)
 * - Trail point generation
 *
 * The queue of shots lives in App — this hook only knows about the one it is
 * currently playing, so shots can be added or cancelled from the outside.
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { Gate } from '@qamposer/react';
import {
  gateToRotation,
  blochAxisToThreeJS,
  blochToVector,
  initialTangent,
  calculateAnimationDuration,
  type GateRotation,
} from '../utils/gateRotation';
import { evaluateSwing, SWING_LEAD } from '../utils/swing';
import type { BlochState } from '../types/game';

/**
 * Easing function - smooth deceleration from start to finish
 * easeOutCubic: starts fast, gradually slows down to a smooth stop
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Animation state for the shot currently being played
 */
interface ShotAnimationState {
  rotation: GateRotation;
  /** Rotation axis, converted to Three.js coordinates */
  axis: THREE.Vector3;
  /** Unit vector the ball starts from */
  startPosition: THREE.Vector3;
  /**
   * Direction the ball travels at the moment of impact, or null when the ball
   * sits on the rotation axis and cannot move at all.
   */
  tangent: THREE.Vector3 | null;
  /** Duration of the ball's motion, excluding the club's wind-up */
  duration: number;
  /** Time since the swing started, so `elapsed - SWING_LEAD` is the motion clock */
  elapsed: number;
  hasImpacted: boolean;
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
 * Club pose for the current frame. Null when no club should be on screen.
 */
export interface SwingFrame {
  /** World-space ball position at address — where the club is planted */
  anchor: THREE.Vector3;
  /** Surface normal at the anchor */
  up: THREE.Vector3;
  /** Direction the ball will travel */
  tangent: THREE.Vector3;
  /** Head angle in radians on its arc around the pivot (see utils/swing) */
  headAngle: number;
  /** Uniform scale, used for the pop in/out */
  scale: number;
}

/**
 * Where and how the club connected. Non-null only on the frame of impact.
 *
 * Deliberately independent of `swing`: on a slow frame a single large delta can
 * step straight past the club's whole on-screen window, and the strike effects
 * must still fire.
 */
export interface ImpactFrame {
  /** World-space ball position at the moment of the strike */
  anchor: THREE.Vector3;
  /** Sphere surface normal there */
  up: THREE.Vector3;
  /** Direction the ball is about to travel */
  tangent: THREE.Vector3;
  /** 0-1, scaled from the rotation angle — how hard the ball was struck */
  strength: number;
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
  /** Club pose, or null when the club is off screen */
  swing: SwingFrame | null;
  /** Set only on the frame the club makes contact */
  impact: ImpactFrame | null;
  /** True only on the frame the shot comes to rest */
  isComplete: boolean;
  /** True while a shot is being played (wind-up or motion) */
  isActive: boolean;
  /** Progress of the ball's motion (0-1) */
  progress: number;
}

const MAX_TRAIL_POINTS = 120; // ~2 seconds at 60fps
const TRAIL_POINT_INTERVAL = 0.016; // ~60fps
const TRAIL_MAX_AGE = 2.0; // seconds (longer trail for better visibility)
/** Lift the trail just clear of the translucent grass shell so it stays visible */
const TRAIL_SURFACE_OFFSET = 1.005;
/**
 * Longest step the animation will take in one frame. Without this, a stalled
 * tab or a GC pause hands us a delta big enough to jump clean over the swing,
 * which reads as the ball teleporting with no shot played.
 */
const MAX_DELTA = 1 / 20;

/**
 * Hook for managing ball animation on Bloch sphere
 */
export function useBallAnimation(sphereRadius: number) {
  // Animation state refs
  const shotRef = useRef<ShotAnimationState | null>(null);
  const currentPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const ballQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const trailPointsRef = useRef<TrailPoint[]>([]);
  const lastTrailTimeRef = useRef<number>(0);
  const prevPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const swingFrameRef = useRef<SwingFrame | null>(null);

  const ballRadius = sphereRadius * 0.08;
  const surfaceRadius = sphereRadius + ballRadius;

  /**
   * Begin a shot: wind the club up at `startState`, then strike the ball
   * through `gate`'s rotation.
   *
   * Returns false if the gate has no Bloch rotation (e.g. CNOT).
   */
  const startShot = useCallback(
    (gate: Gate, startState: BlochState): boolean => {
      const rotation = gateToRotation(gate);
      if (!rotation) {
        shotRef.current = null;
        swingFrameRef.current = null;
        return false;
      }

      const startPos = blochToVector(startState.theta, startState.phi);
      currentPositionRef.current.copy(startPos);
      prevPositionRef.current.copy(startPos);

      const axis = blochAxisToThreeJS(rotation.axis);

      shotRef.current = {
        rotation,
        axis,
        startPosition: startPos.clone(),
        tangent: initialTangent(startPos, axis, rotation.angle),
        duration: calculateAnimationDuration(rotation.angle),
        elapsed: 0,
        hasImpacted: false,
      };

      return true;
    },
    []
  );

  /**
   * Cancel the shot in flight, leaving the ball where it is.
   */
  const cancelShot = useCallback(() => {
    shotRef.current = null;
    swingFrameRef.current = null;
  }, []);

  /**
   * Update animation frame
   * Call this every frame with delta time
   */
  const updateFrame = useCallback(
    (rawDelta: number): AnimationFrame => {
      const delta = Math.min(rawDelta, MAX_DELTA);
      const shot = shotRef.current;

      // Age trail points
      trailPointsRef.current = trailPointsRef.current
        .map((p) => ({ ...p, age: p.age + delta }))
        .filter((p) => p.age < p.maxAge);

      if (!shot) {
        swingFrameRef.current = null;
        return {
          position: currentPositionRef.current.clone().multiplyScalar(surfaceRadius),
          ballRotation: ballQuaternionRef.current.clone(),
          trailPoints: trailPointsRef.current,
          swing: null,
          impact: null,
          isComplete: false,
          isActive: false,
          progress: 1,
        };
      }

      // A gate that leaves the ball on the rotation axis (Z on |0⟩, X on |+⟩)
      // cannot move it, so there is no direction to swing along. Resolve the
      // shot right away with no club, no strike and no wasted wind-up — but
      // still report completion, since that is what advances the queue.
      if (!shot.tangent) {
        shotRef.current = null;
        swingFrameRef.current = null;
        return {
          position: shot.startPosition.clone().multiplyScalar(surfaceRadius),
          ballRotation: ballQuaternionRef.current.clone(),
          trailPoints: trailPointsRef.current,
          swing: null,
          impact: null,
          isComplete: true,
          isActive: true,
          progress: 1,
        };
      }

      shot.elapsed += delta;

      // The ball's clock starts at impact; before that only the club moves.
      const motionElapsed = shot.elapsed - SWING_LEAD;
      const anchor = shot.startPosition.clone().multiplyScalar(surfaceRadius);

      let impact: ImpactFrame | null = null;
      if (motionElapsed >= 0 && !shot.hasImpacted) {
        shot.hasImpacted = true;
        impact = {
          anchor: anchor.clone(),
          up: shot.startPosition.clone(),
          tangent: shot.tangent.clone(),
          strength: Math.min(Math.abs(shot.rotation.angle) / Math.PI, 1),
        };
      }

      // Club pose
      const pose = evaluateSwing(shot.elapsed);
      swingFrameRef.current = pose.visible
        ? {
            anchor,
            up: shot.startPosition.clone(),
            tangent: shot.tangent.clone(),
            headAngle: pose.headAngle,
            scale: pose.scale,
          }
        : null;

      // Wind-up: the ball sits still at address
      if (motionElapsed < 0) {
        return {
          position: shot.startPosition.clone().multiplyScalar(surfaceRadius),
          ballRotation: ballQuaternionRef.current.clone(),
          trailPoints: trailPointsRef.current,
          swing: swingFrameRef.current,
          impact: null,
          isComplete: false,
          isActive: true,
          progress: 0,
        };
      }

      const progress = Math.min(motionElapsed / shot.duration, 1);
      const easedProgress = easeOutCubic(progress);

      // Calculate current rotation angle
      const currentAngle = shot.rotation.angle * easedProgress;

      // Calculate position by rotating from start position
      const position = shot.startPosition.clone();

      // Apply rotation using quaternion
      const rotQuat = new THREE.Quaternion();
      rotQuat.setFromAxisAngle(shot.axis, currentAngle);
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

          // Ring buffer: drop the oldest point rather than stop recording, so
          // long multi-gate sequences keep a trail behind the ball.
          if (trailPointsRef.current.length >= MAX_TRAIL_POINTS) {
            trailPointsRef.current.shift();
          }
          trailPointsRef.current.push({
            position: position.clone().multiplyScalar(sphereRadius * TRAIL_SURFACE_OFFSET),
            age: 0,
            maxAge: TRAIL_MAX_AGE,
          });
        }
      }

      prevPositionRef.current.copy(position);
      currentPositionRef.current.copy(position);

      const isComplete = progress >= 1;
      if (isComplete) {
        shotRef.current = null;
      }

      return {
        position: position.clone().multiplyScalar(surfaceRadius),
        ballRotation: ballQuaternionRef.current.clone(),
        trailPoints: trailPointsRef.current,
        swing: swingFrameRef.current,
        impact,
        isComplete,
        isActive: true,
        progress,
      };
    },
    [sphereRadius, ballRadius, surfaceRadius]
  );

  /**
   * Snap to a specific state without animation
   */
  const resetToState = useCallback((state: BlochState) => {
    const pos = blochToVector(state.theta, state.phi);
    currentPositionRef.current.copy(pos);
    prevPositionRef.current.copy(pos);
    shotRef.current = null;
    swingFrameRef.current = null;
    trailPointsRef.current = [];
    ballQuaternionRef.current.identity();
  }, []);

  /**
   * Check if a shot is currently being played
   */
  const isAnimating = useCallback(() => {
    return shotRef.current !== null;
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

  /**
   * Get the current club pose (for rendering in useFrame)
   */
  const getSwingFrame = useCallback(() => {
    return swingFrameRef.current;
  }, []);

  return {
    startShot,
    cancelShot,
    updateFrame,
    resetToState,
    isAnimating,
    clearTrail,
    getTrailPoints,
    getSwingFrame,
  };
}
