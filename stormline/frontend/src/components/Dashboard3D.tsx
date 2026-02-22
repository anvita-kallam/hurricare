import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Vignette } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import * as THREE from 'three'
import MiniGlobePreview from './MiniGlobePreview'
import TypewriterText from './TypewriterText'
import { playButtonPress } from '../audio/SoundEngine'

/* ─── Option definitions ──────────────────────────────────────────────────── */

interface DashboardOption {
  id: 'browse' | 'disparity'
  title: string
  subtitle: string
  tag: string
  color: string
  statusText: string
}

const options: DashboardOption[] = [
  {
    id: 'browse',
    title: 'BROWSE',
    subtitle: 'Explore Historical Events & Tracks',
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

const VARIANT_MAP: Record<string, 'browse' | 'heatmap'> = {
  browse: 'browse',
  disparity: 'heatmap',
}

// Tighter spacing to reduce perspective distortion at edges
const GLOBE_POSITIONS: [number, number, number][] = [
  [-1.2, 0, 0],
  [1.2, 0, 0],
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

    // Major grid — bright
    float g1 = grid(uv, 0.05, 0.0012) * 0.12;
    // Minor grid — bright
    float g2 = grid(uv, 0.2, 0.0012) * 0.22;

    // Horizontal scan line
    float scanY = fract(uTime * 0.03);
    float scanDist = abs(uv.y - scanY);
    float scan = exp(-scanDist * 80.0) * 0.15;

    // Edge fade
    float edgeFade = smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x) *
                     smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);

    float alpha = (g1 + g2 + scan) * edgeFade;
    gl_FragColor = vec4(0.3, 0.5, 0.9, alpha);
  }
