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

/* ─── Subdivide triangle and re-project onto sphere for curvature ─────────── */

function subdivideAndProject(
  a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, R: number, depth: number
): THREE.Vector3[][] {
  if (depth <= 0) return [[a, b, c]]

  const ab = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R)
  const bc = b.clone().add(c).multiplyScalar(0.5).normalize().multiplyScalar(R)
  const ca = c.clone().add(a).multiplyScalar(0.5).normalize().multiplyScalar(R)

  return [
    ...subdivideAndProject(a, ab, ca, R, depth - 1),
    ...subdivideAndProject(ab, b, bc, R, depth - 1),
    ...subdivideAndProject(ca, bc, c, R, depth - 1),
    ...subdivideAndProject(ab, bc, ca, R, depth - 1),
  ]
}

/* ─── Merged country fills (single draw call via vertex colors) ────────────── */

function MergedCountries({ variant, radius }: { variant: 'search' | 'browse' | 'heatmap'; radius: number }) {
  const geometry = useMemo(() => {
    const R = radius * 1.002
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

      for (const [ai, bi, ci] of tris) {
        if (!verts[ai] || !verts[bi] || !verts[ci]) continue

        // Subdivide to conform to sphere curvature — 2 levels for mini globes
        const subTris = subdivideAndProject(verts[ai], verts[bi], verts[ci], R, 2)

        for (const [sv0, sv1, sv2] of subTris) {
          positions.push(sv0.x, sv0.y, sv0.z)
          positions.push(sv1.x, sv1.y, sv1.z)
          positions.push(sv2.x, sv2.y, sv2.z)
          colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b)
        }
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [variant, radius])

  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.92}
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
    const R = radius * 1.004
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
      <lineBasicMaterial color="#ffffff" transparent opacity={0.15} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}

/* ─── Latitude/Longitude wireframe overlay ────────────────────────────────── */

