import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ParticleLayerProps {
  count: number
  radiusMin: number
  radiusMax: number
  speed: number
  size: number
  opacity: number
  delay: number
  color: string
}

function ParticleLayer({ count, radiusMin, radiusMax, speed, size, opacity, delay, color }: ParticleLayerProps) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = radius * Math.cos(phi)
      arr[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [count, radiusMin, radiusMax])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * speed + delay
    ref.current.rotation.x = Math.sin(t * 0.15 + delay) * 0.08
    ref.current.rotation.z = Math.sin(t * 0.12 + delay) * 0.06
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={new THREE.Color(color)}
        size={size}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

export default function ParticlesField() {
  return (
    <group>
      <ParticleLayer count={3000} radiusMin={1.5} radiusMax={3.5} speed={0.04} size={0.01} opacity={0.7} delay={0} color="#ffffff" />
      <ParticleLayer count={2500} radiusMin={3.0} radiusMax={5.5} speed={0.03} size={0.008} opacity={0.6} delay={Math.PI * 0.25} color="#ffffff" />
      <ParticleLayer count={2000} radiusMin={4.5} radiusMax={7.0} speed={0.025} size={0.006} opacity={0.5} delay={Math.PI * 0.5} color="#ffffff" />
      <ParticleLayer count={1500} radiusMin={6.0} radiusMax={9.0} speed={0.02} size={0.005} opacity={0.4} delay={Math.PI * 0.75} color="#ffffff" />
    </group>
  )
}
