/**
 * Ball Trail Component
 *
 * Lightweight trail effect using instanced meshes.
 * Shows the path of the ball with fading spheres.
 * Uses a ref getter to access trail points during animation without React re-renders.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TrailPoint } from '../../hooks/useBallAnimation';

interface BallTrailProps {
  /** Function that returns current trail points (called every frame) */
  getPoints: () => TrailPoint[];
  color?: string;
  maxOpacity?: number;
}

const MAX_INSTANCES = 120;

export function BallTrail({
  getPoints,
  color = '#ffffff',
  maxOpacity = 0.6,
}: BallTrailProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummyRef = useRef(new THREE.Object3D());

  const trailColor = useMemo(() => new THREE.Color(color), [color]);

  // Update instances every frame
  useFrame(() => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const points = getPoints();

    points.forEach((point, i) => {
      if (i >= MAX_INSTANCES) return;

      // Calculate opacity based on age
      const lifeRatio = point.age / point.maxAge;
      const opacity = (1 - lifeRatio) * maxOpacity;

      // Scale decreases with age (larger for better visibility)
      const scale = 0.04 * (1 - lifeRatio * 0.6);

      // Update transform
      dummyRef.current.position.copy(point.position);
      dummyRef.current.scale.setScalar(scale);
      dummyRef.current.updateMatrix();
      mesh.setMatrixAt(i, dummyRef.current.matrix);

      // Update color with opacity (using alpha in color)
      const fadeColor = trailColor.clone().multiplyScalar(opacity + 0.4);
      mesh.setColorAt(i, fadeColor);
    });

    // Hide unused instances
    for (let i = points.length; i < MAX_INSTANCES; i++) {
      dummyRef.current.scale.setScalar(0);
      dummyRef.current.updateMatrix();
      mesh.setMatrixAt(i, dummyRef.current.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  // Always render the instanced mesh (visibility controlled in useFrame)
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_INSTANCES]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial
        transparent
        opacity={maxOpacity}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
