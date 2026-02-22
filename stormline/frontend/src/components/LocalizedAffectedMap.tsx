import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COUNTRY_POLYGONS } from '../data/countries'

interface LocalizedAffectedMapProps {
  affectedRegions: string[]
  impactIntensity: Record<string, number> // 0-1 scale
  title?: string
  onClose?: () => void
}

function AffectedRegionMesh({ countryName, intensity }: { countryName: string; intensity: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const countryData = useMemo(() => {
    return COUNTRY_POLYGONS.find(c => c.name === countryName)
  }, [countryName])

  // Build extruded geometry: height = severity/impact
  const geometry = useMemo(() => {
    if (!countryData) return null

    const basePoints: THREE.Vector2[] = []
    for (const [lon, lat] of countryData.points) {
      basePoints.push(new THREE.Vector2(lon / 100, lat / 100))
    }

    if (basePoints.length < 3) return null

    const extrudeHeight = intensity * 0.5

    const vertices: number[] = []
    const indices: number[] = []

    // Top face (elevated)
    const topStart = 0
    for (const point of basePoints) {
      vertices.push(point.x, extrudeHeight, point.y)
    }

    // Bottom face
    const bottomStart = basePoints.length
    for (const point of basePoints) {
      vertices.push(point.x, 0, point.y)
    }

    // Triangulate top face
    for (let i = 1; i < basePoints.length - 1; i++) {
      indices.push(topStart, topStart + i, topStart + i + 1)
    }

    // Triangulate bottom face (reversed winding)
    for (let i = 1; i < basePoints.length - 1; i++) {
      indices.push(bottomStart, bottomStart + i + 1, bottomStart + i)
    }

    // Side faces connecting top and bottom
    for (let i = 0; i < basePoints.length; i++) {
      const next = (i + 1) % basePoints.length
      indices.push(topStart + i, bottomStart + i, bottomStart + next)
      indices.push(topStart + i, bottomStart + next, topStart + next)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [countryData, intensity])

  // Animate elevation in
  useFrame(() => {
    if (meshRef.current) {
      const cur = meshRef.current.scale.y
      meshRef.current.scale.y = cur + (1 - cur) * 0.05
    }
  })

  if (!geometry || !countryData) return null

  // Color: orange → red based on intensity
  const hue = (1 - intensity) * 30 / 360
  const color = new THREE.Color().setHSL(hue, 1, 0.45)

  return (
    <mesh ref={meshRef} geometry={geometry} scale={[1, 0.01, 1]}>
      <meshPhongMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5 + intensity * 0.5}
        shininess={40}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

function BaseMap() {
  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshPhongMaterial color="#000a1a" side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ affectedRegions, impactIntensity }: { affectedRegions: string[]; impactIntensity: Record<string, number> }) {
  return (
    <>
      {/* Dark navy background */}
      <color attach="background" args={['#000610']} />

      {/* Static lighting */}
      <ambientLight intensity={0.3} color="#ffffff" />
      <directionalLight position={[5, 10, 7]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-5, 5, -5]} intensity={0.3} color="#ff6b35" />

      {/* Strategy-game grid */}
      <gridHelper args={[20, 40, '#0a1a3a', '#061228']} position={[0, -0.005, 0]} />

      {/* Dark navy base */}
      <BaseMap />

      {/* Extruded affected regions */}
      {affectedRegions.map(region => (
        <AffectedRegionMesh
          key={region}
          countryName={region}
          intensity={impactIntensity[region] || 0}
        />
      ))}
    </>
  )
}

export default function LocalizedAffectedMap({
  affectedRegions,
  impactIntensity,
  title = 'Affected Regions Analysis',
  onClose
}: LocalizedAffectedMapProps) {
  return (
    <div className="fixed inset-0 bg-black z-40">
      {/* 3D Canvas — fixed camera angle, no lerp, no sweep */}
      <Canvas
        camera={{
          position: [8, 6, 8],
          fov: 55,
          near: 0.1,
          far: 1000
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene affectedRegions={affectedRegions} impactIntensity={impactIntensity} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Header */}
        <div className="p-8 flex justify-between items-start pointer-events-auto">
          <div>
            <h1 className="text-4xl font-bold text-white font-rajdhani mb-2">{title}</h1>
            <p className="text-white/40 font-rajdhani text-sm">
              Height represents impact severity &bull; Orange to red indicates affected areas
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
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#ff3300' }} />
              <span className="text-white/60 font-rajdhani">Critical (0.8-1.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#ff6600' }} />
              <span className="text-white/60 font-rajdhani">Severe (0.6-0.8)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#ff9900' }} />
              <span className="text-white/60 font-rajdhani">Moderate (0.4-0.6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: '#ffcc00' }} />
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
            {affectedRegions.map(region => (
              <div key={region} className="flex items-center justify-between text-xs">
                <span className="text-white/60 font-rajdhani">{region}</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{
                    backgroundColor: new THREE.Color().setHSL((1 - (impactIntensity[region] || 0)) * 30 / 360, 1, 0.45).getStyle()
                  }} />
                  <span className="text-white/50 font-mono">
                    {Math.round((impactIntensity[region] || 0) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
