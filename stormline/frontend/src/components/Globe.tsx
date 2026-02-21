import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Suspense } from 'react'
import HurricaneLayer from './HurricaneLayer'
import { useStore } from '../state/useStore'
import { useRef } from 'react'

function Earth() {
  const earthTexture = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/land_ocean_ice_cloud_2048.jpg')
  
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={earthTexture} />
    </mesh>
  )
}

export default function Globe() {
  const { autoSpin } = useStore()
  const controlsRef = useRef<any>(null)
  
  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <pointLight position={[-5, -5, -5]} intensity={0.5} color="#00bcd4" />
          <Earth />
          <Stars radius={500} depth={100} count={30000} factor={8} fade speed={0.5} />
          <HurricaneLayer />
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1.5}
            maxDistance={5}
            autoRotate={autoSpin}
            autoRotateSpeed={0.5}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
