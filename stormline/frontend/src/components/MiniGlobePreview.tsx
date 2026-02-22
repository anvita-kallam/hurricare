import { useRef, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COUNTRY_POLYGONS } from '../data/countries'
import { getFundingDisparity, disparityToColor } from '../data/fundingDisparity'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const latLonToVec3 = (lat: number, lon: number, R: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(theta),
    R * Math.cos(phi),
    R * Math.sin(phi) * Math.sin(theta)
  )
}

/* ─── Merged country fills (single draw call via vertex colors) ────────────── */

function MergedCountries({ variant, radius }: { variant: 'search' | 'browse' | 'heatmap'; radius: number }) {
  const geometry = useMemo(() => {
    const R = radius * 1.035
    const positions: number[] = []
    const colors: number[] = []

    for (const country of COUNTRY_POLYGONS) {
      let hex = country.color
      if (variant === 'heatmap') {
        hex = disparityToColor(getFundingDisparity(country.name))
      }
      const c = new THREE.Color(hex)

      const shape2D = country.points.map(([lon, lat]) => new THREE.Vector2(lon, lat))
      let tris: number[][]
      try { tris = THREE.ShapeUtils.triangulateShape(shape2D, []) } catch { continue }
      if (!tris.length) continue

      const verts = country.points.map(([lon, lat]) => latLonToVec3(lat, lon, R))

      for (const [a, b, ci] of tris) {
        if (!verts[a] || !verts[b] || !verts[ci]) continue
        positions.push(verts[a].x, verts[a].y, verts[a].z)
        positions.push(verts[b].x, verts[b].y, verts[b].z)
        positions.push(verts[ci].x, verts[ci].y, verts[ci].z)
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geo
  }, [variant, radius])

  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.88}
        side={THREE.DoubleSide}
        depthWrite
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={2}
        polygonOffsetUnits={2}
      />
    </mesh>
  )
}

/* ─── Merged country borders (single draw call) ───────────────────────────── */

