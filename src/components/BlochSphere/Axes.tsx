/**
 * Axes Component
 *
 * Faint x/y/z guide lines through the Bloch sphere to make orientation
 * easier to read. Colors match the pole labels in AxisLabels:
 * - Three.js Y (vertical) = Bloch Z: |0⟩ / |1⟩
 * - Three.js X            = Bloch X: |+⟩ / |−⟩
 * - Three.js Z            = Bloch Y: |i−⟩ / |i+⟩
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';

interface AxesProps {
  sphereRadius: number;
}

export function Axes({ sphereRadius }: AxesProps) {
  // Extend just past the surface toward the labels (which sit at radius * 1.25).
  const end = sphereRadius * 1.15;

  const axes = useMemo(
    () => [
      { points: [[-end, 0, 0] as const, [end, 0, 0] as const], color: '#10b981' }, // X: |+⟩/|−⟩
      { points: [[0, -end, 0] as const, [0, end, 0] as const], color: '#00d4ff' }, // Y: |0⟩/|1⟩
      { points: [[0, 0, -end] as const, [0, 0, end] as const], color: '#ec4899' }, // Z: |i−⟩/|i+⟩
    ],
    [end]
  );

  return (
    <group>
      {axes.map((axis, index) => (
        <Line
          key={index}
          points={axis.points}
          color={axis.color}
          lineWidth={1.5}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      ))}
    </group>
  );
}
