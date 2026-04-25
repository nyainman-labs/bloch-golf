/**
 * Grass Sphere Component
 *
 * A semi-transparent Bloch sphere with grass-like texture.
 * The sphere is transparent enough to see through to the other side.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

interface GrassSphereProps {
  radius: number;
  opacity?: number;
}

/**
 * Generate a grass-like normal map texture
 */
function createGrassNormalMap(size: number = 512): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Create grass blade-like patterns
      const frequency1 = 0.05;
      const frequency2 = 0.1;

      // Multiple layers of noise for grass texture
      const noise1 = Math.sin(x * frequency1 + Math.random() * 0.5) * Math.cos(y * frequency1);
      const noise2 = Math.sin(x * frequency2 + y * 0.1) * 0.5;
      const noise3 = (Math.random() - 0.5) * 0.3;

      // Directional grass blades (pointing roughly upward with variation)
      const bladeAngle = (noise1 + noise2) * 0.3;
      const nx = Math.sin(bladeAngle) * 0.2 + noise3 * 0.1;
      const ny = 0.1 + noise3 * 0.1;
      let nz = 1;

      // Normalize
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normalizedX = nx / len;
      const normalizedY = ny / len;
      const normalizedZ = nz / len;

      // Convert to RGB (normal map format: [-1,1] -> [0,255])
      data[i] = Math.floor((normalizedX * 0.5 + 0.5) * 255);
      data[i + 1] = Math.floor((normalizedY * 0.5 + 0.5) * 255);
      data[i + 2] = Math.floor((normalizedZ * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);

  return texture;
}

/**
 * Generate a roughness map with grass-like variation
 */
function createGrassRoughnessMap(size: number = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Variable roughness for grass texture
      const baseRoughness = 0.7;
      const variation = (Math.random() - 0.5) * 0.3;
      const roughness = Math.max(0.4, Math.min(1, baseRoughness + variation));

      const value = Math.floor(roughness * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
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

export function GrassSphere({ radius, opacity = 0.45 }: GrassSphereProps) {
  // Create textures
  const normalMap = useMemo(() => createGrassNormalMap(512), []);
  const roughnessMap = useMemo(() => createGrassRoughnessMap(256), []);

  // Grass color variations - slightly teal-tinted to match quantum theme
  const grassColorDark = useMemo(() => new THREE.Color('#1a4a3a'), []);
  const grassColorLight = useMemo(() => new THREE.Color('#2d7a5a'), []);

  return (
    <group>
      {/* Main grass sphere - semi-transparent */}
      <mesh>
        <sphereGeometry args={[radius, 128, 128]} />
        <meshStandardMaterial
          color={grassColorLight}
          roughness={0.75}
          metalness={0.0}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.3, 0.3)}
          roughnessMap={roughnessMap}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner guide sphere for depth perception */}
      <mesh>
        <sphereGeometry args={[radius * 0.98, 64, 64]} />
        <meshBasicMaterial
          color={grassColorDark}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Wireframe grid for spatial reference - cyan tinted */}
      <mesh>
        <sphereGeometry args={[radius * 0.995, 24, 24]} />
        <meshBasicMaterial
          color="#00d4ff"
          wireframe
          transparent
          opacity={0.06}
        />
      </mesh>
    </group>
  );
}
