import { Suspense, useEffect, useRef, useMemo, useCallback, createElement } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCinematicController, ImpactEvent } from '../hooks/useCinematicController'
import HurricaneSpiral from './HurricaneSpiral'
import ImpactCallout from './ImpactCallout'
import CinematicGlobe from './CinematicGlobe'
import { Hurricane, useStore } from '../state/useStore'
import TypewriterText, { CountUpText } from './TypewriterText'
import { playPanelSlide, playPanelSettle, playRipple, playTonalSweep, playPulse } from '../audio/SoundEngine'

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

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Mini wind speed chart drawn on canvas */
function WindSpeedChart({ track, progress }: {
  track: Array<{ lat: number; lon: number; wind: number }>
  progress: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (track.length === 0) return

    const maxWind = Math.max(...track.map(p => p.wind), 1)
    const currentIdx = Math.min(Math.floor(progress * track.length), track.length - 1)

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 0.5
    for (let i = 1; i < 4; i++) {
      const y = (h - 15) * (i / 4) + 15
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Category thresholds
    const categories = [
      { wind: 74, label: 'Cat 1', color: 'rgba(255,200,50,0.3)' },
      { wind: 111, label: 'Cat 3', color: 'rgba(255,120,50,0.3)' },
      { wind: 157, label: 'Cat 5', color: 'rgba(255,50,50,0.3)' },
    ]
    categories.forEach(cat => {
      if (cat.wind <= maxWind) {
        const y = h - (cat.wind / maxWind) * (h - 20) - 5
        ctx.strokeStyle = cat.color
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = cat.color.replace('0.3', '0.5')
        ctx.font = '7px DM Mono'
        ctx.textAlign = 'right'
        ctx.fillText(cat.label, w - 2, y - 2)
      }
    })

    // Full track path (dim)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.15)'
    ctx.lineWidth = 1
    track.forEach((p, i) => {
      const x = (i / track.length) * w
      const y = h - (p.wind / maxWind) * (h - 20) - 5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Progress path (bright)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)'
    ctx.lineWidth = 2
    for (let i = 0; i <= currentIdx; i++) {
      const x = (i / track.length) * w
      const y = h - (track[i].wind / maxWind) * (h - 20) - 5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Current point glow
    if (currentIdx > 0 && currentIdx < track.length) {
      const cx = (currentIdx / track.length) * w
      const cy = h - (track[currentIdx].wind / maxWind) * (h - 20) - 5
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8)
      grad.addColorStop(0, 'rgba(255, 100, 100, 0.8)')
      grad.addColorStop(1, 'rgba(255, 100, 100, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(cx - 8, cy - 8, 16, 16)
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#ff6b6b'
      ctx.fill()
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '9px Rajdhani'
    ctx.textAlign = 'left'
    ctx.fillText('WIND SPEED', 4, 10)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '10px DM Mono'
    ctx.fillText(`${Math.round(track[currentIdx].wind)} mph`, w - 4, 10)
  }, [track, progress])

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={70}
      style={{ imageRendering: 'auto' }}
    />
  )
}

/** Mini severity bar chart for regions */
function SeverityMiniChart({ data }: {
  data: Array<{ region: string; severity: number; peopleInNeed: number }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (data.length === 0) return

    const barH = Math.max(8, (h - 10) / data.length - 4)
    const maxNeed = Math.max(...data.map(d => d.peopleInNeed), 1)

    data.forEach((d, i) => {
      const y = 2 + i * (barH + 3)
      const barW = Math.max(4, (d.peopleInNeed / maxNeed) * (w - 60))

      // Severity color
      const color = d.severity > 0.7
        ? 'rgba(200, 60, 60,'
        : d.severity > 0.4
          ? 'rgba(200, 160, 60,'
          : 'rgba(60, 160, 100,'

      // Bar with 3D extrusion
      const depth = 3
      // Right face
      ctx.fillStyle = `${color} 0.2)`
      ctx.beginPath()
      ctx.moveTo(50 + barW, y + barH)
      ctx.lineTo(50 + barW + depth, y + barH - depth)
      ctx.lineTo(50 + barW + depth, y - depth)
      ctx.lineTo(50 + barW, y)
      ctx.closePath()
      ctx.fill()
      // Top face
      ctx.fillStyle = `${color} 0.4)`
      ctx.beginPath()
      ctx.moveTo(50, y)
      ctx.lineTo(50 + depth, y - depth)
      ctx.lineTo(50 + barW + depth, y - depth)
      ctx.lineTo(50 + barW, y)
      ctx.closePath()
      ctx.fill()
      // Front face
      ctx.fillStyle = `${color} 0.7)`
      ctx.fillRect(50, y, barW, barH)

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '8px Rajdhani'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        d.region.length > 8 ? d.region.slice(0, 8) + '..' : d.region,
        46, y + barH / 2
      )
    })
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={Math.min(data.length * 14 + 10, 100)}
      style={{ imageRendering: 'auto' }}
    />
  )
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

  return createElement(
    'line' as any,
    { geometry: trailGeometry },
    createElement('lineBasicMaterial', {
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
  const { coverage } = useStore()
  const durationHours = useMemo(() => hurricane.track.length * 6, [hurricane.track])

  const { state, start, stop } = useCinematicController(durationHours, 10)
  const hasStartedRef = useRef(false)
  const voicePlayedRef = useRef(false)
  const completedRef = useRef(false)

  // Build region severity data for floating panels
  const regionSeverityData = useMemo(() => {
    if (!hurricane) return []
    return coverage
      .filter(c => c.hurricane_id === hurricane.id)
      .slice(0, 6)
      .map(c => ({
        region: c.admin1,
        severity: Math.min(c.severity_index / 10, 1),
        peopleInNeed: c.people_in_need,
      }))
  }, [hurricane, coverage])

  const totalPeopleInNeed = useMemo(() =>
    regionSeverityData.reduce((s, r) => s + r.peopleInNeed, 0),
    [regionSeverityData]
  )

  const totalBudget = useMemo(() =>
    coverage
      .filter(c => c.hurricane_id === hurricane.id)
      .reduce((s, c) => s + c.pooled_fund_budget, 0),
    [hurricane, coverage]
  )

  // Safe onComplete wrapper — ensures it fires exactly once
  const safeComplete = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }, [onComplete])

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      start()
    }
  }, [start])

  // Safety timeout — auto-complete after 16 seconds if animation gets stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!completedRef.current) {
        console.warn('[CinematicIntro] Safety timeout reached, forcing completion')
        stop()
        safeComplete()
      }
    }, 16000)
    return () => clearTimeout(timeout)
  }, [stop, safeComplete])

  // Sound: tonal sweep + panel sounds on phase transitions
  const lastPhaseRef = useRef(state.phase)
  useEffect(() => {
    if (state.phase !== lastPhaseRef.current) {
      if (state.phase === 'playing') {
        playTonalSweep()
        setTimeout(() => playPanelSlide(), 400)
        setTimeout(() => playPanelSettle(), 800)
      }
      if (state.phase === 'fadeOut') {
        playRipple()
      }
      lastPhaseRef.current = state.phase
    }
  }, [state.phase])

  // Play personal account voiceover when animation is playing.
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

  // Single completion handler: fires when controller reaches 'complete' phase
  useEffect(() => {
    if (state.phase === 'complete' && !state.isPlaying) {
      safeComplete()
    }
  }, [state.phase, state.isPlaying, safeComplete])

  const handleExitAnimation = () => {
    stop()
    // Call safeComplete directly for reliability
    safeComplete()
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

  // Sound: pulse on impact events appearing
  const lastEventCountRef = useRef(0)
  useEffect(() => {
    if (visibleEvents.length > lastEventCountRef.current) {
      playPulse()
    }
    lastEventCountRef.current = visibleEvents.length
  }, [visibleEvents.length])

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

  // Keep rendering black backdrop when complete
  if (!state.isPlaying && state.phase === 'complete') {
    return <div className="fixed inset-0 z-50 bg-black" />
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" style={{
      opacity: fadeOpacity,
      transition: 'opacity 0.3s ease-in-out',
      pointerEvents: 'auto'
    }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.05} />
          <pointLight position={[0, 0, 4]} intensity={0.2} color="#2244ff" distance={10} />
          <pointLight position={[-3, 1, 2]} intensity={0.12} color="#9900ff" distance={12} />

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
          Skip
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
          <TypewriterText text={`${hurricane.name} (${hurricane.year})`} emphasis="headline" delayMs={200} charIntervalMs={45} />
        </div>
      )}

      {/* Category info */}
      {state.phase === 'playing' && state.isPlaying && (
        <div className="absolute top-32 left-8 text-white/70 font-rajdhani text-lg" style={{ zIndex: 100 }}>
          <TypewriterText
            text={`Category ${hurricane.max_category} \u2022 ${hurricane.affected_countries.join(', ')}`}
            emphasis="normal"
            delayMs={600}
            charIntervalMs={25}
          />
        </div>
      )}

      {/* ═══ Floating Data Panels (3D graphs around the animation) ═══ */}

      {/* Left panel: Regional Severity 3D mini-chart */}
      {state.phase === 'playing' && state.isPlaying && regionSeverityData.length > 0 && (
        <div
          className="absolute left-8 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg p-3 space-y-2"
          style={{
            zIndex: 150,
            top: '45%',
            animation: 'cinematic-panel-in 0.6s ease-out forwards',
          }}
        >
          <TypewriterText text="Regional Severity" emphasis="soft" delayMs={100} className="text-white/50 font-rajdhani text-[9px] tracking-widest uppercase" />
          <SeverityMiniChart data={regionSeverityData} />
        </div>
      )}

      {/* Bottom left: Population & Budget stats */}
      {state.phase === 'playing' && state.isPlaying && (
        <div
          className="absolute left-8 bottom-8 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg p-3 space-y-2"
          style={{
            zIndex: 150,
            animation: 'cinematic-panel-in 0.6s ease-out 0.2s forwards',
            opacity: 0,
          }}
        >
          <TypewriterText text="Impact Overview" emphasis="soft" delayMs={300} className="text-white/50 font-rajdhani text-[9px] tracking-widest uppercase" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <div className="text-white/80 font-mono text-sm">
                <CountUpText value={hurricane.estimated_population_affected} delayMs={500} duration={1500} />
              </div>
              <div className="text-white/30 font-rajdhani text-[8px] tracking-wider uppercase">
                People Affected
              </div>
            </div>
            <div>
              <div className="text-white/80 font-mono text-sm">
                {totalPeopleInNeed.toLocaleString()}
              </div>
              <div className="text-white/30 font-rajdhani text-[8px] tracking-wider uppercase">
                People in Need
              </div>
            </div>
            <div>
              <div className="text-white/80 font-mono text-sm">
                {hurricane.affected_countries.length}
              </div>
              <div className="text-white/30 font-rajdhani text-[8px] tracking-wider uppercase">
                Countries
              </div>
            </div>
            <div>
              <div className="text-white/80 font-mono text-sm">
                {totalBudget > 0 ? formatBudget(totalBudget) : 'N/A'}
              </div>
              <div className="text-white/30 font-rajdhani text-[8px] tracking-wider uppercase">
                Relief Budget
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom center: Wind speed chart */}
      {state.phase === 'playing' && state.isPlaying && hurricane.track.length > 1 && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg p-3"
          style={{
            zIndex: 150,
            animation: 'cinematic-panel-in 0.6s ease-out 0.4s forwards',
            opacity: 0,
          }}
        >
          <WindSpeedChart track={hurricane.track} progress={state.progress} />
        </div>
      )}

      {/* Right panel: Track point info */}
      {state.phase === 'playing' && state.isPlaying && currentTrackPoint && (
        <div
          className="absolute bottom-8 right-8 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg p-4 min-w-[220px] max-w-[280px]"
          style={{ zIndex: 200 }}
        >
          <div className="text-white/50 font-rajdhani text-[9px] tracking-widest uppercase mb-2">
            Current Position
          </div>
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
            {/* Mini intensity bar */}
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${stormIntensity * 100}%`,
                  backgroundColor: stormIntensity > 0.8 ? '#ff4444' : stormIntensity > 0.5 ? '#ffaa44' : '#44cc77',
                }}
              />
            </div>
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
            <TypewriterText text="You are now entering the response phase." emphasis="headline" delayMs={100} charIntervalMs={35} />
          </div>
        </div>
      )}
    </div>
  )
}
