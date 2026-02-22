import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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

const buildCountryGeometry = (points: [number, number][], radius: number, countryName: string) => {
  const R = radius + 0.032
  const shape2D = points.map(([lon, lat]) => new THREE.Vector2(lon, lat))
  const tris = THREE.ShapeUtils.triangulateShape(shape2D, [])
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
}

const buildBorderTube = (points: [number, number][], radius: number) => {
  const R = radius + 0.033
  const pts = points.map(([lon, lat]) => latLonToVec3(lat, lon, R))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
  const segments = Math.min(pts.length * 2, 500)
  return new THREE.TubeGeometry(curve, segments, 0.006, 5, true)
}

export default function CountryMesh({ country, radius, selected, globalSelected, onSelect, mouseOnGlobe, hoverEnabled = true }: CountryMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const borderRef = useRef<THREE.LineLoop>(null)
  const tubeRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(
    () => buildCountryGeometry(country.points, radius, country.name),
    [country.points, radius, country.name]
  )

  const borderGeoThin = useMemo(() => {
    const pts = country.points.map(([lon, lat]) => latLonToVec3(lat, lon, radius + 0.031))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [country.points, radius])

  const borderTube = useMemo(
    () => selected ? buildBorderTube(country.points, radius) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected && country.points, radius]
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

    let target = 1.01

    if (!globalSelected) {
      let boost = 0
      if (hoverEnabled && mouseOnGlobe.current) {
        const dot = centroid.dot(mouseOnGlobe.current)
        const d = (1 - dot) / 2
        boost = Math.exp(-d * 4) * 0.196
      }
      target = 1.01 + boost
    } else if (selected) {
      target = 1.03
    }

    const cur = meshRef.current.scale.x
    const next = cur + (target - cur) * 0.18
    meshRef.current.scale.set(next, next, next)
    if (borderRef.current) borderRef.current.scale.set(next, next, next)
    if (tubeRef.current) tubeRef.current.scale.set(next, next, next)
  })

  return (
    <>
      <mesh ref={meshRef} geometry={geometry}
        onClick={(e) => { e.stopPropagation(); onSelect(country.name) }}
        renderOrder={10}
      >
        <meshBasicMaterial
          color={selected ? '#0e2f7a' : '#0d2060'}
          transparent
          opacity={selected ? 0.92 : 0.88}
          side={THREE.DoubleSide}
          depthWrite={true}
          depthTest={true}
          toneMapped={false}
          polygonOffset={true}
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {selected && borderTube ? (
        <mesh ref={tubeRef} geometry={borderTube} renderOrder={11}>
          <meshBasicMaterial
            color="#ffffff"
            transparent opacity={0.95}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <lineLoop ref={borderRef} geometry={borderGeoThin} renderOrder={11}>
          <lineBasicMaterial
            color="#ffffff"
            transparent opacity={0.55}
            depthWrite={false}
            toneMapped={false}
          />
        </lineLoop>
      )}
    </>
  )
}
