import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playButtonPress } from '../../audio/SoundEngine'

interface CountryData {
  name: string
  color: string
  points: [number, number][]
}

interface CountryMeshProps {
  country: CountryData
  radius: number
  selected: boolean
  globalSelected: boolean
  mouseOnGlobe: React.MutableRefObject<THREE.Vector3 | null>
  onSelect: (name: string) => void
  hoverEnabled?: boolean
}

const latLonToVec3 = (lat: number, lon: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

const sphereSubdivide = (v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3, R: number, depth: number, positions: number[], indices: number[]) => {
  if (depth === 0) {
    const base = positions.length / 3
    positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
    indices.push(base, base + 1, base + 2)
    return
  }
  const mid = (a: THREE.Vector3, b: THREE.Vector3) =>
    new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
      .normalize().multiplyScalar(R)
  const m01 = mid(v0, v1)
  const m12 = mid(v1, v2)
  const m02 = mid(v0, v2)
  sphereSubdivide(v0, m01, m02, R, depth - 1, positions, indices)
  sphereSubdivide(m01, v1, m12, R, depth - 1, positions, indices)
  sphereSubdivide(m02, m12, v2, R, depth - 1, positions, indices)
  sphereSubdivide(m01, m02, m12, R, depth - 1, positions, indices)
}

// Explicit radius constants for layering
const COUNTRY_SURFACE_R = 1.035 // Country fills ~1.03-1.04
const BORDER_LINE_R = 1.038    // Borders slightly above country fill
const BORDER_TUBE_R = 1.039    // Selected border tube above line borders

const buildCountryGeometry = (points: [number, number][], _radius: number, countryName: string) => {
  const R = COUNTRY_SURFACE_R

  // Ensure we have valid points
  if (!points || points.length < 3) {
    // Return a fallback minimal geometry for malformed countries
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(
      [1, 0, 0, 0, 1, 0, 0, 0, 1], 3
    ))
    geo.setIndex([0, 1, 2])
    return geo
  }

  try {
    const shape2D = points.map(([lon, lat]) => new THREE.Vector2(lon, lat))
    const tris = THREE.ShapeUtils.triangulateShape(shape2D, [])

    // Handle empty triangulation
    if (!tris || tris.length === 0) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(
        points.flatMap(([lon, lat]) => {
          const v = latLonToVec3(lat, lon, R)
          return [v.x, v.y, v.z]
        }), 3
      ))
      return geo
    }

    const verts = points.map(([lon, lat]) => latLonToVec3(lat, lon, R))

    const positions: number[] = []
    const indices: number[] = []
    const subdivisionDepth = countryName === 'Russia' ? 4 : 1
    for (const [a, b, c] of tris)
      sphereSubdivide(verts[a], verts[b], verts[c], R, subdivisionDepth, positions, indices)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  } catch (error) {
    console.error(`Error building geometry for ${countryName}:`, error)
    // Return fallback geometry
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(
      [1, 0, 0, 0, 1, 0, 0, 0, 1], 3
    ))
    geo.setIndex([0, 1, 2])
    return geo
  }
}

const buildBorderTube = (points: [number, number][]) => {
  const R = BORDER_TUBE_R
  const pts = points.map(([lon, lat]) => latLonToVec3(lat, lon, R))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
  const segments = Math.min(pts.length * 2, 500)
  return new THREE.TubeGeometry(curve, segments, 0.006, 5, true)
}

export default function CountryMesh({ country, radius, selected, globalSelected, onSelect, mouseOnGlobe, hoverEnabled = false }: CountryMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const borderRef = useRef<THREE.LineLoop>(null)
  const tubeRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(
    () => buildCountryGeometry(country.points, radius, country.name),
    [country.points, radius, country.name]
  )

  const borderGeoThin = useMemo(() => {
    try {
      if (!country.points || country.points.length < 2) {
        return new THREE.BufferGeometry()
      }
      const pts = country.points.map(([lon, lat]) => latLonToVec3(lat, lon, BORDER_LINE_R))
      return new THREE.BufferGeometry().setFromPoints(pts)
    } catch (error) {
      console.error(`Error building border geometry for ${country.name}:`, error)
      return new THREE.BufferGeometry()
    }
  }, [country.points, country.name])

  const borderTube = useMemo(
    () => selected ? buildBorderTube(country.points) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected && country.points]
  )

  const centroid = useMemo(() => {
    const sum = country.points.reduce((acc, [lon, lat]) => {
      const v = latLonToVec3(lat, lon, 1)
      return [acc[0] + v.x, acc[1] + v.y, acc[2] + v.z]
    }, [0, 0, 0])
    return new THREE.Vector3(...sum).normalize()
  }, [country.points])

  useFrame(() => {
    if (!meshRef.current) return

    // Default: no elevation
    let target = 1.0

    if (hoverEnabled && !globalSelected && mouseOnGlobe.current) {
      // Only in funding disparity mode: subtle highlight (no breathing/pulsing)
      const dot = centroid.dot(mouseOnGlobe.current)
      const d = (1 - dot) / 2
      const boost = Math.exp(-d * 4) * 0.03
      target = 1.0 + boost
    } else if (selected) {
      target = 1.02
    }

    const cur = meshRef.current.scale.x
    const next = cur + (target - cur) * 0.18
    meshRef.current.scale.set(next, next, next)
    if (borderRef.current) borderRef.current.scale.set(next, next, next)
    if (tubeRef.current) tubeRef.current.scale.set(next, next, next)
  })

  // Use the country color directly (funding disparity overrides in GlobeScene)
  const fillColor = selected ? '#0e2f7a' : country.color

  return (
    <>
      {/* Country fill — renderOrder 10 */}
      <mesh ref={meshRef} geometry={geometry}
        onClick={(e) => { e.stopPropagation(); playButtonPress(); onSelect(country.name) }}
        renderOrder={10}
      >
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={selected ? 0.92 : 0.88}
          side={THREE.DoubleSide}
          depthWrite={true}
          depthTest={true}
          toneMapped={false}
          polygonOffset={true}
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>

      {/* Borders — renderOrder 11-12 (above fill, below hurricane paths) */}
      {selected && borderTube ? (
        <mesh ref={tubeRef} geometry={borderTube} renderOrder={12}>
          <meshBasicMaterial
            color="#ffffff"
            transparent opacity={0.95}
            depthWrite={false}
            depthTest={true}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <lineLoop ref={borderRef} geometry={borderGeoThin} renderOrder={11}>
          <lineBasicMaterial
            color="#ffffff"
            transparent opacity={0.55}
            depthWrite={false}
            depthTest={true}
            toneMapped={false}
          />
        </lineLoop>
      )}
    </>
  )
}
