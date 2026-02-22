import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LAYERS = [
  { r: 1.01, color: '#7733ff', opacity: 0.22 },
  { r: 1.03, color: '#6622ee', opacity: 0.17 },
  { r: 1.06, color: '#5511cc', opacity: 0.12 },
  { r: 1.10, color: '#4400aa', opacity: 0.08 },
  { r: 1.17, color: '#330088', opacity: 0.05 },
  { r: 1.26, color: '#220066', opacity: 0.03 },
  { r: 1.40, color: '#160044', opacity: 0.016 },
]

export default function GlobeShell() {
  const matRefs = useRef<THREE.Material[]>([])

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.elapsedTime * 0.9) * 0.04
    matRefs.current.forEach((mat: any, i) => {
      if (mat) mat.opacity = LAYERS[i].opacity * (1 + pulse)
    })
  })

  return (
    <>
      <mesh renderOrder={0}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {LAYERS.map(({ r, color, opacity }, i) => (
        <mesh key={r} renderOrder={i + 5}>
          <sphereGeometry args={[r, 48, 48]} />
          <meshBasicMaterial
            ref={el => {if (el) matRefs.current[i] = el}}
            color={color}
            transparent
            opacity={opacity}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}
