import { useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { ensureArray } from '../utils/apiHelpers'

// Extended color palette for unique storm colors
const stormColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
  '#EC7063', '#5DADE2', '#F4D03F', '#AF7AC5', '#76D7C4',
  '#F39C12', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
  '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#27AE60',
  '#2980B9', '#8E44AD', '#C0392B', '#D35400', '#7F8C8D',
  '#F1C40F', '#E91E63', '#00BCD4', '#FF9800', '#9C27B0',
  '#3F51B5', '#009688', '#CDDC39', '#FF5722', '#795548',
  '#607D8B', '#FFC107', '#00E676', '#FF1744', '#3D5AFE',
  '#1DE9B6', '#FF9100', '#E040FB', '#00B0FF', '#64FFDA',
]

function getStormColor(hurricaneId: string): string {
  let hash = 0
  for (let i = 0; i < hurricaneId.length; i++) {
    hash = hurricaneId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIndex = Math.abs(hash) % stormColors.length
  return stormColors[colorIndex]
}

// Hurricane paths at ~1.06 radius (above country meshes at ~1.035)
const PATH_ELEVATION = 1.06

function HurricanePath({ hurricane, isSelected, onHurricaneClick }: { hurricane: any; isSelected: boolean; onHurricaneClick?: (hurricaneId: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const track = ensureArray<{ lat: number; lon: number; wind?: number }>(hurricane?.track)

  const curve = useMemo(() => {
    if (track.length === 0) return null
    const points = track.map((point) => {
      const phi = (90 - point.lat) * (Math.PI / 180)
      const theta = (point.lon + 180) * (Math.PI / 180)
      return new THREE.Vector3(
        -Math.sin(phi) * Math.cos(theta) * PATH_ELEVATION,
        Math.cos(phi) * PATH_ELEVATION,
        Math.sin(phi) * Math.sin(theta) * PATH_ELEVATION
      )
    })
    return new THREE.CatmullRomCurve3(points, false, 'centripetal')
  }, [track])

  const geometry = useMemo(() => {
    if (!curve) return null
    const radius = isSelected ? 0.008 : 0.004
    return new THREE.TubeGeometry(curve, 64, radius, 8, false)
  }, [curve, isSelected])

  const baseColor = getStormColor(hurricane.id)

  // Convert to greyscale for unselected hurricanes
  const color = useMemo(() => {
    if (isSelected) return baseColor
    const hex = baseColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    return `#${grey.toString(16).padStart(2, '0')}${grey.toString(16).padStart(2, '0')}${grey.toString(16).padStart(2, '0')}`
  }, [baseColor, isSelected])

  if (!geometry || !curve) return null

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
          opacity={hovered || isSelected ? 1 : 0.6}
          depthTest={true}
          depthWrite={false}
        />
      </mesh>

      {/* Static track points — no pulsing/breathing animation */}
      {(isSelected || hovered) && track.map((point, index) => {
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
  const visibleHurricanes = ensureArray<typeof hurricanes[number]>(hurricanes)
    .filter((hurricane) => ensureArray(hurricane.track).length > 0)

  return (
    <group>
      {visibleHurricanes.map((hurricane) => (
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