function GraticuleOverlay({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const R = radius * 1.001
    const positions: number[] = []
    const segmentCount = 72

    // Latitude lines every 30 degrees
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let i = 0; i < segmentCount; i++) {
        const lon0 = (i / segmentCount) * 360 - 180
        const lon1 = ((i + 1) / segmentCount) * 360 - 180
        const v0 = latLonToVec3(lat, lon0, R)
        const v1 = latLonToVec3(lat, lon1, R)
        positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z)
      }
    }

    // Longitude lines every 30 degrees
    for (let lon = -180; lon < 180; lon += 30) {
      for (let i = 0; i < segmentCount; i++) {
        const lat0 = (i / segmentCount) * 180 - 90
        const lat1 = ((i + 1) / segmentCount) * 180 - 90
        const v0 = latLonToVec3(lat0, lon, R)
        const v1 = latLonToVec3(lat1, lon, R)
        positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [radius])

  return (
    <lineSegments geometry={geometry} renderOrder={9}>
      <lineBasicMaterial color="#4488ff" transparent opacity={0.06} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}

/* ─── Atmosphere shell — improved with rim lighting ──────────────────────── */

const SHELL_LAYERS = [
  { r: 1.008, color: '#4466cc', opacity: 0.10 },
  { r: 1.02,  color: '#3355bb', opacity: 0.08 },
  { r: 1.04,  color: '#2244aa', opacity: 0.06 },
  { r: 1.07,  color: '#1a3399', opacity: 0.04 },
  { r: 1.12,  color: '#112288', opacity: 0.025 },
  { r: 1.20,  color: '#0a1166', opacity: 0.015 },
  { r: 1.32,  color: '#060844', opacity: 0.008 },
]

/* Rim-light shader for atmospheric Fresnel effect */
const rimVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`

const rimFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    rim = pow(rim, 3.0);
    float alpha = rim * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function MiniShell({ radius }: { radius: number }) {
  return (
    <>
      {/* Base dark sphere */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial color="#050510" />
      </mesh>

      {/* Fresnel rim-light atmosphere */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[radius * 1.005, 64, 64]} />
        <shaderMaterial
          vertexShader={rimVertexShader}
          fragmentShader={rimFragmentShader}
          uniforms={{
            uColor: { value: new THREE.Color('#4488ff') },
            uOpacity: { value: 1.2 },
          }}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Traditional atmosphere shells */}
      {SHELL_LAYERS.map(({ r, color, opacity }, i) => (
        <mesh key={i} renderOrder={i + 3}>
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
  [
    { lat: 11, lon: -22 }, { lat: 13, lon: -32 }, { lat: 15, lon: -42 },
    { lat: 17, lon: -52 }, { lat: 19, lon: -60 }, { lat: 22, lon: -67 },
    { lat: 25, lon: -72 }, { lat: 29, lon: -76 }, { lat: 34, lon: -73 },
    { lat: 40, lon: -65 },
  ],
  [
    { lat: 10, lon: -28 }, { lat: 12, lon: -38 }, { lat: 14, lon: -48 },
    { lat: 16, lon: -56 }, { lat: 18, lon: -63 }, { lat: 21, lon: -68 },
    { lat: 26, lon: -64 }, { lat: 32, lon: -55 },
  ],
  [
    { lat: 16, lon: -80 }, { lat: 18, lon: -83 }, { lat: 20, lon: -86 },
    { lat: 23, lon: -88 }, { lat: 26, lon: -90 }, { lat: 29, lon: -89 },
    { lat: 31, lon: -87 },
  ],
  [
    { lat: 8, lon: 158 }, { lat: 11, lon: 150 }, { lat: 14, lon: 142 },
    { lat: 18, lon: 135 }, { lat: 22, lon: 130 }, { lat: 26, lon: 128 },
    { lat: 30, lon: 132 }, { lat: 34, lon: 140 },
  ],
  [
    { lat: 8, lon: 88 }, { lat: 10, lon: 86 }, { lat: 13, lon: 84 },
    { lat: 16, lon: 82 }, { lat: 19, lon: 80 }, { lat: 21, lon: 82 },
  ],
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
      <torusGeometry args={[radius * 1.15, 0.002, 8, 128]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ─── Data arc lines — subtle orbital data indicators ─────────────────────── */

function DataArcs({ radius, color }: { radius: number; color: string }) {
  const geometry = useMemo(() => {
    const R = radius * 1.08
    const positions: number[] = []

    // 3 subtle arcs at different angles
    const arcs = [
      { tilt: 0.3, offset: 0, span: Math.PI * 0.4 },
      { tilt: -0.2, offset: Math.PI * 0.7, span: Math.PI * 0.3 },
      { tilt: 0.5, offset: Math.PI * 1.4, span: Math.PI * 0.35 },
    ]

    for (const arc of arcs) {
      const segs = 32
      for (let i = 0; i < segs; i++) {
        const t0 = arc.offset + (i / segs) * arc.span
        const t1 = arc.offset + ((i + 1) / segs) * arc.span

        const v0 = new THREE.Vector3(
          R * Math.cos(t0),
          R * Math.sin(arc.tilt) * Math.sin(t0),
          R * Math.sin(t0) * Math.cos(arc.tilt)
        )
        const v1 = new THREE.Vector3(
          R * Math.cos(t1),
          R * Math.sin(arc.tilt) * Math.sin(t1),
          R * Math.sin(t1) * Math.cos(arc.tilt)
        )

        positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [radius])

  return (
    <lineSegments geometry={geometry} renderOrder={13}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.08}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
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
    const proximityBoost = proximity * proximity * 0.2
    const selectedBoost = isSelected ? 0.12 : 0
    const targetScale = 1 + proximityBoost + selectedBoost

    const cur = outerRef.current.scale.x
    outerRef.current.scale.setScalar(cur + (targetScale - cur) * 0.08)

    // Gentle floating bob
    outerRef.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 0.5 + position[0] * 0.5) * 0.04

    // Slow deliberate auto-spin (paused during drag)
    if (!isDragging.current) {
      spinRef.current.rotation.y += 0.002
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
          <GraticuleOverlay radius={GLOBE_RADIUS} />
          <MergedCountries variant={variant} radius={GLOBE_RADIUS} />
          <MergedBorders radius={GLOBE_RADIUS} />
          {variant === 'browse' && <SamplePaths radius={GLOBE_RADIUS} />}
          <OrbitRing radius={GLOBE_RADIUS} color={ringColor} />
          <DataArcs radius={GLOBE_RADIUS} color={ringColor} />
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
