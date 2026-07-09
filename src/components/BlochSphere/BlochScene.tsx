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
import type { Gate } from '@qamposer/react';
import type { BlochState } from '../../types/game';
import { blochToCartesian } from '../../types/game';
import { GrassSphere } from './GrassSphere';
import { GolfBall } from './GolfBall';
import { HoleCup } from './HoleCup';
import { AxisLabels } from './AxisLabels';
import { Celebration } from '../Effects';

interface BlochSceneContentProps {
  displayState: BlochState;
  targetState: BlochState;
  gatesToAnimate: Gate[] | null;
  animationStartState: BlochState | null;
  triggerAnimation: boolean;
  isHoleComplete: boolean;
  onAnimationComplete?: () => void;
  sphereRadius?: number;
}

function BlochSceneContent({
  displayState,
  targetState,
  gatesToAnimate,
  animationStartState,
  triggerAnimation,
  isHoleComplete,
  onAnimationComplete,
  sphereRadius = 1.5,
}: BlochSceneContentProps) {
  const controlsRef = useRef<any>(null);

  // Calculate celebration position (at target state on sphere surface)
  const celebrationPosition = new THREE.Vector3();
  const [tx, ty, tz] = blochToCartesian(targetState, sphereRadius);
  celebrationPosition.set(tx, tz, -ty);

  // Auto-rotate when idle (not during animation)
  useFrame(() => {
    if (controlsRef.current && !triggerAnimation) {
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
          displayState={displayState}
          gatesToAnimate={gatesToAnimate}
          animationStartState={animationStartState}
          sphereRadius={sphereRadius}
          triggerAnimation={triggerAnimation}
          onAnimationComplete={onAnimationComplete}
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
  /** Current display state (where the ball should be) */
  displayState: BlochState;
  /** Target quantum state (hole position) */
  targetState: BlochState;
  /** Gates to animate (only the added/edited gates) */
  gatesToAnimate: Gate[] | null;
  /** Start state for animation */
  animationStartState: BlochState | null;
  /** Trigger animation (true = start animation) */
  triggerAnimation: boolean;
  /** Whether the hole is complete (triggers celebration) */
  isHoleComplete?: boolean;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

export function BlochScene({
  displayState,
  targetState,
  gatesToAnimate,
  animationStartState,
  triggerAnimation,
  isHoleComplete = false,
  onAnimationComplete,
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
          displayState={displayState}
          targetState={targetState}
          gatesToAnimate={gatesToAnimate}
          animationStartState={animationStartState}
          triggerAnimation={triggerAnimation}
          isHoleComplete={isHoleComplete}
          onAnimationComplete={onAnimationComplete}
        />
      </Canvas>
    </div>
  );
}
