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
  
  // Create spiral arms using curves
  const spiralArms = useMemo(() => {
    const arms: THREE.CatmullRomCurve3[] = []
    const numArms = 3
    
    for (let arm = 0; arm < numArms; arm++) {
      const points: THREE.Vector3[] = []
      const armAngle = (arm / numArms) * Math.PI * 2
      
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const angle = armAngle + t * Math.PI * 4 // Multiple rotations
        const distance = t * radius * (0.3 + intensity * 0.7)
        const height = Math.sin(t * Math.PI) * 0.05
        
        const x = Math.cos(angle) * distance
        const y = height
        const z = Math.sin(angle) * distance
        
        points.push(new THREE.Vector3(x, y, z))
      }
      
      arms.push(new THREE.CatmullRomCurve3(points))
    }
    
    return arms
  }, [radius, intensity])
  
  // Create tube geometry for spiral arms
  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(spiralArms[0], 20, 0.02, 8, false)
  }, [spiralArms])
  
  useFrame((state) => {
    if (groupRef.current) {
      // Rotate the entire hurricane
      groupRef.current.rotation.y += rotationSpeed * 0.02
    }
    
    if (outerSpiralRef.current && innerSpiralRef.current) {
      // Pulsing effect
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      outerSpiralRef.current.scale.setScalar(pulse)
      innerSpiralRef.current.scale.setScalar(pulse * 0.8)
    }
  })
  
  const cloudColor = useMemo(() => {
    // More realistic hurricane colors - white/gray clouds
    return new THREE.Color(0.85, 0.85, 0.9)
  }, [])
  
  return (
    <group ref={groupRef} position={position}>
      {/* Outer spiral arms */}
      {spiralArms.map((arm, i) => (
        <mesh key={`outer-${i}`} ref={i === 0 ? outerSpiralRef : undefined}>
          <tubeGeometry args={[arm, 20, 0.03, 8, false]} />
          <meshBasicMaterial
            color={cloudColor}
            transparent
            opacity={0.6 + intensity * 0.3}
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
            <tubeGeometry args={[innerArm, 20, 0.02, 8, false]} />
            <meshBasicMaterial
              color={cloudColor}
              transparent
              opacity={0.5 + intensity * 0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      
      {/* Eye of the storm - clear center */}
      <mesh position={[0, 0.01, 0]}>
        <circleGeometry args={[radius * 0.2, 16]} />
        <meshBasicMaterial
          color={new THREE.Color(0.95, 0.95, 1.0)}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wind field particles */}
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * Math.PI * 2
        const distance = radius * (0.4 + Math.random() * 0.4)
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        
        return (
          <mesh key={`particle-${i}`} position={[x, 0.02, z]}>
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
