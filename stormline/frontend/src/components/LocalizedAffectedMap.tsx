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
  const elevationRef = useRef(0)

  // Get country polygon data
  const countryData = useMemo(() => {
    return COUNTRY_POLYGONS.find(c => c.name === countryName)
  }, [countryName])

  // Build geometry for country
  const geometry = useMemo(() => {
    if (!countryData) return null

    const vertices: number[] = []
    const indices: number[] = []

    // Base polygon points (on XZ plane, Y=0)
    const basePoints: THREE.Vector2[] = []
    for (const [lon, lat] of countryData.points) {
      basePoints.push(new THREE.Vector2(lon / 100, lat / 100))
    }

    // Create a simple mesh from country bounds
    if (basePoints.length < 3) return null

    // Top face (elevated)
    for (const point of basePoints) {
      vertices.push(point.x, intensity * 0.3, point.y)
    }

    // Create simple triangulation
    for (let i = 1; i < basePoints.length - 1; i++) {
      indices.push(0, i, i + 1)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [countryData, intensity])

  useFrame(() => {
    if (meshRef.current) {
      const targetElevation = intensity * 0.3
      elevationRef.current += (targetElevation - elevationRef.current) * 0.05
      meshRef.current.position.y = elevationRef.current
    }
  })

  if (!geometry || !countryData) return null

  // Color based on intensity: orange → red
  const hue = (1 - intensity) * 30 // 0 = red, 30 = orange
  const color = new THREE.Color().setHSL(hue / 360, 1, 0.5)

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4 + intensity * 0.6}
        shininess={100}
      />
    </mesh>
  )
}

function BaseMap() {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const size = 20
    return new THREE.PlaneGeometry(size, size)
  }, [])

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <meshPhongMaterial color="#001a4d" side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ affectedRegions, impactIntensity }: { affectedRegions: string[]; impactIntensity: Record<string, number> }) {
  return (
    <>
      <color attach="background" args={['#000010']} />

      {/* Lighting */}
      <ambientLight intensity={0.4} color="#ffffff" />
      <directionalLight position={[5, 10, 7]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-5, 5, -5]} intensity={0.4} color="#ff6b35" />
      <pointLight position={[0, 8, 0]} intensity={0.3} color="#ff6b35" />

      {/* Grid background */}
      <gridHelper args={[20, 20, '#0066cc', '#003366']} position={[0, -0.05, 0]} />

      {/* Base map */}
      <BaseMap />

      {/* Affected regions */}
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
      {/* Canvas */}
      <Canvas
        camera={{
          position: [10, 5, 10],
          fov: 60,
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
            <h1 className="text-5xl font-bold text-glow-cyan font-orbitron mb-2">{title}</h1>
            <p className="text-cyan-300 font-exo text-sm">
              Height represents impact severity • Orange indicates affected areas
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold font-orbitron text-lg transition glow-cyan"
            >
              Continue
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 max-w-xs pointer-events-auto">
          <div className="text-cyan-300 font-orbitron font-semibold mb-3">Impact Severity</div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ff3300' }} />
              <span className="text-cyan-200 font-exo">Critical (0.8-1.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ff6600' }} />
              <span className="text-cyan-200 font-exo">Severe (0.6-0.8)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ff9900' }} />
              <span className="text-cyan-200 font-exo">Moderate (0.4-0.6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ffcc00' }} />
              <span className="text-cyan-200 font-exo">Low (0.2-0.4)</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-cyan-500/30 text-xs text-cyan-300/70 font-exo">
            {affectedRegions.length} regions affected
          </div>
        </div>

        {/* Affected Regions List */}
        <div className="absolute bottom-8 right-8 bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 max-w-sm max-h-64 overflow-y-auto pointer-events-auto">
          <div className="text-cyan-300 font-orbitron font-semibold mb-3">Affected Regions</div>
          <div className="space-y-2">
            {affectedRegions.map(region => (
              <div key={region} className="flex items-center justify-between text-xs">
                <span className="text-cyan-200 font-exo">{region}</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{
                    backgroundColor: new THREE.Color().setHSL((1 - (impactIntensity[region] || 0)) * 30 / 360, 1, 0.5).getStyle()
                  }} />
                  <span className="text-cyan-300 font-orbitron">
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
