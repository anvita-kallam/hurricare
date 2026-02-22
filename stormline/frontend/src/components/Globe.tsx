import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import HurricaneLayer from './HurricaneLayer'
import OverlayLayer from './OverlayLayer'
import { useStore } from '../state/useStore'

function Earth() {
  const earthTexture = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/land_ocean_ice_cloud_2048.jpg')
  
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={earthTexture} />
    </mesh>
  )
}

// Helper function to convert lat/lon to 3D coordinates on a sphere
function latLonToVector3(lat: number, lon: number, radius: number = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  
  return new THREE.Vector3(x, y, z)
}

// Component to handle camera animation when hurricane is selected
function CameraController() {
  const { camera } = useThree()
  const { selectedHurricane, autoSpin } = useStore()
  const controlsRef = useRef<any>(null)
  const targetPosition = useRef<THREE.Vector3 | null>(null)
  const targetDistance = useRef<number>(3)
  const isAnimating = useRef(false)
  
  // Calculate center of hurricane track
  useEffect(() => {
    if (selectedHurricane && selectedHurricane.track && selectedHurricane.track.length > 0) {
      // Calculate average lat/lon of all track points
      const avgLat = selectedHurricane.track.reduce((sum, point) => sum + point.lat, 0) / selectedHurricane.track.length
      const avgLon = selectedHurricane.track.reduce((sum, point) => sum + point.lon, 0) / selectedHurricane.track.length
      
      // Convert to 3D position on sphere
      const spherePosition = latLonToVector3(avgLat, avgLon, 1)
      
      // Calculate camera position: move closer and look at the point
      // Position camera at 1.8 units distance (zoomed in)
      const cameraOffset = spherePosition.clone().multiplyScalar(1.8)
      targetPosition.current = cameraOffset
      targetDistance.current = 1.8
      isAnimating.current = true
    } else {
      // Reset to default view
      targetPosition.current = new THREE.Vector3(0, 0, 3)
      targetDistance.current = 3
      isAnimating.current = true
    }
  }, [selectedHurricane])
  
  // Animate camera smoothly
  useFrame(() => {
    if (isAnimating.current && targetPosition.current && controlsRef.current) {
      const currentPos = camera.position.clone()
      const distance = currentPos.distanceTo(targetPosition.current)
      
      if (distance > 0.01) {
        // Smooth interpolation
        camera.position.lerp(targetPosition.current, 0.05)
        
        // Update controls target to look at the sphere center
        if (selectedHurricane && selectedHurricane.track && selectedHurricane.track.length > 0) {
          const avgLat = selectedHurricane.track.reduce((sum, point) => sum + point.lat, 0) / selectedHurricane.track.length
          const avgLon = selectedHurricane.track.reduce((sum, point) => sum + point.lon, 0) / selectedHurricane.track.length
          const lookAt = latLonToVector3(avgLat, avgLon, 1)
          controlsRef.current.target.lerp(lookAt, 0.05)
        } else {
          controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.05)
        }
        
        controlsRef.current.update()
      } else {
        isAnimating.current = false
      }
    }
  })
  
  return (
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
  )
}

export default function Globe() {
  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <pointLight position={[-5, -5, -5]} intensity={0.5} color="#888888" />
          <Earth />
          <Stars radius={500} depth={100} count={30000} factor={12} fade speed={0.5} />
          <HurricaneLayer />
          <OverlayLayer />
          <CameraController />
        </Suspense>
      </Canvas>
    </div>
  )
}
