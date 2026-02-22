import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { COUNTRY_POLYGONS } from '../data/countries'

interface LocalizedAffectedMapProps {
  affectedRegions: string[]
  impactIntensity: Record<string, number> // 0-1 scale
  title?: string
  onClose?: () => void
}

/**
 * Compute a centered 2D coordinate system for a set of regions.
 * Returns a transform function: (lon, lat) → (x, z) in world units,
 * plus bounds info for camera setup.
 */
function useRegionTransform(affectedRegions: string[]) {
  return useMemo(() => {
    // Collect ALL polygon points for affected regions
    const allPoints: [number, number][] = []
    for (const name of affectedRegions) {
      const polys = COUNTRY_POLYGONS.filter(c => c.name === name)
      for (const p of polys) {
        for (const pt of p.points) allPoints.push(pt)
      }
    }
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

    const cLon = (minLon + maxLon) / 2
    const cLat = (minLat + maxLat) / 2
    const spanLon = maxLon - minLon || 1
    const spanLat = maxLat - minLat || 1
    // Scale so the map fills roughly 10 world units
    const scale = 10 / Math.max(spanLon, spanLat)

    const transform = (lon: number, lat: number): [number, number] => [
      (lon - cLon) * scale,
      (lat - cLat) * scale,
    ]

    return { transform, centerX: 0, centerZ: 0, extent: Math.max(spanLon, spanLat) * scale }
  }, [affectedRegions])
}

function AffectedRegionMesh({
  countryName,
  intensity,
  transform,
}: {
  countryName: string
  intensity: number
  transform: (lon: number, lat: number) => [number, number]
}) {
  const meshRef = useRef<THREE.Group>(null)

  const polygons = useMemo(
    () => COUNTRY_POLYGONS.filter(c => c.name === countryName),
    [countryName],
  )

  const geometries = useMemo(() => {
    const results: { geo: THREE.BufferGeometry; borderPts: THREE.Vector3[] }[] = []
    const extrudeHeight = 0.15 + intensity * 0.85

    for (const poly of polygons) {
      if (poly.points.length < 3) continue

      const pts2D = poly.points.map(([lon, lat]) => {
        const [x, z] = transform(lon, lat)
        return new THREE.Vector2(x, z)
      })

      // Triangulate top face using ShapeUtils
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

      // Top triangles
      for (const [a, b, c] of tris) {
        indices.push(topStart + a, topStart + b, topStart + c)
      }

      // Bottom triangles (reversed)
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

      // Border outline at the top
      const borderPts = pts2D.map(p => new THREE.Vector3(p.x, extrudeHeight + 0.02, p.y))
      borderPts.push(borderPts[0].clone()) // close loop

      results.push({ geo, borderPts })
    }
    return results
  }, [polygons, intensity, transform])

  // Animate elevation in
  useFrame(() => {
    if (meshRef.current) {
      const cur = meshRef.current.scale.y
      const target = 1
      meshRef.current.scale.y = cur + (target - cur) * 0.06
    }
  })

  if (geometries.length === 0) return null

  // Color: orange → red based on intensity
  const hue = (1 - intensity) * 30 / 360
  const color = new THREE.Color().setHSL(hue, 0.9, 0.4)
  const emissiveColor = new THREE.Color().setHSL(hue, 1, 0.3)

  return (
    <group ref={meshRef} scale={[1, 0.01, 1]}>
      {geometries.map(({ geo, borderPts }, i) => (
        <group key={i}>
          <mesh geometry={geo}>
            <meshPhongMaterial
              color={color}
              emissive={emissiveColor}
              emissiveIntensity={0.4 + intensity * 0.6}
              shininess={30}
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
            <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
          </line>
        </group>
      ))}
    </group>
  )
}

