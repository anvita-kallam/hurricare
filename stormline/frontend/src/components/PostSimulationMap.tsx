import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, Coverage } from '../state/useStore'
import { COUNTRY_POLYGONS } from '../data/countries'
import { resolveRegion } from '../utils/regionRegistry'

// ─── Coordinate Transform ─────────────────────────────────────────────────────

function useRegionTransform(affectedRegions: string[]) {
  return useMemo(() => {
    const allPoints: [number, number][] = []
    for (const name of affectedRegions) {
      const resolved = resolveRegion(name)
      const polys = COUNTRY_POLYGONS.filter(c => c.name === resolved || c.name === name)
      for (const p of polys) {
        for (const pt of p.points) allPoints.push(pt)
      }
    }

    // Also include neighbor context
    if (allPoints.length === 0) {
      return {
        transform: (lon: number, lat: number) => [lon, lat] as [number, number],
        centerX: 0,
        centerZ: 0,
        extent: 10,
      }
    }

    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity
    for (const [lon, lat] of allPoints) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }

    // Add padding for surrounding context
    const padding = Math.max(maxLon - minLon, maxLat - minLat) * 0.3
    minLon -= padding
    maxLon += padding
    minLat -= padding
    maxLat += padding

    const cLon = (minLon + maxLon) / 2
    const cLat = (minLat + maxLat) / 2
    const spanLon = maxLon - minLon || 1
    const spanLat = maxLat - minLat || 1
    const scale = 12 / Math.max(spanLon, spanLat)

    const transform = (lon: number, lat: number): [number, number] => [
      -(lon - cLon) * scale,
      (lat - cLat) * scale,
    ]

    return { transform, centerX: 0, centerZ: 0, extent: Math.max(spanLon, spanLat) * scale }
  }, [affectedRegions])
}

// ─── Region Centroid ───────────────────────────────────────────────────────────

function getRegionCentroid(countryName: string, transform: (lon: number, lat: number) => [number, number]): [number, number] | null {
  const resolved = resolveRegion(countryName)
  const polys = COUNTRY_POLYGONS.filter(c => c.name === resolved || c.name === countryName)
  if (polys.length === 0) return null

  // Use the largest polygon
  const largest = polys.reduce((best, p) => p.points.length > best.points.length ? p : best, polys[0])
  let sumLon = 0, sumLat = 0
  for (const [lon, lat] of largest.points) {
    sumLon += lon
    sumLat += lat
  }
  const avgLon = sumLon / largest.points.length
  const avgLat = sumLat / largest.points.length
  return transform(avgLon, avgLat)
}

// ─── Affected Region Mesh (Red-weighted) ───────────────────────────────────────