function MergedBorders({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const R = radius * 1.038
    const positions: number[] = []

    for (const country of COUNTRY_POLYGONS) {
      const pts = country.points.map(([lon, lat]) => latLonToVec3(lat, lon, R))
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [radius])

  return (
    <lineSegments geometry={geometry} renderOrder={11}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}

/* ─── Atmosphere shell ─────────────────────────────────────────────────────── */

const SHELL_LAYERS = [
  { r: 1.01, color: '#7733ff', opacity: 0.12 },
  { r: 1.03, color: '#6622ee', opacity: 0.09 },
  { r: 1.06, color: '#5511cc', opacity: 0.06 },
  { r: 1.10, color: '#4400aa', opacity: 0.04 },
  { r: 1.17, color: '#330088', opacity: 0.025 },
  { r: 1.26, color: '#220066', opacity: 0.015 },
  { r: 1.40, color: '#160044', opacity: 0.008 },
]

function MiniShell({ radius }: { radius: number }) {
  return (
    <>
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {SHELL_LAYERS.map(({ r, color, opacity }, i) => (
        <mesh key={i} renderOrder={i + 2}>
          <sphereGeometry args={[radius * r, 32, 32]} />
          <meshBasicMaterial
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

/* ─── Sample hurricane tracks for the Browse globe preview ─────────────────── */

const SAMPLE_TRACKS: { lat: number; lon: number }[][] = [
  // Cape Verde hurricane
  [
    { lat: 11, lon: -22 }, { lat: 13, lon: -32 }, { lat: 15, lon: -42 },
    { lat: 17, lon: -52 }, { lat: 19, lon: -60 }, { lat: 22, lon: -67 },
    { lat: 25, lon: -72 }, { lat: 29, lon: -76 }, { lat: 34, lon: -73 },
    { lat: 40, lon: -65 },
  ],
  // Caribbean recurver
  [
    { lat: 10, lon: -28 }, { lat: 12, lon: -38 }, { lat: 14, lon: -48 },
    { lat: 16, lon: -56 }, { lat: 18, lon: -63 }, { lat: 21, lon: -68 },
    { lat: 26, lon: -64 }, { lat: 32, lon: -55 },
  ],
  // Gulf of Mexico
  [
    { lat: 16, lon: -80 }, { lat: 18, lon: -83 }, { lat: 20, lon: -86 },
    { lat: 23, lon: -88 }, { lat: 26, lon: -90 }, { lat: 29, lon: -89 },
    { lat: 31, lon: -87 },
  ],
  // Western Pacific typhoon
  [
    { lat: 8, lon: 158 }, { lat: 11, lon: 150 }, { lat: 14, lon: 142 },
    { lat: 18, lon: 135 }, { lat: 22, lon: 130 }, { lat: 26, lon: 128 },
    { lat: 30, lon: 132 }, { lat: 34, lon: 140 },
  ],
  // Bay of Bengal cyclone
  [
    { lat: 8, lon: 88 }, { lat: 10, lon: 86 }, { lat: 13, lon: 84 },
    { lat: 16, lon: 82 }, { lat: 19, lon: 80 }, { lat: 21, lon: 82 },
  ],
  // South Indian Ocean cyclone
  [
    { lat: -10, lon: 72 }, { lat: -13, lon: 68 }, { lat: -16, lon: 62 },
    { lat: -19, lon: 56 }, { lat: -22, lon: 50 }, { lat: -26, lon: 46 },
  ],
]

const TRACK_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#F7DC6F', '#BB8FCE']

function SamplePaths({ radius }: { radius: number }) {
  const geometries = useMemo(() => {
    const R = radius * 1.06
    return SAMPLE_TRACKS.map((track) => {
      const pts = track.map((p) => latLonToVec3(p.lat, p.lon, R))
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      return new THREE.TubeGeometry(curve, 48, radius * 0.007, 6, false)
    })
  }, [radius])

  return (
    <group>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo} renderOrder={15}>
          <meshBasicMaterial
            color={TRACK_COLORS[i]}
            transparent
            opacity={0.85}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ─── Holographic orbit ring ───────────────────────────────────────────────── */

function OrbitRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius * 1.15, 0.003, 8, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ─── Main MiniGlobePreview ────────────────────────────────────────────────── */

const TILT = 23.4 * (Math.PI / 180) // Earth-like axial tilt
const GLOBE_RADIUS = 0.8

interface MiniGlobePreviewProps {
  variant: 'search' | 'browse' | 'heatmap'
  position: [number, number, number]
  isSelected: boolean
  onClick: () => void
}

export default function MiniGlobePreview({ variant, position, isSelected, onClick }: MiniGlobePreviewProps) {
  const outerRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const { camera, gl } = useThree()

  const isDragging = useRef(false)
  const lastPtr = useRef({ x: 0, y: 0 })
  const dragTotal = useRef(0)

  // Proximity-based scaling + floating bob + auto-spin
  useFrame(({ clock, pointer }) => {
    if (!outerRef.current || !spinRef.current) return

    // Project globe center to NDC for cursor-distance check
    const worldPos = new THREE.Vector3(...position)
    const ndc = worldPos.clone().project(camera)
    const dx = pointer.x - ndc.x
    const dy = pointer.y - ndc.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Quadratic proximity falloff — globe swells as cursor approaches
    const proximity = Math.max(0, 1 - dist / 1.2)
    const proximityBoost = proximity * proximity * 0.25
    const selectedBoost = isSelected ? 0.15 : 0
    const targetScale = 1 + proximityBoost + selectedBoost

    const cur = outerRef.current.scale.x
    outerRef.current.scale.setScalar(cur + (targetScale - cur) * 0.08)

    // Gentle floating bob
    outerRef.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 0.6 + position[0] * 0.5) * 0.06

    // Auto-spin (paused during drag)
    if (!isDragging.current) {
      spinRef.current.rotation.y += 0.004
    }
  })

  // Drag-to-rotate easter egg
  const onDown = useCallback(
    (e: any) => {
      e.stopPropagation()
      isDragging.current = true
      const ne = e.nativeEvent ?? e
      lastPtr.current = { x: ne.clientX, y: ne.clientY }
      dragTotal.current = 0

      const canvas = gl.domElement

      const onMove = (ev: PointerEvent) => {
        if (!isDragging.current || !spinRef.current) return
        const dxPx = ev.clientX - lastPtr.current.x
        const dyPx = ev.clientY - lastPtr.current.y
        spinRef.current.rotation.y += dxPx * 0.008
        spinRef.current.rotation.x = THREE.MathUtils.clamp(
          spinRef.current.rotation.x + dyPx * 0.005,
          -Math.PI / 4,
          Math.PI / 4
        )
        lastPtr.current = { x: ev.clientX, y: ev.clientY }
        dragTotal.current += Math.abs(dxPx) + Math.abs(dyPx)
      }

      const onUp = () => {
        isDragging.current = false
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerup', onUp)
        canvas.style.cursor = ''
        // Only fire click if pointer barely moved (no drag)
        if (dragTotal.current < 5) onClick()
      }

      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerup', onUp)
      canvas.style.cursor = 'grabbing'
    },
    [gl, onClick]
  )

  const ringColor =
    variant === 'search' ? '#4488ff' : variant === 'browse' ? '#44ccaa' : '#ff8844'

  return (
    <group ref={outerRef} position={position}>
      {/* Earth-like axial tilt */}
      <group rotation={[TILT, 0, 0]}>
        {/* Spinnable inner group (auto-rotate + drag) */}
        <group ref={spinRef}>
          <MiniShell radius={GLOBE_RADIUS} />
          <MergedCountries variant={variant} radius={GLOBE_RADIUS} />
          <MergedBorders radius={GLOBE_RADIUS} />
          {variant === 'browse' && <SamplePaths radius={GLOBE_RADIUS} />}
          <OrbitRing radius={GLOBE_RADIUS} color={ringColor} />
        </group>
      </group>

      {/* Invisible hit sphere for pointer interaction */}
      <mesh
        onPointerDown={onDown}
        onPointerOver={() => { if (!isDragging.current) gl.domElement.style.cursor = 'grab' }}
        onPointerOut={() => { if (!isDragging.current) gl.domElement.style.cursor = '' }}
      >
        <sphereGeometry args={[GLOBE_RADIUS * 1.5, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
