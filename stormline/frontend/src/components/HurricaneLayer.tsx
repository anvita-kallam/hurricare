import { useMemo, useState, useRef } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

// Extended color palette for unique storm colors
const stormColors = [
  '#FF6B6B', // Coral red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Sky blue
  '#FFA07A', // Light salmon
  '#98D8C8', // Mint green
  '#F7DC6F', // Yellow
  '#BB8FCE', // Lavender
  '#85C1E2', // Light blue
  '#F8B739', // Orange
  '#52BE80', // Green
  '#EC7063', // Pink
  '#5DADE2', // Blue
  '#F4D03F', // Gold
  '#AF7AC5', // Purple
  '#76D7C4', // Teal
  '#F39C12', // Dark orange
  '#E74C3C', // Red
  '#3498DB', // Bright blue
  '#2ECC71', // Emerald
  '#9B59B6', // Amethyst
  '#1ABC9C', // Turquoise
  '#E67E22', // Carrot
  '#34495E', // Dark blue-gray
  '#16A085', // Dark turquoise
  '#27AE60', // Dark green
  '#2980B9', // Dark blue
  '#8E44AD', // Dark purple
  '#C0392B', // Dark red
  '#D35400', // Dark orange
  '#7F8C8D', // Gray
  '#F1C40F', // Bright yellow
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#009688', // Teal
  '#CDDC39', // Lime
  '#FF5722', // Deep orange
  '#795548', // Brown
  '#607D8B', // Blue gray
  '#FFC107', // Amber
  '#00E676', // Green accent
  '#FF1744', // Red accent
  '#3D5AFE', // Indigo accent
  '#1DE9B6', // Teal accent
  '#FF9100', // Orange accent
  '#E040FB', // Purple accent
  '#00B0FF', // Light blue accent
  '#64FFDA', // Cyan accent
]

// Function to get a unique color for each storm based on its ID
function getStormColor(hurricaneId: string, index: number): string {
  // Use a simple hash function to consistently assign colors
  let hash = 0
  for (let i = 0; i < hurricaneId.length; i++) {
    hash = hurricaneId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIndex = Math.abs(hash) % stormColors.length
  return stormColors[colorIndex]
}

function HurricanePath({ hurricane, isSelected, index }: { hurricane: any; isSelected: boolean; index: number }) {
  const [hovered, setHovered] = useState(false)
  
  const curve = useMemo(() => {
    const points = hurricane.track.map((point: any) => {
      const phi = (90 - point.lat) * (Math.PI / 180)
      const theta = (point.lon + 180) * (Math.PI / 180)
      
      const x = -Math.sin(phi) * Math.cos(theta)
      const y = Math.cos(phi)
      const z = Math.sin(phi) * Math.sin(theta)
      
      return new THREE.Vector3(x, y, z)
    })
    
    return new THREE.CatmullRomCurve3(points, false, 'centripetal')
  }, [hurricane.track])
  
  const geometry = useMemo(() => {
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.01, 8, false)
    return tubeGeometry
  }, [curve])
  
  // Get unique color for this storm
  const color = getStormColor(hurricane.id, index)
  const lineWidth = isSelected ? 0.015 : 0.008
  
  return (
    <group>
      <mesh
        geometry={geometry}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshBasicMaterial
          color={hovered || isSelected ? '#FFFFFF' : color}
          transparent
          opacity={hovered || isSelected ? 1 : 0.7}
        />
      </mesh>
      
      {/* Animated points along the path */}
      {hurricane.track.map((point: any, index: number) => {
        const phi = (90 - point.lat) * (Math.PI / 180)
        const theta = (point.lon + 180) * (Math.PI / 180)
        
        const x = -Math.sin(phi) * Math.cos(theta)
        const y = Math.cos(phi)
        const z = Math.sin(phi) * Math.sin(theta)
        
        return (
          <AnimatedPoint
            key={index}
            position={[x, y, z]}
            color={color}
            visible={isSelected || hovered}
          />
        )
      })}
      
      {hovered && (
        <HtmlTooltip
          hurricane={hurricane}
          position={curve.getPoint(0.5)}
        />
      )}
    </group>
  )
}

function AnimatedPoint({ position, color, visible }: { position: [number, number, number]; color: string; visible: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (meshRef.current && visible) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3
      meshRef.current.scale.setScalar(scale)
    }
  })
  
  if (!visible) return null
  
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function HtmlTooltip({ hurricane, position }: { hurricane: any; position: THREE.Vector3 }) {
  return (
    <mesh position={position}>
      <Html center>
        <div className="bg-black bg-opacity-80 text-white p-2 rounded text-xs whitespace-nowrap pointer-events-none font-exo">
          <div className="font-bold font-orbitron">{hurricane.name}</div>
          <div>Year: {hurricane.year}</div>
          <div>Category: {hurricane.max_category}</div>
          <div>Affected: {hurricane.estimated_population_affected.toLocaleString()}</div>
          <div>{hurricane.affected_countries.join(', ')}</div>
        </div>
      </Html>
    </mesh>
  )
}

export default function HurricaneLayer() {
  const { hurricanes, selectedHurricane } = useStore()
  
  return (
    <group>
      {hurricanes.map((hurricane, index) => (
        <HurricanePath
          key={hurricane.id}
          hurricane={hurricane}
          isSelected={selectedHurricane?.id === hurricane.id}
          index={index}
        />
      ))}
    </group>
  )
}
