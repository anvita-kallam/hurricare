import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import MiniGlobePreview from './MiniGlobePreview'

/* ─── Option definitions ──────────────────────────────────────────────────── */

interface DashboardOption {
  id: 'search' | 'browse' | 'disparity'
  title: string
  subtitle: string
  tag: string
  color: string
  statusText: string
}

const options: DashboardOption[] = [
  {
    id: 'search',
    title: 'SEARCH',
    subtitle: 'Find Specific Hurricanes',
    tag: 'REGION',
    color: '#4488ff',
    statusText: 'READY',
  },
  {
    id: 'browse',
    title: 'BROWSE',
    subtitle: 'Explore Historical Events',
    tag: 'MODEL',
    color: '#44ccaa',
    statusText: 'ACTIVE',
  },
  {
    id: 'disparity',
    title: 'FUNDING',
    subtitle: 'Global Disparity Analysis',
    tag: 'STATUS',
    color: '#ff8844',
    statusText: 'LINKED',
  },
]

const VARIANT_MAP: Record<string, 'search' | 'browse' | 'heatmap'> = {
  search: 'search',
  browse: 'browse',
  disparity: 'heatmap',
}

const GLOBE_POSITIONS: [number, number, number][] = [
  [-2.8, 0, 0],
  [0, 0, 0],
  [2.8, 0, 0],
]

/* ─── Background grid shader ──────────────────────────────────────────────── */

const gridVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const gridFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float grid(vec2 uv, float spacing, float thickness) {
    vec2 g = abs(fract(uv / spacing - 0.5) - 0.5) * spacing;
    float line = min(g.x, g.y);
    return 1.0 - smoothstep(0.0, thickness, line);
  }

  void main() {
    vec2 uv = vUv;

    // Major grid
    float g1 = grid(uv, 0.05, 0.001) * 0.04;
    // Minor grid
    float g2 = grid(uv, 0.2, 0.001) * 0.08;

    // Horizontal scan line
    float scanY = fract(uTime * 0.03);
    float scanDist = abs(uv.y - scanY);
    float scan = exp(-scanDist * 80.0) * 0.06;

    // Edge fade
    float edgeFade = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x) *
                     smoothstep(0.0, 0.2, uv.y) * smoothstep(1.0, 0.8, uv.y);

    float alpha = (g1 + g2 + scan) * edgeFade;
    gl_FragColor = vec4(0.2, 0.4, 0.8, alpha);
  }
