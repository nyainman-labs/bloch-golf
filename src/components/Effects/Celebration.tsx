/**
 * Celebration Effect Component
 *
 * Particle explosion effect when the ball goes in the hole.
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CelebrationProps {
  position: THREE.Vector3;
  isActive: boolean;
  onComplete?: () => void;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  life: number;
  maxLife: number;
}

const PARTICLE_COUNT = 50;
const COLORS = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];

export function Celebration({ position, isActive, onComplete }: CelebrationProps) {
  const particlesRef = useRef<Particle[]>([]);
  const meshRefs = useRef<THREE.InstancedMesh | null>(null);
  const activeRef = useRef(false);
  const dummyRef = useRef(new THREE.Object3D());

  // Initialize particles when activated
  useEffect(() => {
    if (isActive && !activeRef.current) {
      activeRef.current = true;
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 0.8 + Math.random() * 1.2;

        return {
          position: position.clone(),
          velocity: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.abs(Math.cos(phi)) * speed * 1.5, // Bias upward
            Math.sin(phi) * Math.sin(theta) * speed
          ),
          color: new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]),
          scale: 0.03 + Math.random() * 0.04,
          life: 0,
          maxLife: 1.5 + Math.random() * 0.5,
        };
      });
    } else if (!isActive) {
      activeRef.current = false;
      particlesRef.current = [];
    }
  }, [isActive, position]);

  // Update particles
  useFrame((_, delta) => {
    if (!meshRefs.current || particlesRef.current.length === 0) return;

    let allDead = true;

    particlesRef.current.forEach((particle, i) => {
      particle.life += delta;

      if (particle.life < particle.maxLife) {
        allDead = false;

        // Apply gravity
        particle.velocity.y -= delta * 2;

        // Update position
        particle.position.add(particle.velocity.clone().multiplyScalar(delta));

        // Calculate fade and scale based on life
        const lifeRatio = particle.life / particle.maxLife;
        const fadeScale = 1 - lifeRatio;
        const currentScale = particle.scale * fadeScale;

        // Update instance matrix
        dummyRef.current.position.copy(particle.position);
        dummyRef.current.scale.setScalar(currentScale);
        dummyRef.current.updateMatrix();
        meshRefs.current!.setMatrixAt(i, dummyRef.current.matrix);

        // Update color with fade
        const fadeColor = particle.color.clone();
        fadeColor.multiplyScalar(fadeScale);
        meshRefs.current!.setColorAt(i, fadeColor);
      } else {
        // Hide dead particles
        dummyRef.current.scale.setScalar(0);
        dummyRef.current.updateMatrix();
        meshRefs.current!.setMatrixAt(i, dummyRef.current.matrix);
      }
    });

    meshRefs.current.instanceMatrix.needsUpdate = true;
    if (meshRefs.current.instanceColor) {
      meshRefs.current.instanceColor.needsUpdate = true;
    }

    // Callback when animation complete
    if (allDead && activeRef.current && onComplete) {
      activeRef.current = false;
      onComplete();
    }
  });

  if (!isActive && particlesRef.current.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRefs}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={0.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
