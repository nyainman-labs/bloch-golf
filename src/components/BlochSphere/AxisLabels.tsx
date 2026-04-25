/**
 * Axis Labels Component
 *
 * Labels for the Bloch sphere axes showing quantum state notation.
 */

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface AxisLabelsProps {
  sphereRadius: number;
}

interface LabelData {
  position: THREE.Vector3;
  text: string;
  color: string;
}

export function AxisLabels({ sphereRadius }: AxisLabelsProps) {
  const labelOffset = sphereRadius * 1.25;

  const labels = useMemo<LabelData[]>(
    () => [
      // Z-axis (up/down in Three.js)
      {
        position: new THREE.Vector3(0, labelOffset, 0),
        text: '|0⟩',
        color: '#00d4ff',
      },
      {
        position: new THREE.Vector3(0, -labelOffset, 0),
        text: '|1⟩',
        color: '#a855f7',
      },
      // X-axis (in Bloch sphere convention, mapped to Three.js)
      {
        position: new THREE.Vector3(labelOffset, 0, 0),
        text: '|+⟩',
        color: '#10b981',
      },
      {
        position: new THREE.Vector3(-labelOffset, 0, 0),
        text: '|−⟩',
        color: '#f59e0b',
      },
      // Y-axis (in Bloch sphere convention, mapped to Three.js)
      {
        position: new THREE.Vector3(0, 0, labelOffset),
        text: '|i−⟩',
        color: '#ec4899',
      },
      {
        position: new THREE.Vector3(0, 0, -labelOffset),
        text: '|i+⟩',
        color: '#6366f1',
      },
    ],
    [labelOffset]
  );

  return (
    <group>
      {labels.map((label, index) => (
        <Html
          key={index}
          position={label.position}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(10, 10, 15, 0.6)',
              backdropFilter: 'blur(8px)',
              color: label.color,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              border: `1px solid ${label.color}30`,
              boxShadow: `0 0 12px ${label.color}20`,
              opacity: 0.85,
            }}
          >
            {label.text}
          </div>
        </Html>
      ))}
    </group>
  );
}
