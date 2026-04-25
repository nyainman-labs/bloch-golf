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
import type { Gate } from '@qamposer/react';
import type { BlochState } from '../../types/game';
import { useBallAnimation } from '../../hooks/useBallAnimation';
import { blochToVector } from '../../utils/gateRotation';
import { BallTrail } from './BallTrail';

interface GolfBallProps {
  /** Current display state (where the ball should be) */
  displayState: BlochState;
  /** Gates to animate (only the new/changed gates) */
  gatesToAnimate: Gate[] | null;
  /** Start state for animation */
  animationStartState: BlochState | null;
  /** Sphere radius */
  sphereRadius: number;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Trigger animation (changes to true to start) */
  triggerAnimation?: boolean;
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
  displayState,
  gatesToAnimate,
  animationStartState,
  sphereRadius,
  onAnimationComplete,
  triggerAnimation = false,
}: GolfBallProps) {
  const ballRef = useRef<THREE.Mesh>(null);
  const animatingRef = useRef(false);
  const lastTriggerRef = useRef(false);

  const ballRadius = sphereRadius * 0.08;
  const surfaceRadius = sphereRadius + ballRadius;

  // Create dimple normal map
  const dimpleNormalMap = useMemo(() => createDimpleTexture(256), []);

  // Animation system
  const { startAnimation, updateFrame, resetToState, clearTrail, getTrailPoints } =
    useBallAnimation(sphereRadius);

  // Initial position from display state
  const initialPosition = useMemo(() => {
    return blochToVector(displayState.theta, displayState.phi).multiplyScalar(surfaceRadius);
  }, [displayState.theta, displayState.phi, surfaceRadius]);

  // Reset position when display state changes (without animation)
  useEffect(() => {
    if (!animatingRef.current) {
      resetToState(displayState);
      // Clear trail when state changes without animation (e.g., gate deletion)
      clearTrail();
      if (ballRef.current) {
        const pos = blochToVector(displayState.theta, displayState.phi).multiplyScalar(surfaceRadius);
        ballRef.current.position.copy(pos);
      }
    }
  }, [displayState, resetToState, clearTrail, surfaceRadius]);

  // Start animation when triggered
  useEffect(() => {
    // Detect rising edge of triggerAnimation
    if (
      triggerAnimation &&
      !lastTriggerRef.current &&
      gatesToAnimate &&
      gatesToAnimate.length > 0 &&
      animationStartState
    ) {
      animatingRef.current = true;
      startAnimation(gatesToAnimate, animationStartState);
    }
    lastTriggerRef.current = triggerAnimation;
  }, [triggerAnimation, gatesToAnimate, animationStartState, startAnimation]);

  // Update animation every frame
  useFrame((_, delta) => {
    if (!ballRef.current) return;

    if (animatingRef.current) {
      const frame = updateFrame(delta);

      // Update ball position
      ballRef.current.position.copy(frame.position);

      // Update ball rotation (rolling)
      ballRef.current.quaternion.copy(frame.ballRotation);

      // Check if animation complete
      if (frame.isComplete) {
        animatingRef.current = false;
        onAnimationComplete?.();
      }
    } else {
      // Idle animation - subtle rotation
      ballRef.current.rotation.y += delta * 0.1;
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
    </group>
  );
}