`

/* ─── Background grid plane (3D element) ──────────────────────────────────── */

function BackgroundGrid() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <mesh position={[0, 0, -3]} renderOrder={0}>
      <planeGeometry args={[20, 12]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={gridVertexShader}
        fragmentShader={gridFragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/* ─── Zoom transition camera controller ──────────────────────────────────── */

function CameraZoom({
  target,
  active,
  onComplete,
}: {
  target: [number, number, number] | null
  active: boolean
  onComplete: () => void
}) {
  const { camera } = useThree()
  const startPos = useRef(new THREE.Vector3(0, 0, 6))
  const startTime = useRef(0)
  const completed = useRef(false)
  const DURATION = 1.4

  useFrame(({ clock }) => {
    if (!active || !target || completed.current) return

    if (startTime.current === 0) {
      startPos.current.copy(camera.position)
      startTime.current = clock.elapsedTime
    }

    const elapsed = clock.elapsedTime - startTime.current
    // Smooth easing: ease-in-out cubic
    let t = Math.min(elapsed / DURATION, 1)
    t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const endPos = new THREE.Vector3(target[0], target[1], target[2] + 1.0)

    camera.position.lerpVectors(startPos.current, endPos, t)
    camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]))

    if (t >= 1) {
      completed.current = true
      onComplete()
    }
  })

  return null
}

/* ─── Subtle particle field ───────────────────────────────────────────────── */

function ParticleField() {
  const ref = useRef<THREE.Points>(null)

  const { geometry, material } = useMemo(() => {
    const count = 300
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 2
      phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aPhase;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.y += sin(uTime * 0.3 + aPhase) * 0.15;
          pos.x += cos(uTime * 0.2 + aPhase * 1.3) * 0.1;
          vAlpha = 0.5 + 0.5 * sin(uTime * 0.8 + aPhase);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 1.2 * (100.0 / length(mvPos));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          float core = exp(-d * d * 6.0);
          gl_FragColor = vec4(0.3, 0.5, 0.9, core * vAlpha * 0.15);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [])

  useFrame(({ clock }) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <points ref={ref} geometry={geometry} material={material} renderOrder={0} frustumCulled={false} />
  )
}

/* ─── 3D Scene ────────────────────────────────────────────────────────────── */

function ThreeScene({
  onSelect,
  zoomTarget,
  zooming,
  onZoomComplete,
  fadeOpacity,
}: {
  onSelect: (id: 'search' | 'browse' | 'disparity') => void
  zoomTarget: [number, number, number] | null
  zooming: boolean
  onZoomComplete: () => void
  fadeOpacity: number
}) {
  const [selectedId, setSelectedId] = useState<'search' | 'browse' | 'disparity' | null>(null)

  const handleSelect = (id: 'search' | 'browse' | 'disparity') => {
    if (zooming) return
    setSelectedId(id)
    onSelect(id)
  }

  return (
    <>
      <color attach="background" args={['#020408']} />
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 2, 5]} intensity={0.12} color="#2244ff" distance={14} />
      <pointLight position={[-4, 1, 3]} intensity={0.08} color="#9900ff" distance={14} />
      <pointLight position={[4, -1, 3]} intensity={0.06} color="#0055ff" distance={14} />

      <BackgroundGrid />
      <ParticleField />

      {/* Fade group for zoom transition */}
      <group>
        {options.map((option, index) => (
          <MiniGlobePreview
            key={option.id}
            variant={VARIANT_MAP[option.id]}
            position={GLOBE_POSITIONS[index]}
            isSelected={selectedId === option.id}
            onClick={() => handleSelect(option.id)}
          />
        ))}
      </group>

      <CameraZoom target={zoomTarget} active={zooming} onComplete={onZoomComplete} />
    </>
  )
}

/* ─── Dashboard3D Component ───────────────────────────────────────────────── */

interface Dashboard3DProps {
  onEnter: () => void
  onSelectOption: (option: 'search' | 'browse' | 'disparity') => void
  isLoading: boolean
}

export default function Dashboard3D({ onSelectOption, isLoading }: Dashboard3DProps) {
  const [showUI, setShowUI] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [zoomTarget, setZoomTarget] = useState<[number, number, number] | null>(null)
  const [fadeOpacity, setFadeOpacity] = useState(0)
  const [uiVisible, setUiVisible] = useState(true)
  const pendingOption = useRef<'search' | 'browse' | 'disparity' | null>(null)
  const [systemTime, setSystemTime] = useState('')
  const [scanlinePos, setScanlinePos] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => setShowUI(true), 600)
    }
  }, [isLoading])

  // System clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setSystemTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Scanline animation
  useEffect(() => {
    let raf: number
    const animate = () => {
      setScanlinePos((p) => (p + 0.15) % 100)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleSelect = useCallback(
    (id: 'search' | 'browse' | 'disparity') => {
      if (zooming) return
      pendingOption.current = id
      const idx = options.findIndex((o) => o.id === id)
      setZoomTarget(GLOBE_POSITIONS[idx])
      setZooming(true)
      setUiVisible(false)

      // Begin fade overlay
      setTimeout(() => setFadeOpacity(1), 800)
    },
    [zooming]
  )

  const handleZoomComplete = useCallback(() => {
    // After zoom animation + fade, fire the actual navigation
    setTimeout(() => {
      if (pendingOption.current) {
        onSelectOption(pendingOption.current)
      }
    }, 400)
  }, [onSelectOption])

  return (
    <div className="fixed inset-0 z-50 bg-[#020408] overflow-hidden">
      {/* 3D Canvas — square aspect enforcement via container */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <ThreeScene
            onSelect={handleSelect}
            zoomTarget={zoomTarget}
            zooming={zooming}
            onZoomComplete={handleZoomComplete}
            fadeOpacity={fadeOpacity}
          />
        </Canvas>
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[6]"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.008) 2px,
            rgba(255,255,255,0.008) 4px
          )`,
        }}
      />

      {/* Moving scan line */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none z-[7]"
        style={{
          top: `${scanlinePos}%`,
          background: 'linear-gradient(90deg, transparent 0%, rgba(100,150,255,0.06) 30%, rgba(100,150,255,0.1) 50%, rgba(100,150,255,0.06) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(100,150,255,0.03)',
        }}
      />

      {/* Overlay UI */}
      <div
        className="relative z-10 flex flex-col h-full pointer-events-none transition-opacity duration-700"
        style={{ opacity: uiVisible ? 1 : 0 }}
      >
        {/* ─── Top bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-8 pt-6 pb-2">
          {/* Left: system tag */}
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4488ff]/60 dashboard-pulse" />
            <span className="text-[10px] font-mono text-white/20 tracking-[0.2em] uppercase">
              SYS.ONLINE
            </span>
          </div>

          {/* Right: time + mode */}
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-mono text-white/15 tracking-[0.15em]">
              MODE: SELECTION
            </span>
            <span className="text-[10px] font-mono text-white/20 tracking-[0.2em]">
              {systemTime || '00:00:00'}
            </span>
          </div>
        </div>

        {/* Thin separator */}
        <div className="mx-8 h-[1px] bg-white/[0.04]" />

        {/* ─── Title section ──────────────────────────────────── */}
        <div className="flex flex-col items-center mt-10 mb-2">
          {/* Pre-title micro label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-[1px] bg-white/10" />
            <span className="text-[9px] font-mono text-white/20 tracking-[0.3em] uppercase">
              HUMANITARIAN RESPONSE INTERFACE
            </span>
            <div className="w-6 h-[1px] bg-white/10" />
          </div>

          {/* Main title */}
          <h1
            className="text-6xl font-bold text-white font-rajdhani tracking-[0.12em] leading-none"
            style={{
              textShadow: '0 0 40px rgba(68, 136, 255, 0.08)',
            }}
          >
            HURRICARE
          </h1>

          {/* Subtitle in structured frame */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-3 h-[1px] bg-white/8" />
            <div className="border border-white/[0.06] px-4 py-1">
              <span className="text-[11px] font-rajdhani text-white/30 tracking-[0.25em] uppercase">
                Global Response Simulation System
              </span>
            </div>
            <div className="w-3 h-[1px] bg-white/8" />
          </div>
        </div>

        {/* Spacer for globes */}
        <div className="flex-1" />

        {/* ─── Globe labels + HUD accents ────────────────────── */}
        {showUI && !isLoading && (
          <div className="px-12 mb-6">
            {/* Globe option labels */}
            <div className="flex justify-around">
              {options.map((option, i) => (
                <div key={option.id} className="text-center w-56 dashboard-option-fade" style={{ animationDelay: `${i * 0.12}s` }}>
                  {/* Tag label */}
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-4 h-[1px]" style={{ background: option.color, opacity: 0.3 }} />
                    <span className="text-[8px] font-mono tracking-[0.25em] uppercase" style={{ color: option.color, opacity: 0.5 }}>
                      {option.tag}
                    </span>
                    <div className="w-4 h-[1px]" style={{ background: option.color, opacity: 0.3 }} />
                  </div>

                  {/* Title */}
                  <div className="text-base font-rajdhani font-bold text-white/80 tracking-[0.15em]">
                    {option.title}
                  </div>

                  {/* Subtitle */}
                  <div className="text-[10px] text-white/30 font-rajdhani tracking-wider mt-0.5">
                    {option.subtitle}
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <div
                      className="w-1 h-1 rounded-full dashboard-pulse"
                      style={{ background: option.color, opacity: 0.6 }}
                    />
                    <span className="text-[8px] font-mono tracking-[0.2em]" style={{ color: option.color, opacity: 0.4 }}>
                      {option.statusText}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Bottom bar ─────────────────────────────────────── */}
        <div className="mx-8 h-[1px] bg-white/[0.04]" />
        <div className="flex items-center justify-between px-8 py-3">
          {/* Left corner marks */}
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-mono text-white/12 tracking-[0.15em]">
              [ 0.0.1-ALPHA ]
            </span>
            <span className="text-[8px] font-mono text-white/10 tracking-[0.1em]">
              HURRICARE.SIM
            </span>
          </div>

          {/* Center prompt */}
          {showUI && (
            <span className="text-[10px] font-rajdhani text-white/20 tracking-[0.15em] dashboard-prompt-fade">
              SELECT A GLOBE TO BEGIN
            </span>
          )}

          {/* Right data readout */}
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-mono text-white/10 tracking-[0.1em]">
              LAT 0.00 / LON 0.00
            </span>
            <span className="text-[8px] font-mono text-white/12 tracking-[0.15em]">
              FPS 60
            </span>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 dashboard-pulse" />
                <span className="text-sm font-mono text-white/30 tracking-[0.3em] uppercase">
                  INITIALIZING
                </span>
              </div>
              <div className="w-32 h-[1px] bg-white/[0.06] relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/3 bg-white/20 dashboard-loading-bar" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Corner brackets (HUD framing) ────────────────────── */}
      <div className="absolute top-4 left-4 w-4 h-4 pointer-events-none z-[8]" style={{
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute top-4 right-4 w-4 h-4 pointer-events-none z-[8]" style={{
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 left-4 w-4 h-4 pointer-events-none z-[8]" style={{
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 right-4 w-4 h-4 pointer-events-none z-[8]" style={{
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />

      {/* Vignette — stronger for depth */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(2, 4, 8, 0.4) 70%, rgba(2, 4, 8, 0.8) 100%)',
        }}
      />

      {/* Zoom fade overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[20]"
        style={{
          background: '#020408',
          opacity: fadeOpacity,
          transition: 'opacity 0.6s ease-in',
        }}
      />
    </div>
  )
}
