import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import GlobeShell from './GlobeShell'
import CountryMesh from './CountryMesh'
import PostProcessing from './PostProcessing'
import Starfield from './Starfield'
import { COUNTRY_POLYGONS } from '../../data/countries'

const latLonToVec3 = (lat: number, lon: number, r: number) => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

function getCentroid(points: [number, number][]) {
  const s = points.reduce((a, [lon, lat]) => {
    const v = latLonToVec3(lat, lon, 1)
    return [a[0] + v.x, a[1] + v.y, a[2] + v.z]
  }, [0, 0, 0])
  return new THREE.Vector3(...s).normalize()
}

function MouseTracker({ groupRef, mouseLocal }: { groupRef: React.MutableRefObject<THREE.Group | null>, mouseLocal: React.MutableRefObject<THREE.Vector3 | null> }) {
  const { camera, gl } = useThree()
  const ndc = useRef({ x: 0, y: 0, active: false })
  const ray = useRef(new THREE.Raycaster())

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      ndc.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
      ndc.current.y = -((e.clientY - r.top) / r.height) * 2 + 1
      ndc.current.active = true
    }
    const onLeave = () => { ndc.current.active = false; mouseLocal.current = null }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [gl, mouseLocal])

  useFrame(() => {
    if (!ndc.current.active || !groupRef.current) { mouseLocal.current = null; return }
    const ndcVec = new THREE.Vector2(ndc.current.x, ndc.current.y)
    ray.current.setFromCamera(ndcVec, camera)
    const { origin, direction } = ray.current.ray
    const b = 2 * origin.dot(direction)
    const c = origin.dot(origin) - 1.0
    const disc = b * b - 4 * c
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / 2
      if (t > 0) {
        const hit = origin.clone().addScaledVector(direction, t)
        mouseLocal.current = groupRef.current.worldToLocal(hit).normalize()
        return
      }
    }
    mouseLocal.current = null
  })

  return null
}

function CameraRig({ selected }: { selected: string | null }) {
  const ctrlRef = useRef<any>(null)
  const selectedCentroid = useRef<THREE.Vector3 | null>(null)
  const prevSelected = useRef<string | null>(null)

  useFrame(({ camera }) => {
    const ctrl = ctrlRef.current
    if (!ctrl) return

    const zooming = !!selected

    if (selected !== prevSelected.current) {
      prevSelected.current = selected
      if (selected) {
        const polygons = COUNTRY_POLYGONS.filter(c => c.name === selected)
        const country = polygons.reduce((best, p) =>
          p.points.length > best.points.length ? p : best, polygons[0])
        selectedCentroid.current = country ? getCentroid(country.points) : null
      } else {
        selectedCentroid.current = null
      }
    }

    if (zooming && selectedCentroid.current) {
      const targetPos = selectedCentroid.current.clone().normalize().multiplyScalar(2.75)
      camera.position.lerp(targetPos, 0.045)
      ctrl.enableDamping = false
      ctrl.enableRotate = false
      ctrl.autoRotate = false
      ctrl.minDistance = 2.0
      ctrl.maxDistance = 3.2
    } else {
      const curDist = camera.position.length()
      const targetDist = 2.9
      const diff = targetDist - curDist
      if (Math.abs(diff) > 0.001) {
        const step = Math.sign(diff) * Math.max(Math.abs(diff * 0.055), 0.006)
        const clamped = Math.sign(diff) * Math.min(Math.abs(step), Math.abs(diff))
        camera.position.setLength(curDist + clamped)
      }
      ctrl.enableDamping = true
      ctrl.enableRotate = true
      ctrl.autoRotate = true
      ctrl.autoRotateSpeed = 0.6
      ctrl.minDistance = 2.4
      ctrl.maxDistance = 5.0
    }

    ctrl.update()
  })

  return (
    <OrbitControls
      ref={ctrlRef}
      enablePan={false}
      enableZoom={true}
      zoomSpeed={0.5}
      rotateSpeed={0.45}
      minDistance={2.0}
      maxDistance={5.0}
      enableDamping
      dampingFactor={0.07}
    />
  )
}

function GlobeGroup({ onSelect, selected, groupRef, mouseLocal }: { onSelect: (name: string) => void, selected: string | null, groupRef: React.MutableRefObject<THREE.Group | null>, mouseLocal: React.MutableRefObject<THREE.Vector3 | null> }) {
  return (
    <group ref={groupRef}>
      <GlobeShell />
      {COUNTRY_POLYGONS.map((country) => (
        <CountryMesh
          key={country.name}
          country={country}
          radius={1}
          selected={selected === country.name}
          globalSelected={selected !== null}
          mouseOnGlobe={mouseLocal}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}

interface GlobeSceneProps {
  selected: string | null
  onSelect: (name: string) => void
}

export default function GlobeScene({ selected, onSelect }: GlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const mouseLocal = useRef<THREE.Vector3 | null>(null)

  return (
    <Canvas camera={{ position: [0, 0, 2.9], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 4]} intensity={0.5} color="#2244ff" distance={10} />
      <pointLight position={[-3, 1, 2]} intensity={0.35} color="#9900ff" distance={12} />
      <pointLight position={[3, -1, 2]} intensity={0.25} color="#0055ff" distance={12} />
      <GlobeGroup selected={selected} onSelect={onSelect} groupRef={groupRef} mouseLocal={mouseLocal} />
      <MouseTracker groupRef={groupRef} mouseLocal={mouseLocal} />
      <Starfield />
      <PostProcessing selected={!!selected} />
      <CameraRig selected={selected} />
    </Canvas>
  )
}
