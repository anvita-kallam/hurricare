import { Suspense, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCinematicController, ImpactEvent } from '../hooks/useCinematicController'
import HurricaneSpiral from './HurricaneSpiral'
import ImpactCallout from './ImpactCallout'
import CinematicGlobe from './CinematicGlobe'
import { Hurricane } from '../state/useStore'

function latLonToVector3(lat: number, lon: number, radius: number = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function formatLatLon(coord: number, isLat: boolean = true) {
  const abs = Math.abs(coord)
  const deg = Math.floor(abs)
  const min = Math.floor((abs - deg) * 60)
  const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W')
  return `${deg}°${min}'${dir}`
}

function CinematicCamera({
  track,
  progress
}: {
  track: Array<{ lat: number; lon: number; wind: number }>
  progress: number
}) {
  const { camera } = useThree()
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const positionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 4))

  useEffect(() => {
    if (track.length === 0) return

    const totalDuration = track.length
    const exactIndex = progress * (totalDuration - 1)
    const currentIndex = Math.min(Math.floor(exactIndex), track.length - 1)
    const nextIndex = Math.min(currentIndex + 1, track.length - 1)
    const segmentProgress = exactIndex - currentIndex
    const smoothT = segmentProgress * segmentProgress * (3 - 2 * segmentProgress)

    const currentPoint = track[currentIndex]
    const nextPoint = track[nextIndex]

    const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * smoothT
    const lon = currentPoint.lon + (nextPoint.lon - currentPoint.lon) * smoothT

    const stormPosition = latLonToVector3(lat, lon, 1.01)
    targetRef.current.copy(stormPosition)

    const offset = new THREE.Vector3(0, 0.3, 0.5).multiplyScalar(2)
    const cameraPosition = stormPosition.clone().add(offset)
    positionRef.current.copy(cameraPosition)
  }, [track, progress, camera])

  useFrame(() => {
    camera.position.lerp(positionRef.current, 0.15)
    camera.lookAt(targetRef.current.clone())
  })

  return null
}

function HurricaneTrack({ track }: { track: Array<{ lat: number; lon: number; wind: number }> }) {
  const points = useMemo(() => {
    return track.map(point => latLonToVector3(point.lat, point.lon, 1.06))
  }, [track])

  if (points.length < 2) return null

  const positions = new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ff6b6b" linewidth={5} transparent opacity={0.8} />
    </line>
  )
}

