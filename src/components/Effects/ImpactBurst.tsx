/**
 * Impact Burst Effect
 *
 * Pixel hit-mark: a spray of voxels that bursts off the ball the instant the
 * club connects, thrown mostly in the direction the ball is about to travel.
 *
 * Driven imperatively via a ref, because the trigger comes from inside
 * useFrame and shouldn't cost a React render.
 */

import { useRef, useMemo, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 14;
const HOT = new THREE.Color('#ffffff');
const COOL = new THREE.Color('#4ea355');

interface Chip {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface ImpactBurstHandle {
  /**
   * Spawn a burst.
   *
   * @param anchor - World position of the strike
   * @param up - Sphere surface normal at the strike
   * @param tangent - Direction the ball is about to travel
   * @param strength - 0-1, scales how far the chips fly
   */
  burst: (
    anchor: THREE.Vector3,
    up: THREE.Vector3,
    tangent: THREE.Vector3,
    strength: number
  ) => void;
}

interface ImpactBurstProps {
  /** Size of one voxel chip */
  size: number;
}

export const ImpactBurst = forwardRef<ImpactBurstHandle, ImpactBurstProps>(
  function ImpactBurst({ size }, ref) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const chipsRef = useRef<Chip[]>([]);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const color = useMemo(() => new THREE.Color(), []);

    // Instance matrices default to identity, which would show a stack of
    // full-size cubes at the origin until the first burst. Collapse them.
    useLayoutEffect(() => {
      const mesh = meshRef.current;
      if (!mesh) return;

      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }, [dummy]);

    useImperativeHandle(
      ref,
      () => ({
        burst(anchor, up, tangent, strength) {
          const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
          const spread = 0.7 + strength * 0.7;

          chipsRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
            // Bias the spray forward along the travel direction and up off the
            // surface, with a bit of scatter to either side.
            const velocity = new THREE.Vector3()
              .addScaledVector(tangent, 0.5 + Math.random() * 1.0)
              .addScaledVector(up, 0.2 + Math.random() * 0.8)
              .addScaledVector(side, (Math.random() - 0.5) * 1.2)
              .multiplyScalar(spread);

            return {
              position: anchor.clone().addScaledVector(up, size * 0.5),
              velocity,
              life: 0,
              maxLife: 0.3 + Math.random() * 0.15,
            };
          });
        },
      }),
      [size]
    );

    useFrame((_, delta) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const chips = chipsRef.current;
      if (chips.length === 0) return;

      let alive = false;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const chip = chips[i];
        chip.life += delta;

        if (chip.life >= chip.maxLife) {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }

        alive = true;

        // Drag, so the chips decelerate the way debris does
        chip.velocity.multiplyScalar(0.92);
        chip.position.addScaledVector(chip.velocity, delta);

        const lifeRatio = chip.life / chip.maxLife;

        dummy.position.copy(chip.position);
        dummy.scale.setScalar(size * (1 - lifeRatio));
        dummy.rotation.set(chip.life * 6, chip.life * 4, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        color.copy(HOT).lerp(COOL, lifeRatio);
        mesh.setColorAt(i, color);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      if (!alive) {
        chipsRef.current = [];
      }
    });

    return (
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    );
  }
);