function NeighborRegionMesh({
  countryName,
  transform,
}: {
  countryName: string
  transform: (lon: number, lat: number) => [number, number]
}) {
  const polygons = useMemo(
    () => COUNTRY_POLYGONS.filter(c => c.name === countryName),
    [countryName],
  )

  const geometries = useMemo(() => {
    const results: { geo: THREE.BufferGeometry }[] = []
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
      for (const p of pts2D) vertices.push(p.x, 0.01, p.y)
      for (const [a, b, c] of tris) indices.push(a, b, c)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      results.push({ geo })
    }
    return results
  }, [polygons, transform])

  if (geometries.length === 0) return null
  return (
    <>
      {geometries.map(({ geo }, i) => (
        <mesh key={i} geometry={geo}>
          <meshPhongMaterial
            color="#0a1525"
            emissive="#050c18"
            emissiveIntensity={0.3}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  )
}

function Scene({
  affectedRegions,
  impactIntensity,
  transform,
  extent,
}: {
  affectedRegions: string[]
  impactIntensity: Record<string, number>
  transform: (lon: number, lat: number) => [number, number]
  extent: number
}) {
  // Find neighboring countries to show for context
  const neighborNames = useMemo(() => {
    const affected = new Set(affectedRegions)
    // Show a few nearby countries for context (not all 200+)
    const neighbors = new Set<string>()
    for (const poly of COUNTRY_POLYGONS) {
      if (affected.has(poly.name)) continue
      if (neighbors.has(poly.name)) continue
      // Check if any point is within the visible area
      for (const [lon, lat] of poly.points) {
        const [x, z] = transform(lon, lat)
        if (Math.abs(x) < extent * 0.8 && Math.abs(z) < extent * 0.8) {
          neighbors.add(poly.name)
          break
        }
      }
      if (neighbors.size > 20) break
    }
    return Array.from(neighbors)
  }, [affectedRegions, transform, extent])

  const gridSize = Math.ceil(extent * 1.5)

  return (
    <>
      <color attach="background" args={['#020810']} />
      <fog attach="fog" args={['#020810', extent * 0.8, extent * 2.5]} />

      {/* Lighting */}
      <ambientLight intensity={0.15} color="#8090b0" />
      <directionalLight position={[5, 12, 7]} intensity={0.5} color="#ffffff" />
      <pointLight position={[-4, 6, -4]} intensity={0.25} color="#ff6b35" />
      <pointLight position={[4, 4, 4]} intensity={0.15} color="#3355ff" />

      {/* Strategy grid */}
      <gridHelper
        args={[gridSize * 2, gridSize * 4, '#0a1a3a', '#061228']}
        position={[0, -0.005, 0]}
      />

      {/* Dark base plane */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[gridSize * 3, gridSize * 3]} />
        <meshPhongMaterial color="#020a18" side={THREE.DoubleSide} />
      </mesh>

      {/* Neighbor countries (flat, dark, for context) */}
      {neighborNames.map(name => (
        <NeighborRegionMesh key={name} countryName={name} transform={transform} />
      ))}

      {/* Affected regions (extruded, colored) */}
      {affectedRegions.map(region => (
        <AffectedRegionMesh
          key={region}
          countryName={region}
          intensity={impactIntensity[region] || 0.3}
          transform={transform}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.2}
        minDistance={3}
        maxDistance={extent * 3}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
      />
    </>
  )
}

export default function LocalizedAffectedMap({
  affectedRegions,
  impactIntensity,
  title = 'Affected Regions Analysis',
  onClose,
}: LocalizedAffectedMapProps) {
  const { transform, extent } = useRegionTransform(affectedRegions)

  const camDist = Math.max(extent * 0.9, 5)

  return (
    <div className="fixed inset-0 bg-black z-40">
      <Canvas
        camera={{
          position: [camDist * 0.7, camDist * 0.6, camDist * 0.7],
          fov: 50,
          near: 0.1,
          far: 500,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene
          affectedRegions={affectedRegions}
          impactIntensity={impactIntensity}
          transform={transform}
          extent={extent}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Header */}
        <div className="p-8 flex justify-between items-start pointer-events-auto">
          <div>
            <h1 className="text-4xl font-bold text-white font-rajdhani mb-2">{title}</h1>
            <p className="text-white/40 font-rajdhani text-sm">
              Height represents impact severity &bull; Drag to rotate &bull; Scroll to zoom
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold font-rajdhani text-lg transition border border-white/10"
            >
              Continue
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-8 left-8 bg-black/90 border border-white/10 rounded-lg p-4 max-w-xs pointer-events-auto">
          <div className="text-white/70 font-rajdhani font-semibold mb-3">Impact Severity</div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#cc2200' }} />
              <span className="text-white/60 font-rajdhani">Critical (0.8-1.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#cc5500' }} />
              <span className="text-white/60 font-rajdhani">Severe (0.6-0.8)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#cc8800' }} />
              <span className="text-white/60 font-rajdhani">Moderate (0.4-0.6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#ccaa00' }} />
              <span className="text-white/60 font-rajdhani">Low (0.2-0.4)</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/30 font-mono">
            {affectedRegions.length} regions affected
          </div>
        </div>

        {/* Affected Regions List */}
        <div className="absolute bottom-8 right-8 bg-black/90 border border-white/10 rounded-lg p-4 max-w-sm max-h-64 overflow-y-auto pointer-events-auto">
          <div className="text-white/70 font-rajdhani font-semibold mb-3">Affected Regions</div>
          <div className="space-y-2">
            {affectedRegions.map(region => {
              const val = impactIntensity[region] || 0
              const hue = (1 - val) * 30 / 360
              const col = new THREE.Color().setHSL(hue, 0.9, 0.4)
              return (
                <div key={region} className="flex items-center justify-between text-xs">
                  <span className="text-white/60 font-rajdhani">{region}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: `#${col.getHexString()}` }}
                    />
                    <span className="text-white/50 font-mono">
                      {Math.round(val * 100)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
