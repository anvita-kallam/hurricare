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
  rotationSpeed = 2.0
}: HurricaneSpiralProps) {
  const groupRef = useRef<THREE.Group>(null)
  const outerSpiralRef = useRef<THREE.Mesh>(null)
  const innerSpiralRef = useRef<THREE.Mesh>(null)
  
  // Create spiral arms using curves with more spacing
  const spiralArms = useMemo(() => {
    const arms: THREE.CatmullRomCurve3[] = []
    const numArms = 4 // More arms for better hurricane appearance
    
    for (let arm = 0; arm < numArms; arm++) {
      const points: THREE.Vector3[] = []
      const armAngle = (arm / numArms) * Math.PI * 2
      
      // More spacing between spiral turns
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        // Wider spacing - fewer rotations but more gap
        const angle = armAngle + t * Math.PI * 3 // Reduced rotations for more gap
        // Start further out and have larger gaps
        const distance = t * radius * (0.3 + intensity * 0.7)
        
        const x = Math.cos(angle) * distance
        const y = 0 // Flat on surface
        const z = Math.sin(angle) * distance
        
        points.push(new THREE.Vector3(x, y, z))
      }
      
      arms.push(new THREE.CatmullRomCurve3(points))
    }
    
    return arms
  }, [radius, intensity])
  
  useFrame(() => {
    if (groupRef.current) {
      // Steady rotation — no pulsing/breathing
      groupRef.current.rotation.y += rotationSpeed * 0.05
    }
  })
  
  const cloudColor = useMemo(() => {
    // More realistic hurricane colors - white/gray clouds
    return new THREE.Color(0.85, 0.85, 0.9)
  }, [])
  
  // Align spiral to be flat on the sphere surface
  // Position is already on the sphere, so we need to rotate the spiral to be tangent to the surface
  const surfaceNormal = useMemo(() => {
    return position.clone().normalize()
  }, [position])
  
  // Calculate rotation matrix to align with surface
  const rotationMatrix = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const normal = surfaceNormal.clone()
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(up, normal)
    return quaternion
  }, [surfaceNormal])
  
  return (
    <group ref={groupRef} position={position} quaternion={rotationMatrix}>
      {/* Outer spiral arms - thinner with more spacing */}
      {spiralArms.map((arm, i) => (
        <mesh key={`outer-${i}`} ref={i === 0 ? outerSpiralRef : undefined}>
          <tubeGeometry args={[arm, 40, 0.01, 8, false]} />
          <meshBasicMaterial
            color={cloudColor}
            transparent
            opacity={0.7 + intensity * 0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      
      {/* Inner spiral arms (tighter) */}
      {spiralArms.map((arm, i) => {
        const innerArm = new THREE.CatmullRomCurve3(
          arm.points.map(p => p.clone().multiplyScalar(0.6))
        )
        return (
          <mesh key={`inner-${i}`} ref={i === 0 ? innerSpiralRef : undefined}>
            <tubeGeometry args={[innerArm, 40, 0.008, 8, false]} />
            <meshBasicMaterial
              color={cloudColor}
              transparent
              opacity={0.6 + intensity * 0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      
      {/* Eye of the storm - clear center */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[radius * 0.2, 16]} />
        <meshBasicMaterial
          color={new THREE.Color(0.9, 0.9, 0.95)}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wind field particles - flat on surface */}
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * Math.PI * 2
        const distance = radius * (0.4 + Math.random() * 0.4)
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        
        return (
          <mesh key={`particle-${i}`} position={[x, 0, z]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial
              color={cloudColor}
              transparent
              opacity={0.3}
            />
          </mesh>
        )
      })}
    </group>
  )
}
