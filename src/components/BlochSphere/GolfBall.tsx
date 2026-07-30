/**
 * Golf Ball Component
 *
 * A realistic golf ball with dimple texture that moves on the Bloch sphere.
 * Features:
 * - Procedural dimple normal map
 * - Realistic rolling animation along gate rotation paths
 * - Self-rotation based on movement
 * - Declarative state synchronization with circuit
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BlochState } from '../../types/game';
import type { Shot } from '../../utils/shotQueue';
import { useBallAnimation } from '../../hooks/useBallAnimation';
import { blochToVector } from '../../utils/gateRotation';
import { BallTrail } from './BallTrail';
import { GolfClub } from './GolfClub';
import { ImpactBurst, type ImpactBurstHandle } from '../Effects/ImpactBurst';

interface GolfBallProps {
  /** Where the ball rests once every queued shot has been played */
  restState: BlochState;
  /**
   * Bumped by the app to teleport the ball to `restState`.
   *
   * Repositioning is deliberately driven by this token rather than by
   * `restState` changing: the app knows the ball's final state as soon as a
   * gate is dropped, and reacting to that would warp the ball to its
   * destination while the club is still winding up to hit it.
   */
  snapToken: number;
  /** The shot currently being played, or null when the ball is at rest */
  activeShot: Shot | null;
  /** Sphere radius */
  sphereRadius: number;
  /** Callback when the current shot comes to rest */
  onShotComplete?: () => void;
  /** Callback the instant the club connects, with strike strength (0-1) */
  onImpact?: (strength: number) => void;
}

/**
 * Generate dimple pattern for golf ball normal map
 */
function createDimpleTexture(size: number = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);

  // Create a grid of dimples
  const dimpleRadius = size / 20;
  const dimpleSpacing = size / 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Default normal pointing up (blue = z)
      let nx = 0;
      let ny = 0;
      let nz = 1;

      // Check if we're near a dimple
      const offsetY = y % dimpleSpacing;
      const rowOffset = Math.floor(y / dimpleSpacing) % 2 === 0 ? 0 : dimpleSpacing / 2;
      const adjustedX = (x + rowOffset) % dimpleSpacing;

      const dx = adjustedX - dimpleSpacing / 2;
      const dy = offsetY - dimpleSpacing / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < dimpleRadius) {
        // Inside a dimple - create a concave normal
        const factor = 1 - dist / dimpleRadius;
        const depth = factor * factor * 0.3;

        nx = (dx / dimpleRadius) * depth;
        ny = (dy / dimpleRadius) * depth;
        nz = 1 - depth * 0.5;

        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;
      }

      // Convert to RGB (normal map format)
      data[i] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);

  return texture;
}

export function GolfBall({
  restState,
  snapToken,
  activeShot,
  sphereRadius,
  onShotComplete,
  onImpact,
}: GolfBallProps) {
  const ballRef = useRef<THREE.Mesh>(null);
  const burstRef = useRef<ImpactBurstHandle>(null);

  const ballRadius = sphereRadius * 0.08;
  const surfaceRadius = sphereRadius + ballRadius;

  // Create dimple normal map
  const dimpleNormalMap = useMemo(() => createDimpleTexture(256), []);

  // Animation system
  const {
    startShot,
    cancelShot,
    updateFrame,
    resetToState,
    getTrailPoints,
    getSwingFrame,
  } = useBallAnimation(sphereRadius);

  // Initial position, before any shot has been played
  const initialPosition = useMemo(() => {
    return blochToVector(restState.theta, restState.phi).multiplyScalar(surfaceRadius);
  }, [restState.theta, restState.phi, surfaceRadius]);

  // Teleport to the resting state whenever the app bumps the snap token.
  // Depending on snapToken alone (not restState) is what keeps the ball at
  // address while the club winds up.
  useEffect(() => {
    cancelShot();
    resetToState(restState);
    if (ballRef.current) {
      ballRef.current.position
        .copy(blochToVector(restState.theta, restState.phi))
        .multiplyScalar(surfaceRadius);
    }
  }, [snapToken]); // restState is read on purpose only when the token changes

  // Play a shot whenever the app hands over a new one
  useEffect(() => {
    if (activeShot) {
      startShot(activeShot.gate, activeShot.startState);
    }
  }, [activeShot, startShot]);

  // Update animation every frame
  useFrame((_, delta) => {
    if (!ballRef.current) return;

    const frame = updateFrame(delta);

    if (frame.isActive) {
      ballRef.current.position.copy(frame.position);
      ballRef.current.quaternion.copy(frame.ballRotation);
    } else {
      // Idle animation - subtle rotation
      ballRef.current.rotation.y += delta * 0.1;
    }

    if (frame.impact) {
      const { anchor, up, tangent, strength } = frame.impact;
      burstRef.current?.burst(anchor, up, tangent, strength);
      onImpact?.(strength);
    }

    if (frame.isComplete) {
      onShotComplete?.();
    }
  });

  return (
    <group>
      {/* Golf ball */}
      <mesh ref={ballRef} position={initialPosition} castShadow>
        <sphereGeometry args={[ballRadius, 64, 64]} />
        <meshStandardMaterial
          color="#f8f8f8"
          roughness={0.3}
          metalness={0.0}
          normalMap={dimpleNormalMap}
          normalScale={new THREE.Vector2(0.5, 0.5)}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Trail effect */}
      <BallTrail getPoints={getTrailPoints} color="#a8d4a8" maxOpacity={0.5} />

      {/* Club that strikes the ball */}
      <GolfClub getSwing={getSwingFrame} ballRadius={ballRadius} />

      {/* Hit mark at the moment of contact */}
      <ImpactBurst ref={burstRef} size={ballRadius * 0.34} />
    </group>
  );
}
