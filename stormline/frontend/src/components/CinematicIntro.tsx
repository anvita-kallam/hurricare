import { Suspense, useEffect, useRef, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Stars, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useCinematicController, ImpactEvent } from '../hooks/useCinematicController'
import HurricaneSpiral from './HurricaneSpiral'
import ImpactCallout from './ImpactCallout'
import { Hurricane } from '../state/useStore'

// Helper to convert lat/lon to 3D
function latLonToVector3(lat: number, lon: number, radius: number = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

// Earth component
function Earth() {
  const earthTexture = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/land_ocean_ice_cloud_2048.jpg')
  
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={earthTexture} />
    </mesh>
  )
}

// Camera controller for cinematic mode
function CinematicCamera({ 
  track, 
  currentTime, 
  progress 
}: { 
  track: Array<{ lat: number; lon: number; wind: number }>
  currentTime: number
  progress: number
}) {
  const { camera } = useThree()
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const positionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 4))
  
  useEffect(() => {
    if (track.length === 0) return
    
    // Calculate current position along track
    const totalDuration = track.length
    const currentIndex = Math.min(
      Math.floor(progress * totalDuration),
      track.length - 1
    )
    const nextIndex = Math.min(currentIndex + 1, track.length - 1)
    const segmentProgress = (progress * totalDuration) - currentIndex
    
    const currentPoint = track[currentIndex]
    const nextPoint = track[nextIndex]
    
    // Interpolate position
    const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * segmentProgress
    const lon = currentPoint.lon + (nextPoint.lon - currentPoint.lon) * segmentProgress
    
    const stormPosition = latLonToVector3(lat, lon, 1.01)
    targetRef.current.copy(stormPosition)
    
    // Camera follows behind and above the storm
    const offset = new THREE.Vector3(0, 0.3, 0.5).multiplyScalar(2)
    const cameraPosition = stormPosition.clone().add(offset)
    positionRef.current.copy(cameraPosition)
    
    // Look at storm
    camera.position.copy(cameraPosition)
    camera.lookAt(stormPosition)
  }, [track, progress, camera])
  
  useFrame(() => {
    // Smooth camera movement
    camera.position.lerp(positionRef.current, 0.05)
    const lookTarget = targetRef.current.clone()
    camera.lookAt(lookTarget)
  })
  
  return null
}

// Hurricane track visualization
function HurricaneTrack({ track, progress }: { track: Array<{ lat: number; lon: number; wind: number }>, progress: number }) {
  const points = useMemo(() => {
    return track.map(point => latLonToVector3(point.lat, point.lon, 1.01))
  }, [track])
  
  const currentIndex = Math.floor(progress * points.length)
  const visiblePoints = points.slice(0, currentIndex + 1)
  
  if (visiblePoints.length < 2) return null
  
  const positions = new Float32Array(visiblePoints.flatMap(p => [p.x, p.y, p.z]))
  
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={visiblePoints.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ff6b6b" linewidth={2} />
    </line>
  )
}

interface CinematicIntroProps {
  hurricane: Hurricane
  impactEvents: ImpactEvent[]
  onComplete: () => void
}

export default function CinematicIntro({
  hurricane,
  impactEvents,
  onComplete
}: CinematicIntroProps) {
  const durationHours = useMemo(() => {
    // Estimate duration based on track length (roughly 1 point per 6 hours)
    return hurricane.track.length * 6
  }, [hurricane.track])
  
  const { state, start } = useCinematicController(durationHours, onComplete, 10)
  const hasStartedRef = useRef(false)
  
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      start()
    }
  }, [start])
  
  // Calculate current storm position
  const currentStormPosition = useMemo(() => {
    if (hurricane.track.length === 0) return new THREE.Vector3(0, 1, 0)
    
    const currentIndex = Math.min(
      Math.floor(state.progress * hurricane.track.length),
      hurricane.track.length - 1
    )
    const point = hurricane.track[currentIndex]
    return latLonToVector3(point.lat, point.lon, 1.01)
  }, [hurricane.track, state.progress])
  
  // Calculate storm intensity based on wind speed
  const stormIntensity = useMemo(() => {
    if (hurricane.track.length === 0) return 0.5
    const currentIndex = Math.min(
      Math.floor(state.progress * hurricane.track.length),
      hurricane.track.length - 1
    )
    const maxWind = Math.max(...hurricane.track.map(p => p.wind))
    const currentWind = hurricane.track[currentIndex].wind
    return Math.min(currentWind / maxWind, 1)
  }, [hurricane.track, state.progress])
  
  // Filter visible impact events
  const visibleEvents = useMemo(() => {
    return impactEvents.filter(event => {
      const timeDiff = Math.abs(event.time_hours - state.currentTime)
      return timeDiff < 2 // Show events within 2 hours of current time
    })
  }, [impactEvents, state.currentTime])
  
  const fadeOpacity = useMemo(() => {
    if (state.phase === 'fadeIn') return state.progress
    if (state.phase === 'fadeOut') return 1 - state.progress
    return 1
  }, [state.phase, state.progress])
  
  // Debug logging
  useEffect(() => {
    console.log('Cinematic state:', state)
  }, [state])
  
  if (!state.isPlaying && state.phase === 'complete') {
    return null
  }
  
  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{
        opacity: fadeOpacity,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'auto'
      }}
    >
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={0.5} />
          
          <Stars radius={300} depth={50} count={5000} factor={4} />
          
          <Earth />
          
          {(state.phase === 'playing' || state.phase === 'fadeIn') && !state.isPlaying === false && (
            <>
              <CinematicCamera
                track={hurricane.track}
                currentTime={state.currentTime}
                progress={state.progress}
              />
              
              {state.phase === 'playing' && state.isPlaying && (
                <>
                  <HurricaneTrack track={hurricane.track} progress={state.progress} />
                  
              <group position={currentStormPosition}>
                <HurricaneSpiral
                  position={new THREE.Vector3(0, 0, 0)}
                  intensity={stormIntensity}
                  radius={0.15 + stormIntensity * 0.1}
                />
              </group>
                  
                  {visibleEvents.map((event, i) => {
                    const eventPosition = latLonToVector3(
                      event.location.lat,
                      event.location.lon,
                      1.02
                    )
                    const timeDiff = Math.abs(event.time_hours - state.currentTime)
                    const eventOpacity = Math.max(0, 1 - timeDiff / 2) * fadeOpacity
                    
                    return (
                      <ImpactCallout
                        key={i}
                        event={event}
                        position={eventPosition}
                        visible={timeDiff < 2}
                        opacity={eventOpacity}
                      />
                    )
                  })}
                </>
              )}
            </>
          )}
        </Suspense>
      </Canvas>
      
      {/* Time overlay */}
      {state.phase === 'playing' && (
        <div className="absolute top-8 left-8 text-white font-orbitron text-2xl">
          T+{Math.floor(state.currentTime)} {Math.floor(state.currentTime) === 1 ? 'Hour' : 'Hours'}
        </div>
      )}
      
      {/* Transition message */}
      {state.phase === 'fadeOut' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white font-orbitron text-3xl text-center">
            You are now entering the response phase.
          </div>
        </div>
      )}
    </div>
  )
}
