import { useMemo, useState, useRef } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

const categoryColors: Record<number, string> = {
  1: '#90EE90', // Light green
  2: '#FFD700', // Gold
  3: '#FF8C00', // Dark orange
  4: '#FF4500', // Red orange
  5: '#8B0000', // Dark red
}

function HurricanePath({ hurricane, isSelected }: { hurricane: any; isSelected: boolean }) {
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
  
  const color = categoryColors[hurricane.max_category] || '#FFFFFF'
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
        <div className="bg-black bg-opacity-80 text-white p-2 rounded text-xs whitespace-nowrap pointer-events-none">
          <div className="font-bold">{hurricane.name}</div>
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
      {hurricanes.map((hurricane) => (
        <HurricanePath
          key={hurricane.id}
          hurricane={hurricane}
          isSelected={selectedHurricane?.id === hurricane.id}
        />
      ))}
    </group>
  )
}
