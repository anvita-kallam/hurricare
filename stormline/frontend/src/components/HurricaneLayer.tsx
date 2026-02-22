import { useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

// Saffir-Simpson category colors (muted for dark background)
const categoryColors: Record<number, string> = {
  0: '#6BAED6',  // Tropical depression / storm — muted blue
  1: '#FFE066',  // Cat 1 — warm yellow
  2: '#FFAB40',  // Cat 2 — amber
  3: '#FF6D00',  // Cat 3 — deep orange
  4: '#FF3D00',  // Cat 4 — red-orange
  5: '#D50000',  // Cat 5 — dark red
}

function getCategoryColor(category: number): string {
  return categoryColors[Math.min(Math.max(category, 0), 5)] || categoryColors[0]
}

// Hurricane paths at ~1.06 radius (above country meshes at ~1.035)
const PATH_ELEVATION = 1.06

function HurricanePath({ hurricane, isSelected, onHurricaneClick }: { hurricane: any; isSelected: boolean; onHurricaneClick?: (hurricaneId: string) => void }) {
  const [hovered, setHovered] = useState(false)

  const curve = useMemo(() => {
    const points = hurricane.track.map((point: any) => {
      const phi = (90 - point.lat) * (Math.PI / 180)
      const theta = (point.lon + 180) * (Math.PI / 180)
      return new THREE.Vector3(
        -Math.sin(phi) * Math.cos(theta) * PATH_ELEVATION,
        Math.cos(phi) * PATH_ELEVATION,
        Math.sin(phi) * Math.sin(theta) * PATH_ELEVATION
      )
    })
    return new THREE.CatmullRomCurve3(points, false, 'centripetal')
  }, [hurricane.track])

  const geometry = useMemo(() => {
    const radius = isSelected ? 0.008 : 0.004
    return new THREE.TubeGeometry(curve, 64, radius, 8, false)
  }, [curve, isSelected])

  const baseColor = getCategoryColor(hurricane.max_category ?? 0)

  // Dim unselected hurricanes but keep color
  const color = useMemo(() => {
    return baseColor
  }, [baseColor])

  return (
    <group>
      {/* White outer tube for selected hurricanes */}
      {isSelected && (
        <mesh geometry={geometry} renderOrder={14}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.4}
            depthTest={true}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Colored main path — renderOrder 15 (above countries at 10-12) */}
      <mesh
        geometry={geometry}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onHurricaneClick?.(hurricane.id)}
        renderOrder={15}
      >
        <meshBasicMaterial
          color={hovered ? '#FFFFFF' : color}
          transparent
          opacity={hovered || isSelected ? 1 : 0.5}
          depthTest={true}
          depthWrite={false}
        />
      </mesh>

      {/* Static track points — no pulsing/breathing animation */}
      {(isSelected || hovered) && hurricane.track.map((point: any, index: number) => {
        const phi = (90 - point.lat) * (Math.PI / 180)
        const theta = (point.lon + 180) * (Math.PI / 180)
        return (
          <mesh
            key={index}
            position={[
              -Math.sin(phi) * Math.cos(theta) * PATH_ELEVATION,
              Math.cos(phi) * PATH_ELEVATION,
              Math.sin(phi) * Math.sin(theta) * PATH_ELEVATION
            ]}
            renderOrder={16}
          >
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )
      })}

      {/* Tooltip — only renders when hovered, returns null otherwise (no empty DOM nodes) */}
      {hovered && (
        <HtmlTooltip hurricane={hurricane} position={curve.getPoint(0.5)} />
      )}
    </group>
  )
}

function HtmlTooltip({ hurricane, position }: { hurricane: any; position: THREE.Vector3 }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={1}
      style={{ pointerEvents: 'none' }}
      occlude="blending"
    >
      <div className="bg-black/90 text-white p-2 rounded text-xs whitespace-nowrap pointer-events-none font-rajdhani border border-white/10" style={{ userSelect: 'none' }}>
        <div className="font-bold font-rajdhani">{hurricane.name}</div>
        <div className="font-mono text-white/70">Year: {hurricane.year}</div>
        <div className="font-mono text-white/70">Category: {hurricane.max_category}</div>
        <div className="font-mono text-white/70">Affected: {hurricane.estimated_population_affected.toLocaleString()}</div>
        <div className="font-mono text-white/70">{hurricane.affected_countries.join(', ')}</div>
      </div>
    </Html>
  )
}

interface HurricaneLayerProps {
  onHurricaneClick?: (hurricaneId: string) => void
}

export default function HurricaneLayer({ onHurricaneClick }: HurricaneLayerProps) {
  const { hurricanes, selectedHurricane } = useStore()

  return (
    <group>
      {hurricanes.map((hurricane) => (
        <HurricanePath
          key={hurricane.id}
          hurricane={hurricane}
          isSelected={selectedHurricane?.id === hurricane.id}
          onHurricaneClick={onHurricaneClick}
        />
      ))}
    </group>
  )
}