`

/* ─── Radial blur post-processing for motion blur ─────────────────────────── */

const radialBlurFragment = /* glsl */ `
uniform float uStrength;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uStrength < 0.001) {
        outputColor = inputColor;
        return;
    }

    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    vec2 normDir = dist > 0.001 ? normalize(dir) : vec2(0.0);

    vec4 color = vec4(0.0);
    float total = 0.0;
    float blurAmt = uStrength * dist;

    for (int i = 0; i < 14; i++) {
        float t = (float(i) / 13.0 - 0.5) * 2.0;
        float w = 1.0 - abs(t) * 0.25;
        vec2 sampleUV = uv + normDir * t * blurAmt * 0.1;
        sampleUV = clamp(sampleUV, 0.0, 1.0);
        color += texture2D(inputBuffer, sampleUV) * w;
        total += w;
    }

    outputColor = color / total;
}
`

class RadialBlurEffectImpl extends Effect {
  constructor() {
    super('RadialBlurEffect', radialBlurFragment, {
      uniforms: new Map([
        ['uStrength', new THREE.Uniform(0.0)]
      ])
    })
  }
}

function MotionBlur({ active }: { active: boolean }) {
  const strength = useRef(0)
  const effect = useMemo(() => new RadialBlurEffectImpl(), [])

  useFrame(() => {
    const target = active ? 1.4 : 0
    strength.current += (target - strength.current) * 0.07
    if (strength.current < 0.001) strength.current = 0
    effect.uniforms.get('uStrength')!.value = strength.current
  })

  return <primitive object={effect} dispose={null} />
}

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
  const startPos = useRef(new THREE.Vector3(0, 0, 9))
  const startTime = useRef(0)
  const completed = useRef(false)
  const DURATION = 1.6

  useFrame(({ clock }) => {
    if (!active || !target || completed.current) return

    if (startTime.current === 0) {
      startPos.current.copy(camera.position)
      startTime.current = clock.elapsedTime
    }

    const elapsed = clock.elapsedTime - startTime.current
    let t = Math.min(elapsed / DURATION, 1)

    // Quintic ease-out: smooth single-direction deceleration, zero overshoot
    t = 1 - Math.pow(1 - t, 5)

    const endPos = new THREE.Vector3(target[0], target[1], target[2] + 1.5)

    camera.position.lerpVectors(startPos.current, endPos, t)
    camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]))

    if (t >= 0.999) {
      camera.position.copy(endPos)
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
}: {
  onSelect: (id: 'browse' | 'disparity') => void
  zoomTarget: [number, number, number] | null
  zooming: boolean
  onZoomComplete: () => void
}) {
  const [selectedId, setSelectedId] = useState<'browse' | 'disparity' | null>(null)

  const handleSelect = (id: 'browse' | 'disparity') => {
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

      <EffectComposer>
        <MotionBlur active={zooming} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>

      <CameraZoom target={zoomTarget} active={zooming} onComplete={onZoomComplete} />
    </>
  )
}

/* ─── HUD: Oscilloscope Trace ─────────────────────────────────────────────── */

function OscilloscopeTrace({ width = 100, height = 28 }: { width?: number; height?: number }) {
  const polyRef = useRef<SVGPolylineElement>(null)

  useEffect(() => {
    let raf: number
    const animate = () => {
      const time = performance.now() * 0.002
      if (polyRef.current) {
        const points = Array.from({ length: 50 }, (_, i) => {
          const x = (i / 49) * width
          const y = height / 2 + Math.sin(time + i * 0.35) * 6 + Math.sin(time * 1.7 + i * 0.18) * 3 + Math.sin(time * 0.4 + i * 0.6) * 2
          return `${x},${y}`
        }).join(' ')
        polyRef.current.setAttribute('points', points)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return (
    <svg width={width} height={height} className="opacity-[0.12]">
      <polyline
        ref={polyRef}
        fill="none"
        stroke="rgba(68, 136, 255, 0.8)"
        strokeWidth="0.8"
      />
      {/* Baseline */}
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(68,136,255,0.15)" strokeWidth="0.5" />
    </svg>
  )
}

/* ─── HUD: Second trace (different waveform) ──────────────────────────────── */

function OscilloscopeTrace2({ width = 80, height = 24 }: { width?: number; height?: number }) {
  const polyRef = useRef<SVGPolylineElement>(null)

  useEffect(() => {
    let raf: number
    const animate = () => {
      const time = performance.now() * 0.0015
      if (polyRef.current) {
        const points = Array.from({ length: 40 }, (_, i) => {
          const x = (i / 39) * width
          const base = height / 2
          const y = base + Math.sin(time * 1.2 + i * 0.5) * 5 * Math.exp(-((i - 20) * (i - 20)) / 200)
          return `${x},${y}`
        }).join(' ')
        polyRef.current.setAttribute('points', points)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return (
    <svg width={width} height={height} className="opacity-[0.10]">
      <polyline
        ref={polyRef}
        fill="none"
        stroke="rgba(68, 204, 170, 0.8)"
        strokeWidth="0.6"
      />
    </svg>
  )
}

/* ─── HUD: Radial arc gauge ───────────────────────────────────────────────── */

function RadialGauge({ size = 52, value = 0.72, color = 'rgba(68,136,255,0.35)' }: { size?: number; value?: number; color?: string }) {
  const r = size / 2 - 4
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - value)
  const center = size / 2

  return (
    <svg width={size} height={size} className="opacity-[0.12]">
      {/* Background ring */}
      <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {/* Value arc */}
      <circle
        cx={center} cy={center} r={r}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Inner tick marks */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x1 = center + (r - 3) * Math.cos(angle)
        const y1 = center + (r - 3) * Math.sin(angle)
        const x2 = center + (r - 1) * Math.cos(angle)
        const y2 = center + (r - 1) * Math.sin(angle)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      })}
      {/* Center text */}
      <text x={center} y={center + 3} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
        {Math.round(value * 100)}
      </text>
    </svg>
  )
}

/* ─── HUD: Mini bar chart ─────────────────────────────────────────────────── */

function MiniBarChart({ values = [0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.8, 0.35] }: { values?: number[] }) {
  return (
    <div className="flex items-end gap-[1px] h-4 opacity-[0.10]">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[2px] rounded-[0.5px]"
          style={{
            height: `${v * 100}%`,
            background: `rgba(68, 136, 255, ${0.3 + v * 0.4})`,
          }}
        />
      ))}
    </div>
  )
}

/* ─── HUD: Animated data ticker ───────────────────────────────────────────── */

function DataTicker() {
  const [values, setValues] = useState({ sig: 97.3, lat: 0.0, freq: 42.1, amp: 0.84 })

  useEffect(() => {
    const interval = setInterval(() => {
      setValues({
        sig: 95 + Math.random() * 4.5,
        lat: (Math.random() - 0.5) * 0.4,
        freq: 40 + Math.random() * 5,
        amp: 0.7 + Math.random() * 0.3,
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col gap-1 opacity-[0.10]">
      <div className="text-[7px] font-mono text-white/60 tracking-[0.15em]">SIG {values.sig.toFixed(1)}%</div>
      <div className="text-[7px] font-mono text-white/60 tracking-[0.15em]">DLT {values.lat.toFixed(2)}</div>
      <div className="text-[7px] font-mono text-white/60 tracking-[0.15em]">FRQ {values.freq.toFixed(1)}</div>
      <div className="text-[7px] font-mono text-white/60 tracking-[0.15em]">AMP {values.amp.toFixed(2)}</div>
    </div>
  )
}

/* ─── HUD: Horizontal scan bars ───────────────────────────────────────────── */

function HorizontalScanBars() {
  return (
    <div className="flex flex-col gap-[3px] opacity-[0.08]">
      {[0.6, 0.8, 0.3, 0.9, 0.5].map((w, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="h-[1px] rounded"
            style={{
              width: `${w * 40}px`,
              background: 'rgba(68,136,255,0.5)',
            }}
          />
          <div className="text-[5px] font-mono text-white/30">{(w * 100).toFixed(0)}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Dashboard3D Component ───────────────────────────────────────────────── */

interface Dashboard3DProps {
  onEnter: () => void
  onSelectOption: (option: 'browse' | 'disparity') => void
  isLoading: boolean
}

export default function Dashboard3D({ onSelectOption, isLoading }: Dashboard3DProps) {
  const [showUI, setShowUI] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [zoomTarget, setZoomTarget] = useState<[number, number, number] | null>(null)
  const [fadeOpacity, setFadeOpacity] = useState(0)
  const [uiVisible, setUiVisible] = useState(true)
  const pendingOption = useRef<'browse' | 'disparity' | null>(null)
  const [systemTime, setSystemTime] = useState('')
  const [scanlinePos, setScanlinePos] = useState(0)
  const [frameCount, setFrameCount] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        setShowUI(true)
      }, 600)
    }
  }, [isLoading])

  // System clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setSystemTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      )
      setFrameCount(c => c + 1)
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
    (id: 'browse' | 'disparity') => {
      if (zooming) return
      pendingOption.current = id
      const idx = options.findIndex((o) => o.id === id)
      setZoomTarget(GLOBE_POSITIONS[idx])
      setZooming(true)
      setUiVisible(false)

      playButtonPress()

      // Begin fade overlay
      setTimeout(() => setFadeOpacity(1), 1000)
    },
    [zooming]
  )

  const handleZoomComplete = useCallback(() => {
    setTimeout(() => {
      if (pendingOption.current) {
        onSelectOption(pendingOption.current)
      }
    }, 400)
  }, [onSelectOption])

  return (
    <div className="fixed inset-0 z-50 bg-[#020408] overflow-hidden">
      {/* 3D Canvas — reduced FOV for less perspective distortion */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 9], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <ThreeScene
            onSelect={handleSelect}
            zoomTarget={zoomTarget}
            zooming={zooming}
            onZoomComplete={handleZoomComplete}
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

      {/* ─── System UI Density: HUD elements ──────────────────── */}

      {/* Top-left HUD cluster */}
      <div className="absolute top-14 left-6 flex flex-col gap-3 pointer-events-none z-[8]">
        <OscilloscopeTrace width={100} height={28} />
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-blue-400/20 dashboard-pulse" />
          <span className="text-[6px] font-mono text-white/[0.08] tracking-[0.2em]">WAVEFORM.A</span>
        </div>
        <MiniBarChart />
        <DataTicker />
      </div>

      {/* Top-right HUD cluster */}
      <div className="absolute top-14 right-6 flex flex-col items-end gap-3 pointer-events-none z-[8]">
        <OscilloscopeTrace2 width={80} height={24} />
        <div className="flex items-center gap-2">
          <span className="text-[6px] font-mono text-white/[0.08] tracking-[0.2em]">SIGNAL.B</span>
          <div className="w-1 h-1 rounded-full bg-teal-400/20 dashboard-pulse" />
        </div>
        <HorizontalScanBars />
      </div>

      {/* Left mid: Radial gauge */}
      <div className="absolute left-5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-[8]">
        <RadialGauge size={52} value={0.72} color="rgba(68,136,255,0.35)" />
        <span className="text-[5px] font-mono text-white/[0.07] tracking-[0.25em]">SYS.LOAD</span>
      </div>

      {/* Right mid: Radial gauge */}
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-[8]">
        <RadialGauge size={48} value={0.58} color="rgba(68,204,170,0.3)" />
        <span className="text-[5px] font-mono text-white/[0.07] tracking-[0.25em]">NET.IO</span>
      </div>

      {/* Bottom-left data block */}
      <div className="absolute bottom-14 left-6 flex flex-col gap-1 pointer-events-none z-[8] opacity-[0.08]">
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">PROC 0x{(frameCount * 7 + 4096).toString(16).toUpperCase().slice(-4)}</div>
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">MEM 48.2 / 64.0 GB</div>
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">THR 12 / 16 ACTIVE</div>
      </div>

      {/* Bottom-right data block */}
      <div className="absolute bottom-14 right-6 flex flex-col items-end gap-1 pointer-events-none z-[8] opacity-[0.08]">
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">RENDER 16.7ms</div>
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">DRAW CALLS 342</div>
        <div className="text-[6px] font-mono text-white/60 tracking-[0.2em]">TRI 2.1M</div>
      </div>

      {/* Left edge: vertical micro-labels */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none z-[8]">
        <div className="flex flex-col gap-8 items-center">
          {['A', 'B', 'C', 'D', 'E'].map((label, i) => (
            <span key={i} className="text-[5px] font-mono text-white/[0.06] tracking-[0.1em] -rotate-90">{label}{i + 1}</span>
          ))}
        </div>
      </div>

      {/* Right edge: vertical micro-labels */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none z-[8]">
        <div className="flex flex-col gap-8 items-center">
          {['F', 'G', 'H', 'I', 'J'].map((label, i) => (
            <span key={i} className="text-[5px] font-mono text-white/[0.06] tracking-[0.1em] rotate-90">{label}{i + 6}</span>
          ))}
        </div>
      </div>

      {/* Horizontal grid lines (subtle) */}
      <div className="absolute inset-0 pointer-events-none z-[5]" style={{ opacity: 0.03 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-[1px] bg-white/20"
            style={{ top: `${((i + 1) / 9) * 100}%` }}
          />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-[1px] bg-white/20"
            style={{ left: `${((i + 1) / 13) * 100}%` }}
          />
        ))}
      </div>

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
            <div className="w-px h-3 bg-white/[0.06] mx-1" />
            <span className="text-[8px] font-mono text-white/[0.10] tracking-[0.15em]">
              UPLINK STABLE
            </span>
          </div>

          {/* Right: time + mode */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-green-400/30 dashboard-pulse" />
              <span className="text-[8px] font-mono text-white/[0.10] tracking-[0.15em]">
                ALL SYSTEMS NOMINAL
              </span>
            </div>
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
            <TypewriterText
              text="HUMANITARIAN RESPONSE INTERFACE"
              emphasis="soft"
              delayMs={400}
              charIntervalMs={15}
              className="text-sm font-mono text-white/50 tracking-[0.3em] uppercase"
            />
            <div className="w-6 h-[1px] bg-white/10" />
          </div>

          {/* Main title */}
          <h1
            className="text-6xl font-bold text-white font-rajdhani tracking-[0.12em] leading-none"
            style={{
              textShadow: '0 0 40px rgba(68, 136, 255, 0.08)',
            }}
          >
            <TypewriterText text="HURRICARE" emphasis="headline" delayMs={800} charIntervalMs={80} />
          </h1>

          {/* Subtitle in structured frame */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-3 h-[1px] bg-white/8" />
            <div className="border border-white/[0.06] px-4 py-1">
              <TypewriterText
                text="Global Response Simulation System"
                emphasis="soft"
                delayMs={1600}
                charIntervalMs={20}
                className="text-base font-rajdhani text-white/60 tracking-[0.25em] uppercase"
              />
            </div>
            <div className="w-3 h-[1px] bg-white/8" />
          </div>
        </div>

        {/* Spacer for globes */}
        <div className="flex-1" />

        {/* ─── Globe labels + HUD accents ────────────────────── */}
        {showUI && !isLoading && (
          <div className="mb-6">
            {/* Globe option labels — centered grid matching 3D globe positions */}
            <div className="flex justify-center">
              <div className="flex" style={{ width: '60%', maxWidth: '700px' }}>
                {options.map((option, i) => (
                  <div key={option.id} className="flex-1 text-center dashboard-option-fade" style={{ animationDelay: `${i * 0.12}s` }}>
                    {/* Tag label */}
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-4 h-[1px]" style={{ background: option.color, opacity: 0.4 }} />
                      <span className="text-xs font-mono tracking-[0.25em] uppercase" style={{ color: option.color, opacity: 0.7 }}>
                        {option.tag}
                      </span>
                      <div className="w-4 h-[1px]" style={{ background: option.color, opacity: 0.4 }} />
                    </div>

                    {/* Title */}
                    <div className="text-xl font-rajdhani font-bold text-white/95 tracking-[0.15em]">
                      {option.title}
                    </div>

                    {/* Subtitle */}
                    <div className="text-sm text-white/60 font-rajdhani tracking-wider mt-1">
                      {option.subtitle}
                    </div>

                    {/* Status indicator */}
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full dashboard-pulse"
                        style={{ background: option.color, opacity: 0.7 }}
                      />
                      <span className="text-xs font-mono tracking-[0.2em]" style={{ color: option.color, opacity: 0.6 }}>
                        {option.statusText}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="w-px h-2 bg-white/[0.06] mx-1" />
            <span className="text-[7px] font-mono text-white/[0.08] tracking-[0.1em]">
              BUILD 2847
            </span>
          </div>

          {/* Center prompt */}
          {showUI && (
            <span className="text-base font-rajdhani text-white/60 tracking-[0.15em] dashboard-prompt-fade">
              <TypewriterText text="SELECT A GLOBE TO BEGIN" emphasis="soft" delayMs={2200} charIntervalMs={40} />
            </span>
          )}

          {/* Right data readout */}
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-mono text-white/10 tracking-[0.1em]">
              LAT 0.00 / LON 0.00
            </span>
            <div className="w-px h-2 bg-white/[0.06]" />
            <span className="text-[8px] font-mono text-white/10 tracking-[0.1em]">
              UTC+0
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
                <span className="text-lg font-mono text-white/70 tracking-[0.3em] uppercase">
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

      {/* Extended corner accents — outer corners with subtle tick marks */}
      <div className="absolute top-4 left-4 pointer-events-none z-[8]">
        <div className="absolute top-[14px] left-0 w-[6px] h-[1px] bg-white/[0.04]" />
        <div className="absolute top-0 left-[14px] w-[1px] h-[6px] bg-white/[0.04]" />
      </div>
      <div className="absolute top-4 right-4 pointer-events-none z-[8]">
        <div className="absolute top-[14px] right-0 w-[6px] h-[1px] bg-white/[0.04]" />
        <div className="absolute top-0 right-[14px] w-[1px] h-[6px] bg-white/[0.04]" />
      </div>
      <div className="absolute bottom-4 left-4 pointer-events-none z-[8]">
        <div className="absolute bottom-[14px] left-0 w-[6px] h-[1px] bg-white/[0.04]" />
        <div className="absolute bottom-0 left-[14px] w-[1px] h-[6px] bg-white/[0.04]" />
      </div>
      <div className="absolute bottom-4 right-4 pointer-events-none z-[8]">
        <div className="absolute bottom-[14px] right-0 w-[6px] h-[1px] bg-white/[0.04]" />
        <div className="absolute bottom-0 right-[14px] w-[1px] h-[6px] bg-white/[0.04]" />
      </div>

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
