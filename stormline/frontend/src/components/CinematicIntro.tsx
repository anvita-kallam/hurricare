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
// Sound removed — only hover/click sounds kept

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

/** Mini wind speed chart — FDP-style with labeled axes, area fill, glow */
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

    const dpr = window.devicePixelRatio || 1
    const logicalW = 280
    const logicalH = 100
    canvas.width = logicalW * dpr
    canvas.height = logicalH * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${logicalW}px`
    canvas.style.height = `${logicalH}px`

    ctx.clearRect(0, 0, logicalW, logicalH)
    if (track.length === 0) return

    const maxWind = Math.max(...track.map(p => p.wind), 1)
    const currentIdx = Math.min(Math.floor(progress * track.length), track.length - 1)
    const padL = 32, padR = 8, padT = 18, padB = 16
    const plotW = logicalW - padL - padR
    const plotH = logicalH - padT - padB

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '7px DM Mono, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ;[0, 0.25, 0.5, 0.75, 1].forEach(r => {
      const y = padT + plotH * (1 - r)
      ctx.fillText(`${Math.round(maxWind * r)}`, padL - 4, y)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(logicalW - padR, y); ctx.stroke()
    })

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '7px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('Track Progress', logicalW / 2, logicalH - 11)
    ctx.save()
    ctx.translate(7, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('mph', 0, 0)
    ctx.restore()

    // Category thresholds
    const cats = [
      { wind: 74, label: 'Cat 1', c: 'rgba(200,200,200,' },
      { wind: 96, label: 'Cat 2', c: 'rgba(185,185,185,' },
      { wind: 111, label: 'Cat 3', c: 'rgba(170,170,170,' },
      { wind: 130, label: 'Cat 4', c: 'rgba(155,155,155,' },
      { wind: 157, label: 'Cat 5', c: 'rgba(140,140,140,' },
    ]
    cats.forEach(cat => {
      if (cat.wind <= maxWind * 1.1) {
        const y = padT + plotH * (1 - cat.wind / maxWind)
        if (y > padT && y < padT + plotH) {
          ctx.strokeStyle = `${cat.c}0.2)`; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.6
          ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(logicalW - padR, y); ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = `${cat.c}0.55)`; ctx.font = '7px DM Mono, monospace'
          ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
          ctx.fillText(cat.label, logicalW - padR, y - 1)
        }
      }
    })

    // Area fill (dim)
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH)
    track.forEach((p, i) => {
      ctx.lineTo(padL + (i / (track.length - 1)) * plotW, padT + plotH * (1 - p.wind / maxWind))
    })
    ctx.lineTo(padL + plotW, padT + plotH); ctx.closePath()
    const aG = ctx.createLinearGradient(0, padT, 0, padT + plotH)
    aG.addColorStop(0, 'rgba(200,200,200,0.06)'); aG.addColorStop(1, 'rgba(200,200,200,0.01)')
    ctx.fillStyle = aG; ctx.fill()

    // Full path (dim)
    ctx.beginPath(); ctx.strokeStyle = 'rgba(180,180,180,0.12)'; ctx.lineWidth = 1
    track.forEach((p, i) => {
      const x = padL + (i / (track.length - 1)) * plotW
      const y = padT + plotH * (1 - p.wind / maxWind)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Progress area fill
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH)
    for (let i = 0; i <= currentIdx; i++) {
      ctx.lineTo(padL + (i / (track.length - 1)) * plotW, padT + plotH * (1 - track[i].wind / maxWind))
    }
    ctx.lineTo(padL + (currentIdx / (track.length - 1)) * plotW, padT + plotH)
    ctx.closePath()
    const pG = ctx.createLinearGradient(0, padT, 0, padT + plotH)
    pG.addColorStop(0, 'rgba(200,200,200,0.18)'); pG.addColorStop(1, 'rgba(200,200,200,0.02)')
    ctx.fillStyle = pG; ctx.fill()

    // Progress path (bright)
    ctx.beginPath(); ctx.strokeStyle = 'rgba(180,180,180,0.85)'; ctx.lineWidth = 2
    for (let i = 0; i <= currentIdx; i++) {
      const x = padL + (i / (track.length - 1)) * plotW
      const y = padT + plotH * (1 - track[i].wind / maxWind)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Current point glow
    if (currentIdx > 0 && currentIdx < track.length) {
      const cx = padL + (currentIdx / (track.length - 1)) * plotW
      const cy = padT + plotH * (1 - track[currentIdx].wind / maxWind)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10)
      g.addColorStop(0, 'rgba(180,180,180,0.7)'); g.addColorStop(0.5, 'rgba(180,180,180,0.15)'); g.addColorStop(1, 'rgba(180,180,180,0)')
      ctx.fillStyle = g; ctx.fillRect(cx - 10, cy - 10, 20, 20)
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#aaaaaa'; ctx.fill()
    }

    // Header
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '600 8px Rajdhani, sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('WIND SPEED', padL, 3)
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 11px DM Mono, monospace'
    ctx.fillText(`${Math.round(track[currentIdx].wind)} mph`, logicalW - padR, 2)
  }, [track, progress])

  return <canvas ref={canvasRef} style={{ imageRendering: 'auto', width: 280, height: 100 }} />
}

/** Mini severity bar chart — FDP-style with full labels, 3D depth, axis */
function SeverityMiniChart({ data }: {
  data: Array<{ region: string; severity: number; peopleInNeed: number }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const logicalW = 260
    const rowH = 15
    const padT = 14
    const padB = 14
    const logicalH = padT + data.length * rowH + padB
    canvas.width = logicalW * dpr
    canvas.height = logicalH * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${logicalW}px`
    canvas.style.height = `${logicalH}px`

    ctx.clearRect(0, 0, logicalW, logicalH)
    if (data.length === 0) return

    const labelW = 80  // wide enough for full region names
    const barStart = labelW + 6
    const barMaxW = logicalW - barStart - 50 // leave room for value
    const maxNeed = Math.max(...data.map(d => d.peopleInNeed), 1)

    // Header
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '600 8px Rajdhani, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('REGION', 2, 2)
    ctx.fillText('PEOPLE IN NEED', barStart, 2)

    data.forEach((d, i) => {
      const y = padT + i * rowH
      const barH = 9
      const barW = Math.max(4, (d.peopleInNeed / maxNeed) * barMaxW)

      const color = d.severity > 0.7
        ? 'rgba(150,150,150,'
        : d.severity > 0.4
          ? 'rgba(170,170,170,'
          : 'rgba(130,130,130,'

      // 3D depth
      const depth = 3
      ctx.fillStyle = `${color} 0.2)`
      ctx.beginPath()
      ctx.moveTo(barStart + barW, y + barH)
      ctx.lineTo(barStart + barW + depth, y + barH - depth)
      ctx.lineTo(barStart + barW + depth, y - depth)
      ctx.lineTo(barStart + barW, y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = `${color} 0.4)`
      ctx.beginPath()
      ctx.moveTo(barStart, y)
      ctx.lineTo(barStart + depth, y - depth)
      ctx.lineTo(barStart + barW + depth, y - depth)
      ctx.lineTo(barStart + barW, y)
      ctx.closePath()
      ctx.fill()
      // Front face gradient
      const bGrad = ctx.createLinearGradient(barStart, y, barStart + barW, y)
      bGrad.addColorStop(0, `${color} 0.4)`)
      bGrad.addColorStop(1, `${color} 0.8)`)
      ctx.fillStyle = bGrad
      ctx.fillRect(barStart, y, barW, barH)

      // Full region label — no truncation
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '9px Rajdhani, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      // Measure and only truncate if truly necessary
      let label = d.region
      if (ctx.measureText(label).width > labelW - 4) {
        while (label.length > 4 && ctx.measureText(label + '..').width > labelW - 4) {
          label = label.slice(0, -1)
        }
        label += '..'
      }
      ctx.fillText(label, labelW, y + barH / 2)

      // Severity score
      ctx.fillStyle = `${color} 0.9)`
      ctx.font = 'bold 8px DM Mono, monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${(d.severity * 10).toFixed(1)}`, barStart + barW + depth + 4, y + barH / 2)

      // People in need value
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '7px DM Mono, monospace'
      const needStr = d.peopleInNeed >= 1e6 ? `${(d.peopleInNeed / 1e6).toFixed(1)}M` : d.peopleInNeed >= 1e3 ? `${(d.peopleInNeed / 1e3).toFixed(0)}K` : `${d.peopleInNeed}`
      ctx.fillText(needStr, barStart + barW + depth + 24, y + barH / 2)
    })

    // X-axis label
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '7px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Severity Index (0-10)', logicalW / 2, logicalH - 2)
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'auto', width: 260, height: 14 + data.length * 15 + 14 }}
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
      <lineBasicMaterial color="#aaaaaa" linewidth={5} transparent opacity={0.8} />
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
      color: new THREE.Color(0.75, 0.75, 0.75),
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

  // Track phase transitions (sounds removed)
  const lastPhaseRef = useRef(state.phase)
  useEffect(() => {
    if (state.phase !== lastPhaseRef.current) {
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

  const lastEventCountRef = useRef(0)
  useEffect(() => {
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

  // When complete, render nothing — parent unmounts via setCinematicPlaying(false)
  if (!state.isPlaying && state.phase === 'complete') {
    return null
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
          <pointLight position={[0, 0, 4]} intensity={0.2} color="#ffffff" distance={10} />
          <pointLight position={[-3, 1, 2]} intensity={0.12} color="#cccccc" distance={12} />

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

      {/* Left panel: Regional Severity — FDP glass panel */}
      {state.phase === 'playing' && state.isPlaying && regionSeverityData.length > 0 && (
        <div
          className="absolute left-8 backdrop-blur-xl p-4 space-y-2"
          style={{
            zIndex: 150,
            top: '42%',
            animation: 'cinematic-panel-in 0.6s ease-out forwards',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.88) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 0.5px, transparent 0.5px)',
            backgroundSize: '10px 10px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <TypewriterText text="Regional Severity" emphasis="soft" delayMs={100} className="text-white/30 font-rajdhani text-[9px] tracking-[0.2em] uppercase" />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
          <SeverityMiniChart data={regionSeverityData} />
        </div>
      )}

      {/* Bottom left: Impact stats — FDP glass panel */}
      {state.phase === 'playing' && state.isPlaying && (
        <div
          className="absolute left-8 bottom-8 backdrop-blur-xl p-4 space-y-2"
          style={{
            zIndex: 150,
            animation: 'cinematic-panel-in 0.6s ease-out 0.2s forwards',
            opacity: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.88) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 0.5px, transparent 0.5px)',
            backgroundSize: '10px 10px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <TypewriterText text="Impact Overview" emphasis="soft" delayMs={300} className="text-white/30 font-rajdhani text-[9px] tracking-[0.2em] uppercase" />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <div className="text-white/85 font-mono text-sm font-medium">
                <CountUpText value={hurricane.estimated_population_affected} delayMs={500} duration={1500} />
              </div>
              <div className="text-white/25 font-rajdhani text-[8px] tracking-[0.15em] uppercase">
                People Affected
              </div>
            </div>
            <div>
              <div className="text-white/85 font-mono text-sm font-medium">
                {totalPeopleInNeed.toLocaleString()}
              </div>
              <div className="text-white/25 font-rajdhani text-[8px] tracking-[0.15em] uppercase">
                People in Need
              </div>
            </div>
            <div>
              <div className="text-white/85 font-mono text-sm font-medium">
                {hurricane.affected_countries.length}
              </div>
              <div className="text-white/25 font-rajdhani text-[8px] tracking-[0.15em] uppercase">
                Countries
              </div>
            </div>
            <div>
              <div className="text-white/85 font-mono text-sm font-medium">
                {totalBudget > 0 ? formatBudget(totalBudget) : 'N/A'}
              </div>
              <div className="text-white/25 font-rajdhani text-[8px] tracking-[0.15em] uppercase">
                Relief Budget
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom center: Wind speed — FDP glass panel */}
      {state.phase === 'playing' && state.isPlaying && hurricane.track.length > 1 && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 backdrop-blur-xl p-4"
          style={{
            zIndex: 150,
            animation: 'cinematic-panel-in 0.6s ease-out 0.4s forwards',
            opacity: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.88) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 0.5px, transparent 0.5px)',
            backgroundSize: '10px 10px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <WindSpeedChart track={hurricane.track} progress={state.progress} />
        </div>
      )}

      {/* Right panel: Track info — FDP glass panel */}
      {state.phase === 'playing' && state.isPlaying && currentTrackPoint && (
        <div
          className="absolute bottom-8 right-8 backdrop-blur-xl p-4 min-w-[230px] max-w-[280px]"
          style={{
            zIndex: 200,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.88) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 0.5px, transparent 0.5px)',
            backgroundSize: '10px 10px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="text-white/30 font-rajdhani text-[9px] tracking-[0.2em] uppercase mb-2">
            Current Position
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40 font-rajdhani tracking-wider">Wind Speed</span>
              <span className="text-lg font-bold text-white/90 font-mono">{Math.round(currentTrackPoint.wind)} <span className="text-xs font-normal text-white/40">mph</span></span>
            </div>
            {currentTrackPoint.category > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40 font-rajdhani tracking-wider">Category</span>
                <span className="text-lg font-bold font-mono" style={{ color: currentTrackPoint.category >= 4 ? '#aaaaaa' : currentTrackPoint.category >= 2 ? '#999999' : '#888888' }}>
                  Cat {currentTrackPoint.category}
                </span>
              </div>
            )}
            {/* Intensity label */}
            <div className="flex items-center justify-between text-[9px] text-white/25 font-rajdhani tracking-[0.15em] uppercase">
              <span>Intensity</span>
              <span className="font-mono text-white/40">{(stormIntensity * 100).toFixed(0)}%</span>
            </div>
            {/* Intensity bar */}
            <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${stormIntensity * 100}%`,
                  background: stormIntensity > 0.8
                    ? 'linear-gradient(90deg, #aaaaaa, #cccccc)'
                    : stormIntensity > 0.5
                      ? 'linear-gradient(90deg, #999999, #bbbbbb)'
                      : 'linear-gradient(90deg, #777777, #999999)',
                  boxShadow: stormIntensity > 0.5 ? '0 0 8px rgba(180,180,180,0.3)' : 'none',
                }}
              />
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0' }} />
            <div className="flex items-center justify-between text-xs text-white/35 font-mono">
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
