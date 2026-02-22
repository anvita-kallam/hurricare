import { useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

// Extended color palette for unique storm colors (monochrome grey shades)
const stormColors = [
  '#b3b3b3', '#999999', '#8c8c8c', '#808080', '#737373',
  '#666666', '#a6a6a6', '#595959', '#949494', '#7a7a7a',
  '#9e9e9e', '#6b6b6b', '#878787', '#616161', '#8f8f8f',
  '#707070', '#ababab', '#858585', '#787878', '#5c5c5c',
  '#969696', '#8a8a8a', '#686868', '#a0a0a0', '#757575',
  '#919191', '#5f5f5f', '#828282', '#6d6d6d', '#7d7d7d',
  '#9c9c9c', '#636363', '#a3a3a3', '#565656', '#949494',
  '#737373', '#878787', '#adadad', '#6b6b6b', '#8c8c8c',
  '#7a7a7a', '#9e9e9e', '#616161', '#a8a8a8', '#707070',
  '#919191', '#808080', '#5c5c5c', '#999999', '#757575',
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
