/**
 * Golf Club Component
 *
 * A voxel golf club that appears at the ball, winds up, and swings through it.
 * The club is aimed so its face points along the direction the ball is about
 * to travel, which makes the gate's rotation read as a struck shot.
 *
 * The voxels never move relative to each other, so their instance matrices are
 * written once; only the two enclosing groups are transformed each frame.
 * Like BallTrail, the pose is pulled through a getter so nothing here triggers
 * a React re-render.
 */

import { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SwingFrame } from '../../hooks/useBallAnimation';
import {
  CLUB_VOXELS,
  CLUB_PALETTE,
  CLUB_VOXEL_SCALE,
  CLUB_PIVOT_Y,
} from './clubVoxels';

interface GolfClubProps {
  /** Returns the current club pose, or null when the club is off screen */
  getSwing: () => SwingFrame | null;
  /** Ball radius, used to scale the club to the scene */
  ballRadius: number;
}

export function GolfClub({ getSwing, ballRadius }: GolfClubProps) {
  const rootRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const voxelSize = ballRadius * CLUB_VOXEL_SCALE;

  // The voxel grid puts the face's leading plane half a voxel in front of the
  // z = -1 row. Pull the whole club back so that plane lands on the back of the
  // ball at impact rather than inside it.
  const faceOffset = -ballRadius + 0.5 * voxelSize;
  const pivotHeight = CLUB_PIVOT_Y * voxelSize;

  // Scratch objects, reused every frame
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  // The club's shape is fixed, so write the instance transforms and colors once.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    CLUB_VOXELS.forEach(([x, y, z, paletteIndex], i) => {
      dummy.position.set(x * voxelSize, y * voxelSize, z * voxelSize);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.set(CLUB_PALETTE[paletteIndex]);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [voxelSize]);

  useFrame(() => {
    const root = rootRef.current;
    const pivot = pivotRef.current;
    if (!root || !pivot) return;

    const swing = getSwing();

    if (!swing) {
      root.visible = false;
      return;
    }

    root.visible = true;
    root.position.copy(swing.anchor);

    // Local frame: +Y along the surface normal, +Z along the ball's travel
    // direction (so the club face looks where the ball is going), +X to the
    // right — which is the axis the swing rotates about.
    right.crossVectors(swing.up, swing.tangent).normalize();
    basis.makeBasis(right, swing.up, swing.tangent);
    root.quaternion.setFromRotationMatrix(basis);
    root.scale.setScalar(swing.scale);

    // The pivot sits above the ball at the butt of the shaft, so the head hangs
    // below it and sweeps *opposite* to the shaft's lean: rotating the pivot by
    // +X tips the grip toward +Z but carries the head toward -Z. Negate so a
    // positive head angle really does move the head the way the ball will go —
    // getting this backwards had the club winding up on the ball's outbound
    // side and following through behind it.
    pivot.rotation.x = -swing.headAngle;
  });

  return (
    <group ref={rootRef} visible={false}>
      {/* Pivot at the top of the grip, so the club swings around the hands */}
      <group ref={pivotRef} position={[0, pivotHeight, faceOffset]}>
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, CLUB_VOXELS.length]}
          position={[0, -pivotHeight, 0]}
          frustumCulled={false}
          castShadow
        >
          <boxGeometry args={[voxelSize, voxelSize, voxelSize]} />
          <meshStandardMaterial roughness={0.45} metalness={0.15} flatShading />
        </instancedMesh>
      </group>
    </group>
  );
}
