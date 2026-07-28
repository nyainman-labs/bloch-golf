/**
 * Bloch Scene Component
 *
 * Main 3D scene combining all Bloch sphere elements:
 * - Grass-textured sphere
 * - Golf ball with realistic rolling animation
 * - Hole cup with flag (target state)
 * - Axis labels
 * - Celebration effects
 * - Lighting and camera controls
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { BlochState } from '../../types/game';
import { blochToCartesian } from '../../types/game';
import type { Shot } from '../../utils/shotQueue';
import { GrassSphere } from './GrassSphere';
import { GolfBall } from './GolfBall';
import { HoleCup } from './HoleCup';
import { AxisLabels } from './AxisLabels';
import { Celebration } from '../Effects';

interface BlochSceneContentProps {
  restState: BlochState;
  snapToken: number;
  activeShot: Shot | null;
  targetState: BlochState;
  isHoleComplete: boolean;
  onShotComplete?: () => void;
  onImpact?: (strength: number) => void;
  sphereRadius?: number;
}

function BlochSceneContent({
  restState,
  snapToken,
  activeShot,
  targetState,
  isHoleComplete,
  onShotComplete,
  onImpact,
  sphereRadius = 1.5,
}: BlochSceneContentProps) {
  const controlsRef = useRef<any>(null);

  // Calculate celebration position (at target state on sphere surface)
  const celebrationPosition = new THREE.Vector3();
  const [tx, ty, tz] = blochToCartesian(targetState, sphereRadius);
  celebrationPosition.set(tx, tz, -ty);

  // Auto-rotate when idle (not while a shot is being played)
  useFrame(() => {
    if (controlsRef.current && !activeShot) {
      controlsRef.current.autoRotate = true;
      controlsRef.current.autoRotateSpeed = 0.5;
    } else if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
    }
  });

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[3, 2.5, 3]} fov={50} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-3, 4, -3]} intensity={0.4} />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#fff9e6" />

      {/* Environment for reflections */}
      <Environment preset="park" background={false} />

      {/* Main Bloch sphere components */}
      <group>
        <GrassSphere radius={sphereRadius} opacity={0.35} />
        <GolfBall
          restState={restState}
          snapToken={snapToken}
          activeShot={activeShot}
          sphereRadius={sphereRadius}
          onShotComplete={onShotComplete}
          onImpact={onImpact}
        />
        <HoleCup targetState={targetState} sphereRadius={sphereRadius} />
        <AxisLabels sphereRadius={sphereRadius} />
      </group>

      {/* Celebration effect when hole is complete */}
      <Celebration position={celebrationPosition} isActive={isHoleComplete} />

      {/* Orbit controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={2.5}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  );
}

interface BlochSceneProps {
  /** Where the ball rests once every queued shot has been played */
  restState: BlochState;
  /** Bump to teleport the ball to `restState` without animating */
  snapToken: number;
  /** The shot currently being played, or null when the ball is at rest */
  activeShot: Shot | null;
  /** Target quantum state (hole position) */
  targetState: BlochState;
  /** Whether the hole is complete (triggers celebration) */
  isHoleComplete?: boolean;
  /** Callback when the current shot comes to rest */
  onShotComplete?: () => void;
  /** Callback the instant the club connects, with strike strength (0-1) */
  onImpact?: (strength: number) => void;
}

export function BlochScene({
  restState,
  snapToken,
  activeShot,
  targetState,
  isHoleComplete = false,
  onShotComplete,
  onImpact,
}: BlochSceneProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, #1a2a1c 0%, #0d150e 60%, #060a07 100%)',
          borderRadius: '8px',
        }}
      >
        <BlochSceneContent
          restState={restState}
          snapToken={snapToken}
          activeShot={activeShot}
          targetState={targetState}
          isHoleComplete={isHoleComplete}
          onShotComplete={onShotComplete}
          onImpact={onImpact}
        />
      </Canvas>
    </div>
  );
}