function AffectedRegionMesh({
  countryName,
  severity,
  coverageRatio,
  transform,
}: {
  countryName: string
  severity: number
  coverageRatio: number
  transform: (lon: number, lat: number) => [number, number]
}) {
  const meshRef = useRef<THREE.Group>(null)

  const polygons = useMemo(() => {
    const resolved = resolveRegion(countryName)
    return COUNTRY_POLYGONS.filter(c => c.name === resolved || c.name === countryName)
  }, [countryName])

  const geometries = useMemo(() => {
    const results: { geo: THREE.BufferGeometry; borderPts: THREE.Vector3[] }[] = []
    const extrudeHeight = 0.12 + severity * 0.6

    for (const poly of polygons) {
      if (poly.points.length < 3) continue

      const pts2D = poly.points.map(([lon, lat]) => {
        const [x, z] = transform(lon, lat)
        return new THREE.Vector2(x, z)
      })

      const tris = THREE.ShapeUtils.triangulateShape(pts2D, [])
      if (tris.length === 0) continue

      const vertices: number[] = []
      const indices: number[] = []

      // Top face
      const topStart = 0
      for (const p of pts2D) vertices.push(p.x, extrudeHeight, p.y)

      // Bottom face
      const bottomStart = pts2D.length
      for (const p of pts2D) vertices.push(p.x, 0, p.y)

      for (const [a, b, c] of tris) {
        indices.push(topStart + a, topStart + b, topStart + c)
      }
      for (const [a, b, c] of tris) {
        indices.push(bottomStart + a, bottomStart + c, bottomStart + b)
      }

      // Side faces
      for (let i = 0; i < pts2D.length; i++) {
        const next = (i + 1) % pts2D.length
        indices.push(topStart + i, bottomStart + i, bottomStart + next)
        indices.push(topStart + i, bottomStart + next, topStart + next)
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      const borderPts = pts2D.map(p => new THREE.Vector3(p.x, extrudeHeight + 0.015, p.y))
      borderPts.push(borderPts[0].clone())

      results.push({ geo, borderPts })
    }
    return results
  }, [polygons, severity, transform])

  // Animate elevation in
  useFrame(() => {
    if (meshRef.current) {
      const cur = meshRef.current.scale.y
      meshRef.current.scale.y = cur + (1 - cur) * 0.04
    }
  })

  if (geometries.length === 0) return null

  // Red-weighted color based on severity
  const r = 0.35 + severity * 0.55
  const g = 0.06 + (1 - severity) * 0.08
  const b = 0.08 + (1 - severity) * 0.06
  const color = new THREE.Color(r, g, b)
  const emissive = new THREE.Color(r * 0.5, g * 0.15, b * 0.1)

  return (
    <group ref={meshRef} scale={[1, 0.01, 1]}>
      {geometries.map(({ geo, borderPts }, i) => (
        <group key={i}>
          <mesh geometry={geo}>
            <meshPhongMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.5}
              shininess={20}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Top border outline */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={borderPts.length}
                array={new Float32Array(borderPts.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ff4444" transparent opacity={0.5} />
          </line>
        </group>
      ))}
    </group>
  )
}

// ─── Surrounding / Support Region Mesh (Blue-weighted) ─────────────────────────

function SupportRegionMesh({
  countryName,
  transform,
}: {
  countryName: string
  transform: (lon: number, lat: number) => [number, number]
}) {
  const meshRef = useRef<THREE.Group>(null)

  const polygons = useMemo(() => {
    const resolved = resolveRegion(countryName)
    return COUNTRY_POLYGONS.filter(c => c.name === resolved || c.name === countryName)
  }, [countryName])

  const geometries = useMemo(() => {
    const results: { geo: THREE.BufferGeometry; borderPts: THREE.Vector3[] }[] = []
    const extrudeHeight = 0.04

    for (const poly of polygons) {
      if (poly.points.length < 3) continue
      const pts2D = poly.points.map(([lon, lat]) => {
        const [x, z] = transform(lon, lat)
        return new THREE.Vector2(x, z)
      })
      const tris = THREE.ShapeUtils.triangulateShape(pts2D, [])
      if (tris.length === 0) continue

      const vertices: number[] = []
      const indices: number[] = []

      const topStart = 0
      for (const p of pts2D) vertices.push(p.x, extrudeHeight, p.y)
      const bottomStart = pts2D.length
      for (const p of pts2D) vertices.push(p.x, 0, p.y)

      for (const [a, b, c] of tris) indices.push(topStart + a, topStart + b, topStart + c)
      for (const [a, b, c] of tris) indices.push(bottomStart + a, bottomStart + c, bottomStart + b)

      for (let i = 0; i < pts2D.length; i++) {
        const next = (i + 1) % pts2D.length
        indices.push(topStart + i, bottomStart + i, bottomStart + next)
        indices.push(topStart + i, bottomStart + next, topStart + next)
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      const borderPts = pts2D.map(p => new THREE.Vector3(p.x, extrudeHeight + 0.005, p.y))
      borderPts.push(borderPts[0].clone())

      results.push({ geo, borderPts })
    }
    return results
  }, [polygons, transform])

  // Animate in
  useFrame(() => {
    if (meshRef.current) {
      const cur = meshRef.current.scale.y
      meshRef.current.scale.y = cur + (1 - cur) * 0.04
    }
  })

  if (geometries.length === 0) return null

  return (
    <group ref={meshRef} scale={[1, 0.01, 1]}>
      {geometries.map(({ geo, borderPts }, i) => (
        <group key={i}>
          <mesh geometry={geo}>
            <meshPhongMaterial
              color="#0c1e3a"
              emissive="#061430"
              emissiveIntensity={0.4}
              shininess={15}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={borderPts.length}
                array={new Float32Array(borderPts.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#1a3a6a" transparent opacity={0.35} />
          </line>
        </group>
      ))}
    </group>
  )
}

// ─── Signal Node (Marker) ──────────────────────────────────────────────────────

function SignalNode({
  position,
  severity,
  coverageRatio,
  label,
  peopleInNeed,
}: {
  position: [number, number]
  severity: number
  coverageRatio: number
  label: string
  peopleInNeed: number
}) {
  const ringRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const height = 0.12 + severity * 0.6 + 0.05
  const nodeSize = 0.08 + severity * 0.12

  // Subtle pulse on state change
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.5 + severity * 5) * 0.04
      ringRef.current.scale.set(pulse, pulse, pulse)
    }
  })

  const ringColor = coverageRatio > 0.5 ? '#3388cc' : '#cc3333'

  return (
    <group position={[position[0], height, position[1]]}>
      {/* Core dot */}
      <mesh>
        <circleGeometry args={[nodeSize * 0.3, 24]} />
        <meshBasicMaterial
          color={coverageRatio > 0.5 ? '#4499dd' : '#dd4444'}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <ringGeometry args={[nodeSize * 0.5, nodeSize * 0.7, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={hovered ? 0.9 : 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Second ring (wider, fainter) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[nodeSize * 0.85, nodeSize * 0.95, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vertical stem connecting to surface */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, 0, -0.05, 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={ringColor} transparent opacity={0.3} />
      </line>

      {/* Label */}
      <Html
        position={[0, nodeSize + 0.15, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: hovered ? 'auto' : 'none' }}
      >
        <div
          style={{
            background: hovered ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.7)',
            border: `1px solid ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '4px',
            padding: hovered ? '8px 12px' : '3px 8px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: hovered ? '12px' : '10px',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            {label}
          </div>
          {hovered && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ color: 'rgba(255,120,120,0.9)', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
                Severity: {(severity * 10).toFixed(1)}
              </div>
              <div style={{ color: 'rgba(120,180,255,0.9)', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
                Coverage: {(coverageRatio * 100).toFixed(1)}%
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
                Need: {peopleInNeed.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ─── Connection Lines ──────────────────────────────────────────────────────────

function ConnectionLines({
  centroids,
  coverageData,
}: {
  centroids: { name: string; pos: [number, number]; severity: number }[]
  coverageData: Record<string, Coverage>
}) {
  const lines = useMemo(() => {
    if (centroids.length < 2) return []

    const result: { start: [number, number]; end: [number, number]; opacity: number }[] = []

    // Connect regions that share resource dependency (based on severity proximity)
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        const a = centroids[i]
        const b = centroids[j]

        // Distance between centroids
        const dx = a.pos[0] - b.pos[0]
        const dz = a.pos[1] - b.pos[1]
        const dist = Math.sqrt(dx * dx + dz * dz)

        // Only connect nearby regions (within reasonable distance)
        if (dist < 6) {
          const severitySum = a.severity + b.severity
          const opacity = Math.min(0.3, severitySum * 0.12)
          result.push({ start: a.pos, end: b.pos, opacity })
        }
      }
    }

    return result
  }, [centroids, coverageData])

  return (
    <group>
      {lines.map((line, idx) => {
        const heightA = 0.12 + 0.3
        const heightB = 0.12 + 0.3
        const midHeight = Math.max(heightA, heightB) + 0.15

        // Curved line through midpoint
        const points = [
          new THREE.Vector3(line.start[0], heightA, line.start[1]),
          new THREE.Vector3(
            (line.start[0] + line.end[0]) / 2,
            midHeight,
            (line.start[1] + line.end[1]) / 2,
          ),
          new THREE.Vector3(line.end[0], heightB, line.end[1]),
        ]

        const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2])
        const curvePoints = curve.getPoints(20)

        return (
          <line key={idx}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={curvePoints.length}
                array={new Float32Array(curvePoints.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#3366aa"
              transparent
              opacity={line.opacity}
            />
          </line>
        )
      })}
    </group>
  )
}

// ─── Camera Controller ─────────────────────────────────────────────────────────

function MapCameraController({ extent }: { extent: number }) {
  const ctrlRef = useRef<any>(null)
  const { camera } = useThree()

  useEffect(() => {
    const dist = Math.max(extent * 0.85, 6)
    camera.position.set(dist * 0.5, dist * 0.7, dist * 0.5)
    camera.lookAt(0, 0, 0)
  }, [extent, camera])

  return (
    <OrbitControls
      ref={ctrlRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      maxPolarAngle={Math.PI / 2.3}
      minPolarAngle={0.15}
      minDistance={3}
      maxDistance={extent * 3}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      zoomSpeed={0.6}
      target={[0, 0, 0]}
    />
  )
}

// ─── Main Scene ────────────────────────────────────────────────────────────────

function MapScene({
  affectedRegions,
  coverageData,
  transform,
  extent,
}: {
  affectedRegions: string[]
  coverageData: Record<string, Coverage>
  transform: (lon: number, lat: number) => [number, number]
  extent: number
}) {
  const affectedSet = useMemo(() => new Set(affectedRegions), [affectedRegions])

  // Find neighboring countries for context
  const neighborNames = useMemo(() => {
    const neighbors = new Set<string>()
    for (const poly of COUNTRY_POLYGONS) {
      if (affectedSet.has(poly.name)) continue
      if (neighbors.has(poly.name)) continue
      for (const [lon, lat] of poly.points) {
        const [x, z] = transform(lon, lat)
        if (Math.abs(x) < extent * 0.7 && Math.abs(z) < extent * 0.7) {
          neighbors.add(poly.name)
          break
        }
      }
      if (neighbors.size > 25) break
    }
    return Array.from(neighbors)
  }, [affectedSet, transform, extent])

  // Compute centroids for signal nodes
  const regionCentroids = useMemo(() => {
    return affectedRegions.map(name => {
      const centroid = getRegionCentroid(name, transform)
      const cov = coverageData[name]
      return {
        name,
        pos: centroid || [0, 0] as [number, number],
        severity: cov?.severity_index ? Math.min(cov.severity_index / 10, 1) : 0.5,
        coverageRatio: cov?.coverage_ratio || 0,
        peopleInNeed: cov?.people_in_need || 0,
      }
    }).filter(r => r.pos !== null)
  }, [affectedRegions, coverageData, transform])

  const gridSize = Math.ceil(extent * 1.5)

  return (
    <>
      <color attach="background" args={['#020810']} />
      <fog attach="fog" args={['#020810', extent * 1.0, extent * 3.0]} />

      {/* Lighting - subdued, tactical */}
      <ambientLight intensity={0.12} color="#8090b0" />
      <directionalLight position={[5, 15, 7]} intensity={0.4} color="#ffffff" />
      <pointLight position={[-4, 8, -4]} intensity={0.15} color="#cc4422" />
      <pointLight position={[4, 6, 4]} intensity={0.12} color="#2244aa" />

      {/* Strategy grid - subtle tactical overlay */}
      <gridHelper
        args={[gridSize * 2, gridSize * 4, '#0a1a3a', '#061228']}
        position={[0, -0.005, 0]}
      />

      {/* Dark base plane */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[gridSize * 3, gridSize * 3]} />
        <meshPhongMaterial color="#020a18" side={THREE.DoubleSide} />
      </mesh>

      {/* Surrounding / support regions (blue-weighted, flat) */}
      {neighborNames.map(name => (
        <SupportRegionMesh key={name} countryName={name} transform={transform} />
      ))}

      {/* Affected regions (red-weighted, extruded by severity) */}
      {affectedRegions.map(region => {
        const cov = coverageData[region]
        const severity = cov?.severity_index ? Math.min(cov.severity_index / 10, 1) : 0.5
        const coverageRatio = cov?.coverage_ratio || 0
        return (
          <AffectedRegionMesh
            key={region}
            countryName={region}
            severity={severity}
            coverageRatio={coverageRatio}
            transform={transform}
          />
        )
      })}

      {/* Signal nodes at region centroids */}
      {regionCentroids.map(r => (
        <SignalNode
          key={r.name}
          position={r.pos}
          severity={r.severity}
          coverageRatio={r.coverageRatio}
          label={r.name}
          peopleInNeed={r.peopleInNeed}
        />
      ))}

      {/* Connection lines between related regions */}
      <ConnectionLines
        centroids={regionCentroids}
        coverageData={coverageData}
      />

      <MapCameraController extent={extent} />
    </>
  )
}

// ─── Exported Component ────────────────────────────────────────────────────────

interface PostSimulationMapProps {
  transitionPhase: 'entering' | 'active'
}

export default function PostSimulationMap({ transitionPhase }: PostSimulationMapProps) {
  const { selectedHurricane, coverage } = useStore()
  const [opacity, setOpacity] = useState(0)

  // Fade in
  useEffect(() => {
    if (transitionPhase === 'entering') {
      const timer = setTimeout(() => setOpacity(1), 50)
      return () => clearTimeout(timer)
    } else {
      setOpacity(1)
    }
  }, [transitionPhase])

  // Get affected regions from hurricane data, resolved through registry
  const affectedRegions = useMemo(() => {
    if (!selectedHurricane) return []
    return (selectedHurricane.affected_countries || []).map(r => resolveRegion(r))
  }, [selectedHurricane])

  // Build coverage lookup
  const coverageData = useMemo(() => {
    if (!selectedHurricane) return {}
    const result: Record<string, Coverage> = {}
    coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .forEach(c => {
        result[c.admin1] = c
      })
    return result
  }, [selectedHurricane, coverage])

  const { transform, extent } = useRegionTransform(affectedRegions)

  const camDist = Math.max(extent * 0.85, 6)

  if (!selectedHurricane || affectedRegions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#020810]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span className="text-sm font-mono text-white/30 tracking-[0.3em] uppercase">Initializing Map</span>
          </div>
          <div className="w-32 h-[1px] bg-white/[0.06] relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-white/20" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full relative"
      style={{
        opacity,
        transition: 'opacity 0.8s ease-in',
      }}
    >
      <Canvas
        camera={{
          position: [camDist * 0.5, camDist * 0.7, camDist * 0.5],
          fov: 50,
          near: 0.1,
          far: 500,
        }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <MapScene
          affectedRegions={affectedRegions}
          coverageData={coverageData}
          transform={transform}
          extent={extent}
        />
      </Canvas>

      {/* Clean map only — no overlays. The immersive panel system provides all UI. */}
    </div>
  )
}