function HurricaneTrail({
  track,
  progress,
  currentPosition
}: {
  track: Array<{ lat: number; lon: number; wind: number }>
  progress: number
  currentPosition: THREE.Vector3
}) {
  const trailGeometry = useMemo(() => {
    if (!track || track.length === 0) return null

    const points: THREE.Vector3[] = []
    const totalPoints = track.length
    const trailEndIndex = Math.floor(progress * totalPoints)

    for (let i = 0; i <= trailEndIndex; i++) {
      const point = track[i]
      points.push(latLonToVector3(point.lat, point.lon, 1.06))
    }

    if (points.length > 0) {
      points.push(currentPosition)
    }

    if (points.length < 2) return null

    return new THREE.BufferGeometry().setFromPoints(points)
  }, [track, progress, currentPosition])

  if (!trailGeometry) return null

  return React.createElement(
    'line' as any,
    { geometry: trailGeometry },
    React.createElement('lineBasicMaterial', {
      color: new THREE.Color(1.0, 0.8, 0.2),
      transparent: true,
      opacity: 0.7,
      linewidth: 4
    })
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
  const durationHours = useMemo(() => hurricane.track.length * 6, [hurricane.track])

  const { state, start, stop } = useCinematicController(durationHours, onComplete, 10)
  const hasStartedRef = useRef(false)
  const voicePlayedRef = useRef(false)

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      start()
    }
  }, [start])

  // Play personal account voiceover when animation is playing
  useEffect(() => {
    if (state.phase !== 'playing' || !state.isPlaying || voicePlayedRef.current) return
    voicePlayedRef.current = true
    const playVoice = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/voice-account/${hurricane.id}?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        })
        if (data?.audio_base64) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`)
          await audio.play()
        }
      } catch (e) {
        console.warn('Could not play voice account:', e)
      }
    }
    playVoice()
  }, [state.phase, state.isPlaying, hurricane.id])
  
  // Auto-exit after 10 seconds
  useEffect(() => {
    if (state.isPlaying && state.phase === 'playing') {
      const timer = setTimeout(() => {
        stop()
        setTimeout(() => onComplete(), 100)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [state.isPlaying, state.phase, stop, onComplete])

  const handleExitAnimation = () => {
    stop()
    setTimeout(() => onComplete(), 100)
  }

  const currentStormPosition = useMemo(() => {
    if (hurricane.track.length === 0) return new THREE.Vector3(0, 1, 0)
    const totalPoints = hurricane.track.length
    const exactIndex = state.progress * (totalPoints - 1)
    const currentIndex = Math.floor(exactIndex)
    const nextIndex = Math.min(currentIndex + 1, totalPoints - 1)
    const t = exactIndex - currentIndex
    const smoothT = t * t * (3 - 2 * t)
    const currentPos = latLonToVector3(hurricane.track[currentIndex].lat, hurricane.track[currentIndex].lon, 1.06)
    const nextPos = latLonToVector3(hurricane.track[nextIndex].lat, hurricane.track[nextIndex].lon, 1.06)
    return currentPos.clone().lerp(nextPos, smoothT)
  }, [hurricane.track, state.progress])

  const stormIntensity = useMemo(() => {
    if (hurricane.track.length === 0) return 0.5
    const currentIndex = Math.min(Math.floor(state.progress * hurricane.track.length), hurricane.track.length - 1)
    const maxWind = Math.max(...hurricane.track.map(p => p.wind))
    return Math.min(hurricane.track[currentIndex].wind / maxWind, 1)
  }, [hurricane.track, state.progress])

  const visibleEvents = useMemo(() => {
    return impactEvents.filter(event => Math.abs(event.time_hours - state.currentTime) < 2)
  }, [impactEvents, state.currentTime])

  const currentTrackPoint = useMemo(() => {
    if (hurricane.track.length === 0) return null
    const currentIndex = Math.min(Math.floor(state.progress * hurricane.track.length), hurricane.track.length - 1)
    const point = hurricane.track[currentIndex]
    const getCategory = (wind: number) => {
      if (wind >= 157) return 5
      if (wind >= 130) return 4
      if (wind >= 111) return 3
      if (wind >= 96) return 2
      if (wind >= 74) return 1
      return 0
    }
    return { ...point, category: getCategory(point.wind), index: currentIndex }
  }, [hurricane.track, state.progress])

  const fadeOpacity = useMemo(() => {
    if (state.phase === 'fadeIn') return state.progress
    if (state.phase === 'fadeOut') return 1 - state.progress
    return 1
  }, [state.phase, state.progress])

  useEffect(() => {
    if (state.phase === 'complete' && !state.isPlaying) {
      const timer = setTimeout(() => onComplete(), 50)
      return () => clearTimeout(timer)
    }
  }, [state.phase, state.isPlaying, onComplete])

  if (!state.isPlaying && state.phase === 'complete') return null

  return (
    <div className="fixed inset-0 z-50 bg-black" style={{
      opacity: fadeOpacity,
      transition: 'opacity 0.3s ease-in-out',
      pointerEvents: 'auto'
    }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Suspense fallback={null}>
          {/* Static lighting */}
          <ambientLight intensity={0.05} />
          <pointLight position={[0, 0, 4]} intensity={0.2} color="#2244ff" distance={10} />
          <pointLight position={[-3, 1, 2]} intensity={0.12} color="#9900ff" distance={12} />


          {/* MapVis globe (GlobeShell + CountryMesh) — NOT satellite/NASA texture */}
          <CinematicGlobe />

          {(state.phase === 'playing' || state.phase === 'fadeIn') && state.isPlaying && (
            <>
              <CinematicCamera track={hurricane.track} progress={state.progress} />

              {state.phase === 'playing' && state.isPlaying && (
                <>
                  <HurricaneTrack track={hurricane.track} />

                  {state.progress > 0 && (
                    <HurricaneTrail
                      track={hurricane.track}
                      progress={state.progress}
                      currentPosition={currentStormPosition}
                    />
                  )}

                  <HurricaneSpiral
                    position={currentStormPosition}
                    intensity={stormIntensity}
                    radius={0.08 + stormIntensity * 0.05}
                  />

                  {visibleEvents.map((event, i) => {
                    const eventPosition = latLonToVector3(event.location.lat, event.location.lon, 1.02)
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

      {/* Exit button */}
      {(state.phase === 'playing' || state.phase === 'fadeIn') && state.isPlaying && (
        <button
          onClick={handleExitAnimation}
          className="absolute top-8 right-8 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold font-rajdhani text-lg transition border border-white/10 z-50"
        >
          Exit Animation
        </button>
      )}

      {/* Time overlay */}
      {state.phase === 'playing' && state.isPlaying && (
        <div className="absolute top-8 left-8 text-white font-rajdhani text-4xl font-bold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)', zIndex: 100 }}>
          T+{Math.floor(state.currentTime)} {Math.floor(state.currentTime) === 1 ? 'Hour' : 'Hours'}
        </div>
      )}

      {/* Hurricane name */}
      {state.phase === 'playing' && state.isPlaying && (
        <div className="absolute top-20 left-8 text-white font-rajdhani text-2xl font-bold" style={{ textShadow: '0 0 8px rgba(255,255,255,0.2)', zIndex: 100 }}>
          {hurricane.name} ({hurricane.year})
        </div>
      )}

      {/* Category info */}
      {state.phase === 'playing' && state.isPlaying && (
        <div className="absolute top-32 left-8 text-white/70 font-rajdhani text-lg" style={{ zIndex: 100 }}>
          Category {hurricane.max_category} &bull; {hurricane.affected_countries.join(', ')}
        </div>
      )}

      {/* Track point info */}
      {state.phase === 'playing' && state.isPlaying && currentTrackPoint && (
        <div className="absolute bottom-8 right-8 bg-black/90 border border-white/10 rounded-lg p-4 min-w-[220px] max-w-[280px]" style={{ zIndex: 200 }}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50 font-rajdhani">Wind Speed</span>
              <span className="text-lg font-bold text-white font-mono">{Math.round(currentTrackPoint.wind)} mph</span>
            </div>
            {currentTrackPoint.category > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50 font-rajdhani">Category</span>
                <span className="text-lg font-bold text-red-400 font-mono">Cat {currentTrackPoint.category}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-white/40 font-mono pt-2 border-t border-white/10">
              <span>{formatLatLon(currentTrackPoint.lat)}</span>
              <span>{formatLatLon(currentTrackPoint.lon, false)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transition message */}
      {state.phase === 'fadeOut' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white font-rajdhani text-3xl text-center">
            You are now entering the response phase.
          </div>
        </div>
      )}
    </div>
  )
}
