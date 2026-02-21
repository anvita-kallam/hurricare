import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface HurricaneSpiralProps {
  position: THREE.Vector3
  intensity: number // 0 to 1
  radius: number // base radius
  rotationSpeed?: number
}

export default function HurricaneSpiral({
  position,
  intensity,
  radius,
  rotationSpeed = 0.5
}: HurricaneSpiralProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Create spiral geometry
  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(0.01, radius * (0.3 + intensity * 0.7), 32)
    return geo
  }, [radius, intensity])
  
  // Create cloud-like material
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.7, 0.7, 0.8),
      transparent: true,
      opacity: 0.4 + intensity * 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  }, [intensity])
  
  useFrame((state) => {
    if (groupRef.current) {
      // Rotate the spiral
      groupRef.current.rotation.z += rotationSpeed * 0.01
    }
    
    if (meshRef.current) {
      // Pulsing effect based on intensity
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      meshRef.current.scale.setScalar(pulse)
    }
  })
  
  // Create multiple spiral layers for depth
  const layers = 3
  
  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: layers }).map((_, i) => {
        const layerRadius = radius * (0.5 + (i / layers) * 0.5)
        const layerIntensity = intensity * (1 - i * 0.2)
        
        return (
          <mesh
            key={i}
            ref={i === 0 ? meshRef : undefined}
            geometry={geometry}
            material={material}
            rotation={[Math.PI / 2, 0, (i * Math.PI) / layers]}
            scale={[layerRadius / radius, layerRadius / radius, 1]}
            position={[0, i * 0.01, 0]}
          />
        )
      })}
      
      {/* Eye of the storm */}
      <mesh position={[0, 0.02, 0]}>
        <circleGeometry args={[radius * 0.15, 16]} />
        <meshBasicMaterial
          color={new THREE.Color(0.9, 0.9, 1.0)}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
