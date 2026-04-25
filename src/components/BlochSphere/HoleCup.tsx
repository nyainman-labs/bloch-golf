/**
 * Hole Cup Component
 *
 * The target hole on the Bloch sphere with a flag.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BlochState } from '../../types/game';
import { blochToCartesian } from '../../types/game';

interface HoleCupProps {
  targetState: BlochState;
  sphereRadius: number;
}

export function HoleCup({ targetState, sphereRadius }: HoleCupProps) {
  const flagRef = useRef<THREE.Group>(null);

  const holeRadius = sphereRadius * 0.12;
  const flagHeight = sphereRadius * 0.6;

  // Position the hole on the sphere surface
  const position = useMemo(() => {
    const [x, y, z] = blochToCartesian(targetState, sphereRadius);
    return new THREE.Vector3(x, z, -y); // Swap Y and Z for Three.js coordinate system
  }, [targetState, sphereRadius]);

  // Calculate rotation to align with sphere surface
  const rotation = useMemo(() => {
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion);
    return euler;
  }, [position]);

  // Animate the flag waving
  useFrame((state) => {
    if (flagRef.current) {
      const time = state.clock.getElapsedTime();
      flagRef.current.rotation.y = Math.sin(time * 2) * 0.1;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Hole (dark circle) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[holeRadius, 32]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hole rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[holeRadius, holeRadius + 0.02, 32]} />
        <meshStandardMaterial
          color="#4a4a4a"
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Flag group */}
      <group ref={flagRef} position={[holeRadius * 0.3, 0, 0]}>
        {/* Flag pole */}
        <mesh position={[0, flagHeight / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.025, flagHeight, 8]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.3} metalness={0.5} />
        </mesh>

        {/* Flag */}
        <mesh position={[0.12, flagHeight - 0.1, 0]}>
          <planeGeometry args={[0.24, 0.16]} />
          <meshStandardMaterial
            color="#a855f7"
            roughness={0.4}
            side={THREE.DoubleSide}
            emissive="#a855f7"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Flag ball top */}
        <mesh position={[0, flagHeight + 0.025, 0]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial
            color="#00d4ff"
            roughness={0.2}
            metalness={0.6}
            emissive="#00d4ff"
            emissiveIntensity={0.4}
          />
        </mesh>
      </group>
    </group>
  );
}
