# MapVis Globe - Complete Code Documentation

**Project**: Interactive 3D Globe Visualization with Country Mesh Selection and Post-Processing Effects
**Framework**: React + Three.js (via react-three/fiber)
**Build Tool**: Vite
**Version**: 0.0.0

---

## Project Overview

This is a sophisticated 3D globe visualization system featuring:
- Interactive 3D globe with country meshes (using geodesic subdivision for smooth large country borders)
- Country selection with smooth camera zoom and focus
- Starfield with constellation lines and twinkling background stars
- Particle field system with layered atmospheric effects
- Post-processing effects (Bloom, Vignette, Noise, Color Correction)
- Globe shell with pulsing atmospheric layers
- Mouse-based country hover detection with smooth scaling
- Responsive UI with country information panel

---

## Dependencies & Configuration

### `package.json`
```json
{
  "name": "mapvistest",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.121.4",
    "@react-three/fiber": "^8.18.0",
    "@react-three/postprocessing": "^2.16.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11"
  }
}
```

### `vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### `.gitignore`
```
node_modules/
dist/
.DS_Store
*.log
```

---

## HTML & Entry Points

### `index.html`
```html
<!doctype html>
<html lang="en" style="background: #000000; margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MapVis Globe</title>
    <style>
      html, body {
        background: #000000 !important;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }
      #root {
        width: 100vw;
        height: 100vh;
        background: #000000 !important;
      }
    </style>
  </head>
  <body style="background: #000000; margin: 0; padding: 0;">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### `src/main.jsx`
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## Styles

### `src/styles.css`
```css
html, body { margin: 0; padding: 0; background: #000; width: 100%; height: 100%; }
* { box-sizing: border-box; }

#root { width: 100vw; height: 100vh; background: #000; }

.app-shell {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #000;
}

.globe-container {
  width: 100%;
  height: 100%;
  /* Sharp by default, fades in from sharp over 0.8s after blur is removed */
  filter: blur(0px);
  transition: filter 0.8s ease-out;
}

/* Selection-change flash blur — fires instantly, fades out over 0.8s */
.globe-container.motion-blur {
  filter: blur(6px);
  transition: filter 0s;
}

canvas { display: block; }

/* Edge-darkening vignette when zoomed */
.zoom-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 50% 50% at 50% 50%,
    transparent 35%,
    rgba(0, 0, 12, 0.5) 75%,
    rgba(0, 0, 12, 0.85) 100%
  );
  z-index: 5;
}

/* Country info panel */
.country-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 28px 44px 40px;
  background: linear-gradient(to top, rgba(0,2,20,0.97) 55%, transparent);
  z-index: 10;
  animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes slideUp {
  from { transform: translateY(50px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.back-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 20px;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: 3px;
  letter-spacing: 0.12em;
  transition: all 0.2s;
  margin-bottom: 18px;
  display: inline-block;
  text-transform: uppercase;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.7);
  color: #ffffff;
}

.country-name {
  margin: 0 0 24px;
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
  font-family: 'Arial', sans-serif;
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.2);
}

.stats-grid {
  display: flex;
  gap: 44px;
  flex-wrap: wrap;
}

.stat { display: flex; flex-direction: column; gap: 5px; }

.stat-val {
  font-size: clamp(1.1rem, 2.5vw, 1.55rem);
  font-weight: 700;
  color: #ffffff;
  font-family: 'Courier New', monospace;
}

.stat-lbl {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-family: 'Arial', sans-serif;
}
```

---

## Main Application Component

### `src/App.jsx`
```javascript
import { useState, useEffect, useRef, useCallback } from 'react'
import GlobeScene from './components/GlobeScene'

const mockStat = (name, i, lo, hi) => {
  let h = 0
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff
  return Math.round(((h >> (i * 4)) & 0xfff) / 0xfff * (hi - lo) + lo)
}

function CountryPanel({ name, onBack }) {
  if (!name) return null
  const pop  = mockStat(name, 0, 1, 1400)
  const gdp  = mockStat(name, 1, 10, 25000)
  const area = mockStat(name, 2, 10, 9500)
  const hdi  = (mockStat(name, 3, 400, 950) / 1000).toFixed(3)

  return (
    <div className="country-panel">
      <button className="back-btn" onClick={onBack}>← Globe</button>
      <h1 className="country-name">{name}</h1>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-val">{pop.toLocaleString()}M</span>
          <span className="stat-lbl">Population</span>
        </div>
        <div className="stat">
          <span className="stat-val">${gdp.toLocaleString()}B</span>
          <span className="stat-lbl">GDP</span>
        </div>
        <div className="stat">
          <span className="stat-val">{area.toLocaleString()} km²</span>
          <span className="stat-lbl">Area</span>
        </div>
        <div className="stat">
          <span className="stat-val">{hdi}</span>
          <span className="stat-lbl">HDI</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [selected, setSelected] = useState(null)
  const [blurring, setBlurring] = useState(false)
  const blurTimeout = useRef(null)

  useEffect(() => {
    clearTimeout(blurTimeout.current)
    setBlurring(true)
    blurTimeout.current = setTimeout(() => setBlurring(false), 100)
    return () => clearTimeout(blurTimeout.current)
  }, [selected])

  const handleSelect = useCallback((name) => setSelected(name), [])
  const handleBack   = useCallback(() => setSelected(null), [])

  return (
    <main className="app-shell">
      {selected && <div className="zoom-vignette" />}

      <div className={`globe-container${blurring ? ' motion-blur' : ''}`}>
        <GlobeScene selected={selected} onSelect={handleSelect} />
      </div>

      <CountryPanel name={selected} onBack={handleBack} />
    </main>
  )
}
```

---

## Components

### `src/components/GlobeScene.jsx`
```javascript
import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import GlobeShell from './GlobeShell'
import CountryMesh from './CountryMesh'
import PostProcessing from './PostProcessing'
import { COUNTRY_POLYGONS } from '../data/countries'

const latLonToVec3 = (lat, lon, r) => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  )
}

function getCentroid(points) {
  const s = points.reduce((a, [lon, lat]) => {
    const v = latLonToVec3(lat, lon, 1)
    return [a[0]+v.x, a[1]+v.y, a[2]+v.z]
  }, [0,0,0])
  return new THREE.Vector3(...s).normalize()
}

// DOM mouse → NDC → per-frame ray-sphere intersection → local space
// Completely independent of R3F events and OrbitControls
function MouseTracker({ groupRef, mouseLocal }) {
  const { camera, gl } = useThree()
  const ndc = useRef({ x: 0, y: 0, active: false })
  const ray = useRef(new THREE.Raycaster())

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      ndc.current.x      = ((e.clientX - r.left) / r.width)  * 2 - 1
      ndc.current.y      = -((e.clientY - r.top)  / r.height) * 2 + 1
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
    ray.current.setFromCamera(ndc.current, camera)
    const { origin, direction } = ray.current.ray
    const b    = 2 * origin.dot(direction)
    const c    = origin.dot(origin) - 1.0
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

function CameraRig({ selected }) {
  const ctrlRef          = useRef()
  const selectedCentroid = useRef(null)
  const prevSelected     = useRef(null)

  useFrame(({ camera }) => {
    const ctrl = ctrlRef.current
    if (!ctrl) return

    const zooming = !!selected

    // Compute target centroid once per selection change
    if (selected !== prevSelected.current) {
      prevSelected.current = selected
      if (selected) {
        // Use largest polygon (most points = main body), so USA centers on
        // contiguous 48 states not the midpoint between main body and Alaska
        const polygons = COUNTRY_POLYGONS.filter(c => c.name === selected)
        const country  = polygons.reduce((best, p) =>
          p.points.length > best.points.length ? p : best, polygons[0])
        selectedCentroid.current = country ? getCentroid(country.points) : null
      } else {
        selectedCentroid.current = null
      }
    }

    if (zooming && selectedCentroid.current) {
      // Lerp camera DIRECTION toward country centroid, then fix distance
      // Distance 2.75 shows entire large country without cropping edges
      const targetPos = selectedCentroid.current.clone().normalize().multiplyScalar(2.75)
      camera.position.lerp(targetPos, 0.045)
      // Disable damping so OrbitControls doesn't fight the lerp
      ctrl.enableDamping  = false
      ctrl.enableRotate   = false
      ctrl.autoRotate     = false
      ctrl.minDistance    = 2.0
      ctrl.maxDistance    = 3.2
    } else {
      const curDist    = camera.position.length()
      const targetDist = 2.9
      const diff       = targetDist - curDist
      if (Math.abs(diff) > 0.001) {
        const step    = Math.sign(diff) * Math.max(Math.abs(diff * 0.055), 0.006)
        const clamped = Math.sign(diff) * Math.min(Math.abs(step), Math.abs(diff))
        camera.position.setLength(curDist + clamped)
      }
      ctrl.enableDamping  = true
      ctrl.enableRotate   = true
      ctrl.autoRotate     = true
      ctrl.autoRotateSpeed = 0.6
      ctrl.minDistance    = 2.4
      ctrl.maxDistance    = 5.0
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

function GlobeGroup({ onSelect, selected, groupRef, mouseLocal }) {
  return (
    <group ref={groupRef}>
      <GlobeShell />
      {COUNTRY_POLYGONS.map((country) => (
        <CountryMesh
          key={country.name}
          country={country}
          radius={1}
          selected={selected === country.name}
          globalSelected={selected}
          mouseOnGlobe={mouseLocal}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}

export default function GlobeScene({ selected, onSelect }) {
  const groupRef   = useRef()
  const mouseLocal = useRef(null)

  return (
    <Canvas camera={{ position: [0, 0, 2.9], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 4]}   intensity={0.5}  color="#2244ff" distance={10} />
      <pointLight position={[-3, 1, 2]}  intensity={0.35} color="#9900ff" distance={12} />
      <pointLight position={[3, -1, 2]}  intensity={0.25} color="#0055ff" distance={12} />
      <GlobeGroup selected={selected} onSelect={onSelect} groupRef={groupRef} mouseLocal={mouseLocal} />
      <MouseTracker groupRef={groupRef} mouseLocal={mouseLocal} />
      <PostProcessing selected={!!selected} />
      <CameraRig selected={selected} />
    </Canvas>
  )
}
```

### `src/components/CountryMesh.jsx`
```javascript
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const latLonToVec3 = (lat, lon, radius) => {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Geodesic subdivision: split each triangle into 4, normalizing midpoints
// back to the sphere surface. Fixes large countries (Russia, Brazil etc.)
// cutting through the sphere as flat chords. depth=3 → 64 sub-tris each.
const sphereSubdivide = (v0, v1, v2, R, depth, positions, indices) => {
  if (depth === 0) {
    const base = positions.length / 3
    positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
    indices.push(base, base + 1, base + 2)
    return
  }
  const mid = (a, b) =>
    new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
      .normalize().multiplyScalar(R)
  const m01 = mid(v0, v1)
  const m12 = mid(v1, v2)
  const m02 = mid(v0, v2)
  sphereSubdivide(v0,  m01, m02, R, depth - 1, positions, indices)
  sphereSubdivide(m01, v1,  m12, R, depth - 1, positions, indices)
  sphereSubdivide(m02, m12, v2,  R, depth - 1, positions, indices)
  sphereSubdivide(m01, m02, m12, R, depth - 1, positions, indices) // center: CCW winding
}

const buildCountryGeometry = (points, radius, countryName) => {
  const R       = radius + 0.028
  const shape2D = points.map(([lon, lat]) => new THREE.Vector2(lon, lat))
  const tris    = THREE.ShapeUtils.triangulateShape(shape2D, [])
  const verts   = points.map(([lon, lat]) => latLonToVec3(lat, lon, R))

  const positions = [], indices = []
  // Russia has complex border geometry; use depth=4 (256 sub-tris per triangle)
  // All others use depth=1 (4 sub-tris) for performance
  const subdivisionDepth = countryName === 'Russia' ? 4 : 1
  for (const [a, b, c] of tris)
    sphereSubdivide(verts[a], verts[b], verts[c], R, subdivisionDepth, positions, indices)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Build a TubeGeometry along the border — a real 3D mesh so it renders as
// one solid thick line from every viewing angle (no stacked-ring striping).
// Computed lazily only when the country becomes selected.
const buildBorderTube = (points, radius) => {
  const R   = radius + 0.033
  const pts = points.map(([lon, lat]) => latLonToVec3(lat, lon, R))
  // CatmullRom closed curve; cap segments to avoid freeze on large polygons
  const curve    = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
  const segments = Math.min(pts.length * 2, 500)
  return new THREE.TubeGeometry(curve, segments, 0.006, 5, true)
}

export default function CountryMesh({ country, radius, selected, globalSelected, onSelect, mouseOnGlobe }) {
  const meshRef      = useRef()
  const borderRef    = useRef()
  const tubeRef      = useRef()

  const geometry = useMemo(
    () => buildCountryGeometry(country.points, radius, country.name),
    [country.points, radius, country.name]
  )

  const borderGeoThin = useMemo(() => {
    const pts = country.points.map(([lon, lat]) => latLonToVec3(lat, lon, radius + 0.031))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [country.points, radius])

  // Only computed once the country is first selected (lazy)
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
      if (mouseOnGlobe.current) {
        const dot = centroid.dot(mouseOnGlobe.current)
        const d   = (1 - dot) / 2
        boost = Math.exp(-d * 4) * 0.196
      }
      target = 1.01 + boost
    } else if (selected) {
      target = 1.03
    }

    const cur  = meshRef.current.scale.x
    const next = cur + (target - cur) * 0.18
    meshRef.current.scale.set(next, next, next)
    if (borderRef.current) borderRef.current.scale.set(next, next, next)
    if (tubeRef.current)   tubeRef.current.scale.set(next, next, next)
  })

  return (
    <>
      {country.name !== 'Russia' && (
        <mesh ref={meshRef} geometry={geometry}
          onClick={(e) => { e.stopPropagation(); onSelect(country.name) }}
          renderOrder={2}
        >
          <meshBasicMaterial
            color={selected ? '#0e2f7a' : '#0d2060'}
            transparent
            opacity={selected ? 0.92 : 0.88}
            side={THREE.DoubleSide}
            depthWrite={true}
            depthTest={true}
            toneMapped={false}
          />
        </mesh>
      )}

      {selected && borderTube ? (
        // Single thick tube mesh — one solid border at all viewing angles
        <mesh ref={tubeRef} geometry={borderTube} renderOrder={3}>
          <meshBasicMaterial
            color="#ffffff"
            transparent opacity={0.95}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : (
        // Normal thin lineLoop border
        <lineLoop ref={borderRef} geometry={borderGeoThin} renderOrder={3}>
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
```

### `src/components/GlobeShell.jsx`
```javascript
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// All layers except the outermost (r:1.60) which made the giant ring
const LAYERS = [
  { r: 1.01, color: '#7733ff', opacity: 0.22 },
  { r: 1.03, color: '#6622ee', opacity: 0.17 },
  { r: 1.06, color: '#5511cc', opacity: 0.12 },
  { r: 1.10, color: '#4400aa', opacity: 0.08 },
  { r: 1.17, color: '#330088', opacity: 0.05 },
  { r: 1.26, color: '#220066', opacity: 0.03 },
  { r: 1.40, color: '#160044', opacity: 0.016 },
]

export default function GlobeShell() {
  const matRefs = useRef([])

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.elapsedTime * 0.9) * 0.04
    matRefs.current.forEach((mat, i) => {
      if (mat) mat.opacity = LAYERS[i].opacity * (1 + pulse)
    })
  })

  return (
    <>
      <mesh renderOrder={0}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {LAYERS.map(({ r, color, opacity }, i) => (
        <mesh key={r} renderOrder={i + 5}>
          <sphereGeometry args={[r, 48, 48]} />
          <meshBasicMaterial
            ref={el => matRefs.current[i] = el}
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
```

### `src/components/PostProcessing.jsx`
```javascript
import { EffectComposer, Noise, HueSaturation, BrightnessContrast, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export default function PostProcessing({ selected }) {
  return (
    <EffectComposer>
      <Bloom
        intensity={selected ? 0.9 : 0.5}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.9}
        mipmapBlur
      />

      <HueSaturation hue={0} saturation={0.2} />
      <BrightnessContrast brightness={0.05} contrast={0.1} />

      {/* Heavy film grain */}
      <Noise
        opacity={selected ? 0.35 : 0.22}
        blendFunction={BlendFunction.OVERLAY}
      />

      {/* Strong vignette for cinematic feel, intensifies on zoom */}
      <Vignette
        offset={selected ? 0.2 : 0.4}
        darkness={selected ? 1.1 : 0.7}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
```

### `src/components/Starfield.jsx`
```javascript
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * ENHANCED STARFIELD - TWO SYSTEMS
 * ================================
 * 1. Constellation stars: big, bright, no twinkling, connected by lines
 * 2. Background stars: smaller, slower subtle twinkling, lots of them
 */

// Bright stars that form constellations (colored, no twinkling)
const BRIGHT_STARS = [
  { name: 'Dubhe', ra: 11.06, dec: 61.9, mag: 1.9, color: '#ffaa55' },
  { name: 'Merak', ra: 11.03, dec: 56.4, mag: 2.3, color: '#aabbff' },
  { name: 'Phad', ra: 11.53, dec: 53.4, mag: 2.4, color: '#aabbff' },
  { name: 'Megrez', ra: 12.26, dec: 57.0, mag: 3.3, color: '#ffffff' },
  { name: 'Alioth', ra: 12.90, dec: 55.9, mag: 1.8, color: '#aabbff' },
  { name: 'Mizar', ra: 13.40, dec: 54.9, mag: 2.2, color: '#aabbff' },
  { name: 'Alkaid', ra: 13.79, dec: 49.3, mag: 1.9, color: '#6699ff' },
  { name: 'Polaris', ra: 2.53, dec: 89.3, mag: 2.0, color: '#ffffff' },
  { name: 'Kochab', ra: 15.73, dec: 74.2, mag: 2.1, color: '#ffcc88' },
  { name: 'Rigel', ra: 5.24, dec: -8.2, mag: 0.1, color: '#6699ff' },
  { name: 'Betelgeuse', ra: 5.92, dec: 7.4, mag: 0.5, color: '#ff5533' },
  { name: 'Bellatrix', ra: 5.42, dec: 6.3, mag: 1.6, color: '#aabbff' },
  { name: 'Alnilam', ra: 5.60, dec: -1.2, mag: 1.7, color: '#aabbff' },
  { name: 'Schedar', ra: 0.68, dec: 56.5, mag: 2.2, color: '#ffaa55' },
  { name: 'Caph', ra: 2.30, dec: 59.1, mag: 2.3, color: '#ffffff' },
  { name: 'Gamma Cas', ra: 3.67, dec: 60.7, mag: 2.4, color: '#aabbff' },
  { name: 'Deneb', ra: 20.69, dec: 45.3, mag: 1.3, color: '#ffffff' },
  { name: 'Albireo', ra: 19.50, dec: 27.7, mag: 3.1, color: '#ffdd99' },
  { name: 'Sadr', ra: 20.37, dec: 40.0, mag: 2.2, color: '#ffaa66' },
  { name: 'Vega', ra: 18.62, dec: 38.8, mag: 0.0, color: '#aabbff' },
  { name: 'Altair', ra: 19.85, dec: 8.9, mag: 0.8, color: '#aabbff' },
  { name: 'Sheliak', ra: 18.98, dec: 33.4, mag: 3.2, color: '#aabbff' },
  { name: 'Alshain', ra: 19.98, dec: 8.4, mag: 3.9, color: '#ffaa77' },
  { name: 'Arcturus', ra: 14.26, dec: 19.2, mag: -0.1, color: '#ffaa55' },
  { name: 'Spica', ra: 13.42, dec: -11.2, mag: 1.0, color: '#6699ff' },
  { name: 'Antares', ra: 16.49, dec: -26.4, mag: 1.0, color: '#ff4422' },
  { name: 'Aldebaran', ra: 4.60, dec: 16.5, mag: 0.9, color: '#ff8844' },
  { name: 'Sirius', ra: 6.75, dec: -16.7, mag: -1.5, color: '#ffffff' },
  { name: 'Capella', ra: 5.28, dec: 46.0, mag: 0.1, color: '#ffddaa' },
  { name: 'Pollux', ra: 7.76, dec: 28.0, mag: 1.1, color: '#ffaa77' },
  { name: 'Procyon', ra: 7.65, dec: 5.2, mag: 0.4, color: '#aabbff' },
  { name: 'Regulus', ra: 10.14, dec: 11.9, mag: 1.4, color: '#aabbff' },
  { name: 'Denebola', ra: 11.82, dec: 14.6, mag: 2.1, color: '#aabbff' },
]

const CONSTELLATION_LINES = [
  [0, 1], [1, 3], [3, 4], [4, 5], [5, 6], [4, 2],
  [19, 20], [20, 21], [21, 19],
  [9, 10], [10, 11], [11, 12], [10, 9],
  [13, 14], [14, 15],
  [16, 17], [17, 18],
  [28, 29],
]

function raDecToVec3(ra, dec) {
  const raRad = (ra / 24) * Math.PI * 2
  const decRad = (dec * Math.PI) / 180
  return new THREE.Vector3(
    Math.cos(decRad) * Math.cos(raRad),
    Math.sin(decRad),
    Math.cos(decRad) * Math.sin(raRad)
  )
}

function hash(i, j = 0) {
  const x = Math.sin((i + j * 7.3) * 12.9898 + j * 456.7) * 43758.5453
  return x - Math.floor(x)
}

// Constellation stars shader - NO twinkling, always bright
const constellationVertexShader = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vColor = aColor;

    float brightness = max(0.5, 1.0 - gl_VertexID / 100.0);
    float baseSize = 2.0 + brightness * 4.0;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = baseSize * (300.0 / length(mvPos));
    gl_Position = projectionMatrix * mvPos;
  }
`

const constellationFragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    float core = exp(-d * d * 8.0);
    float glow = exp(-d * d * 1.2) * 0.8;

    vec3 color = vColor;
    float alpha = (core + glow) * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`

// Background stars shader - slow, subtle twinkling
const backgroundVertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vTwinkle;

  void main() {
    // Very slow, subtle twinkling (0.5-1.0 range)
    float twinkleFreq = 0.5;
    float twinkleFactor = 0.5 + 0.5 * sin(uTime * twinkleFreq * 3.14159 + aPhase);
    vTwinkle = twinkleFactor;

    float baseSize = 0.5;
    float sizeWithTwinkle = baseSize * (0.8 + 0.2 * twinkleFactor);

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = sizeWithTwinkle * (150.0 / length(mvPos));
    gl_Position = projectionMatrix * mvPos;
  }
`

const backgroundFragmentShader = /* glsl */ `
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    float core = exp(-d * d * 8.0);
    float glow = exp(-d * d * 1.2) * 0.4;

    vec3 color = vec3(1.0, 1.0, 1.0);
    float alpha = (core + glow) * 0.7 * vTwinkle;
    gl_FragColor = vec4(color, alpha);
  }
`

// Constellation line shader
const lineVertexShader = /* glsl */ `
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`

const lineFragmentShader = /* glsl */ `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 0.9);
  }
`

export default function Starfield() {
  const constellationPointsRef = useRef()
  const backgroundPointsRef = useRef()
  const linesRef = useRef()

  const {
    constellationGeometry,
    constellationMatl,
    backgroundGeometry,
    backgroundMatl,
    constellationLineGeometry,
    constellationLineMatl,
  } = useMemo(() => {
    const SCALE = 100

    // === CONSTELLATION STARS ===
    const constellationPositions = []
    const constellationColors = []

    for (let i = 0; i < BRIGHT_STARS.length; i++) {
      const star = BRIGHT_STARS[i]
      const pos = raDecToVec3(star.ra, star.dec).multiplyScalar(SCALE)
      constellationPositions.push(pos.x, pos.y, pos.z)

      const col = star.color.replace('#', '')
      const r = parseInt(col.substring(0, 2), 16) / 255
      const g = parseInt(col.substring(2, 4), 16) / 255
      const b = parseInt(col.substring(4, 6), 16) / 255
      constellationColors.push(r, g, b)
    }

    const constellationGeo = new THREE.BufferGeometry()
    constellationGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(constellationPositions), 3))
    constellationGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(constellationColors), 3))

    const constellationMatl = new THREE.ShaderMaterial({
      vertexShader: constellationVertexShader,
      fragmentShader: constellationFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })

    // === BACKGROUND STARS ===
    const backgroundPositions = []
    const backgroundPhases = []

    const PROC_STAR_COUNT = 5000
    for (let i = 0; i < PROC_STAR_COUNT; i++) {
      const h1 = hash(i, 2)
      const h2 = hash(i, 3)
      const h4 = hash(i, 7)

      const theta = h1 * Math.PI * 2
      const phi = Math.acos(2 * h2 - 1)

      backgroundPositions.push(
        SCALE * Math.sin(phi) * Math.cos(theta),
        SCALE * Math.cos(phi),
        SCALE * Math.sin(phi) * Math.sin(theta)
      )

      backgroundPhases.push(h4 * Math.PI * 2)
    }

    const backgroundGeo = new THREE.BufferGeometry()
    backgroundGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(backgroundPositions), 3))
    backgroundGeo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(backgroundPhases), 1))

    const backgroundMatl = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })

    // === CONSTELLATION LINES ===
    const linePositions = []
    const lineIndices = []
    let idx = 0

    for (const [i1, i2] of CONSTELLATION_LINES) {
      const star1 = BRIGHT_STARS[i1]
      const star2 = BRIGHT_STARS[i2]

      const pos1 = raDecToVec3(star1.ra, star1.dec).multiplyScalar(SCALE - 0.1)
      const pos2 = raDecToVec3(star2.ra, star2.dec).multiplyScalar(SCALE - 0.1)

      linePositions.push(pos1.x, pos1.y, pos1.z)
      linePositions.push(pos2.x, pos2.y, pos2.z)

      lineIndices.push(idx, idx + 1)
      idx += 2
    }

    const constellationLineGeo = new THREE.BufferGeometry()
    constellationLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3))
    constellationLineGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(lineIndices), 1))

    const constellationLineMatl = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
      linewidth: 2,
    })

    return {
      constellationGeometry: constellationGeo,
      constellationMatl,
      backgroundGeometry: backgroundGeo,
      backgroundMatl,
      constellationLineGeometry: constellationLineGeo,
      constellationLineMatl,
    }
  }, [])

  useFrame(({ clock }) => {
    if (constellationPointsRef.current) {
      constellationPointsRef.current.rotation.y = clock.elapsedTime * 0.00002
    }
    if (backgroundPointsRef.current) {
      backgroundPointsRef.current.rotation.y = clock.elapsedTime * 0.00002
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = clock.elapsedTime * 0.00002
    }
    if (backgroundMatl.uniforms.uTime) {
      backgroundMatl.uniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <>
      <points
        ref={constellationPointsRef}
        geometry={constellationGeometry}
        material={constellationMatl}
        renderOrder={0}
        frustumCulled={false}
      />
      <points
        ref={backgroundPointsRef}
        geometry={backgroundGeometry}
        material={backgroundMatl}
        renderOrder={0}
        frustumCulled={false}
      />
      <lineSegments
        ref={linesRef}
        geometry={constellationLineGeometry}
        material={constellationLineMatl}
        renderOrder={0}
        frustumCulled={false}
      />
    </>
  )
}
```

### `src/components/ParticlesField.jsx`
```javascript
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function ParticleLayer({ count, radiusMin, radiusMax, speed, size, opacity, delay, color }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = radius * Math.cos(phi)
      arr[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [count, radiusMin, radiusMax])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * speed + delay
    ref.current.rotation.x = Math.sin(t * 0.15 + delay) * 0.08
    ref.current.rotation.z = Math.sin(t * 0.12 + delay) * 0.06
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={new THREE.Color(color)}
        size={size}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

export default function ParticlesField() {
  return (
    <group>
      <ParticleLayer count={3000} radiusMin={1.5} radiusMax={3.5} speed={0.04} size={0.01} opacity={0.7} delay={0} color="#ffffff" />
      <ParticleLayer count={2500} radiusMin={3.0} radiusMax={5.5} speed={0.03} size={0.008} opacity={0.6} delay={Math.PI * 0.25} color="#ffffff" />
      <ParticleLayer count={2000} radiusMin={4.5} radiusMax={7.0} speed={0.025} size={0.006} opacity={0.5} delay={Math.PI * 0.5} color="#ffffff" />
      <ParticleLayer count={1500} radiusMin={6.0} radiusMax={9.0} speed={0.02} size={0.005} opacity={0.4} delay={Math.PI * 0.75} color="#ffffff" />
    </group>
  )
}
```

### `src/components/ParticleField.jsx`
```javascript
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * VECTOR FIELD PARTICLE SYSTEM
 * ============================
 * Particles are tracers moving through a global continuous vector field.
 * NOT orbiting Earth. NOT random space dust.
 *
 * Architecture:
 * - Spawn volumes: Large planar boxes at Z = -6, -3.5, -1.5 (depth layers)
 * - Each particle has deterministic lifecycle (born, flows, ages, respawns)
 * - Velocity field: Base wind direction + 3D curl noise
 * - Three depth layers: background (faint, slow), mid (balanced), foreground (bright, fast)
 *
 * Inspiration: Igloo Inc atmospheric wind visualization + scientific data flow
 */

const LAYERS = 3           // Background, Midground, Foreground
const COUNT = 6000         // Total particles across all layers
const LIFETIME = 12        // Seconds before respawn
const BASE_SPEED = 1.1     // World units per second

// Deterministic hash function: maps index+cycle to [0, 1]
function hash(i, cycle) {
  const x = Math.sin((i + cycle * 73.1) * 12.9898 + cycle * 456.7) * 43758.5453
  return x - Math.floor(x)
}

// Spawn position for particle i in given layer at given cycle
// Planar spawn: large XY box, far back in Z (different for each layer)
function spawnPosition(i, cycle, layer) {
  const h1 = hash(i, cycle * 2)
  const h2 = hash(i, cycle * 3)

  // XY: ±4 in each direction (large planar volume)
  const x = h1 * 8 - 4
  const y = h2 * 8 - 4

  // Z: different depths for each layer (background farther back)
  // Layer 0 (background): z = -7 to -5.5
  // Layer 1 (midground): z = -4 to -2.5
  // Layer 2 (foreground): z = -1.5 to -0.5
  const zBase = -6 - layer * 2.5
  const zVar = hash(i, cycle * 5) * 1.5
  const z = zBase + zVar

  return new THREE.Vector3(x, y, z)
}

// Vertex shader: flow simulation + curl noise
const vertexShader = /* glsl */ `
  uniform float uTime;

  attribute float aSpeed;
  attribute float aLife;
  attribute float aLayer;
  attribute float aSpawnTime;

  varying float vAlpha;

  // 3D curl noise: sine-based approximation
  // Samples multiple frequencies to create laminar-looking curves
  vec3 curlNoise(vec3 p, float t) {
    float f1 = 0.35;  // primary frequency
    float f2 = 0.58;  // secondary frequency
    float amp = 0.18; // noise amplitude

    // Three components of curl, each mixing two frequencies
    float cx = (sin(p.y * f1 + t * 0.3) + sin(p.z * f2 + t * 0.4)) * amp;
    float cy = (sin(p.z * f1 + t * 0.5) + sin(p.x * f2 + t * 0.35)) * amp;
    float cz = (sin(p.x * f1 + t * 0.4) + sin(p.y * f2 + t * 0.6)) * amp;

    return vec3(cx, cy, cz);
  }

  void main() {
    // Age and cycle
    float age = mod(uTime - aSpawnTime, aLife);
    float progress = age / aLife;

    // Smooth fade in (first 20% of life) and fade out (last 25%)
    float fadeIn = smoothstep(0.0, 0.2, progress);
    float fadeOut = smoothstep(1.0, 0.75, progress);
    float ageFade = fadeIn * fadeOut;

    // === VELOCITY FIELD ===
    // Base wind: mostly toward +Z (camera), slight XY drift (atmospheric tilt)
    vec3 windDir = normalize(vec3(0.2, -0.08, 0.97));

    // Speed varies by layer: foreground faster (more proximal flow)
    float speed = aSpeed * (0.85 + aLayer * 0.1);
    vec3 baseVel = windDir * speed;

    // Curl noise: gentle bending, not chaos
    // Sample position that's offset by current flow for smooth curves
    vec3 samplePos = position + baseVel * age * 0.6;
    vec3 curl = curlNoise(samplePos, uTime);

    // Final velocity: base + gentle noise deflection
    vec3 totalVel = baseVel + curl * 0.08;

    // === POSITION ===
    vec3 worldPos = position + totalVel * age;

    // === ALPHA BY LAYER ===
    // Background (0): 0.08-0.15 (subtle)
    // Midground (1): 0.25-0.35 (balanced)
    // Foreground (2): 0.45-0.55 (prominent)
    float baseAlpha = mix(0.10, 0.50, aLayer / 2.0);
    vAlpha = baseAlpha * ageFade;

    // === PROJECTION ===
    vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
    float depth = -mvPos.z;

    // Size: varies by layer (farther = smaller apparent size)
    // Also screen-space scaling to maintain visible size
    float baseSize = mix(0.4, 1.6, aLayer / 2.0);
    gl_PointSize = baseSize * (200.0 / max(depth, 0.1));

    gl_Position = projectionMatrix * mvPos;
  }
`

// Fragment shader: smooth gaussian with no sparkle/twinkle
const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;

    // Discard outside circle
    if (d > 1.0) discard;

    // Gaussian core: smooth, no ring or halo
    float core = exp(-d * d * 10.0);

    // Cool white-blue: atmospheric/scientific aesthetic
    vec3 color = vec3(0.78, 0.88, 1.0);

    gl_FragColor = vec4(color, vAlpha * core);
  }
`

export default function ParticleField() {
  const pointsRef = useRef()
  const materialRef = useRef()
  const geomRef = useRef()
  const particlesRef = useRef([])

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    const lifetimes = new Float32Array(COUNT)
    const layers = new Float32Array(COUNT)
    const spawnTimes = new Float32Array(COUNT)

    const particles = []

    // Distribute particles equally across 3 layers
    const perLayer = COUNT / LAYERS

    for (let i = 0; i < COUNT; i++) {
      const layer = Math.floor(i / perLayer)
      const spawn = spawnPosition(i, 0, layer)

      particles.push({
        index: i,
        layer: layer,
        spawnTime: Math.random() * LIFETIME, // Stagger spawn times for smoothness
        cycle: 0,
      })

      positions[i * 3] = spawn.x
      positions[i * 3 + 1] = spawn.y
      positions[i * 3 + 2] = spawn.z

      speeds[i] = BASE_SPEED * (0.85 + Math.random() * 0.2) // ±10% variation
      lifetimes[i] = LIFETIME * (0.9 + Math.random() * 0.15) // slight variation
      layers[i] = layer
      spawnTimes[i] = particles[i].spawnTime
    }

    particlesRef.current = particles

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aLife', new THREE.BufferAttribute(lifetimes, 1))
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1))
    geo.setAttribute('aSpawnTime', new THREE.BufferAttribute(spawnTimes, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })

    return { geometry: geo, material: mat }
  }, [])

  // Store refs for use in useFrame
  geomRef.current = geometry

  useFrame(({ clock }) => {
    if (!materialRef.current || !geomRef.current) return

    materialRef.current.uniforms.uTime.value = clock.elapsedTime

    // Respawn particles that have aged out
    const particles = particlesRef.current
    const time = clock.elapsedTime
    const positions = geomRef.current.attributes.position.array
    const spawnTimes = geomRef.current.attributes.aSpawnTime.array

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const life = geomRef.current.attributes.aLife.array[i]
      const age = (time - p.spawnTime) % (life + 0.01) // small epsilon to avoid zero

      // When particle exceeds lifetime, respawn it
      if (age > life || age < 0) {
        p.cycle++
        p.spawnTime = time

        const spawn = spawnPosition(i, p.cycle, p.layer)

        positions[i * 3] = spawn.x
        positions[i * 3 + 1] = spawn.y
        positions[i * 3 + 2] = spawn.z

        spawnTimes[i] = p.spawnTime
      }
    }

    geomRef.current.attributes.position.needsUpdate = true
    geomRef.current.attributes.aSpawnTime.needsUpdate = true
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      renderOrder={1}
      frustumCulled={false}
    >
      <primitive ref={materialRef} object={material} />
    </points>
  )
}
```

### `src/components/CountryInfoCard.jsx`
```javascript
import { COUNTRY_FACTS } from '../data/countries'

export default function CountryInfoCard({ country }) {
  return (
    <aside className={`info-card ${country ? 'visible' : ''}`}>
      {country ? (
        <>
          <p className="label">Selected Country</p>
          <h2>{country}</h2>
          <p>{COUNTRY_FACTS[country] ?? 'Fun fact coming soon.'}</p>
        </>
      ) : (
        <>
          <p className="label">Interaction</p>
          <h2>Click a country</h2>
          <p>Explore the floating shapes and reveal a fun fact.</p>
        </>
      )}
    </aside>
  )
}
```

---

## Data File

### `src/data/countries.js` (LARGE FILE - 389,274 LINES)

**⚠️ NOTE**: This file is too large to embed in documentation (4.7MB, 389,274 lines).

**Structure**:
```javascript
export const COUNTRY_FACTS = {
  USA: "Has the world's largest economy.",
  France: 'Produces over 1,500 types of cheese.',
  Japan: 'Has more pets than children.',
  Brazil: 'Is home to about 60% of the Amazon rainforest.',
  Australia: 'Has over 10,000 beaches.'
  // ... additional country facts
}

export const COUNTRY_POLYGONS = [
  {
    "name": "CountryName",
    "color": "#hexcolor",
    "points": [
      [longitude, latitude],
      [longitude, latitude],
      // ... array of coordinate pairs defining the country polygon
    ]
  },
  // ... 190+ countries
];
```

**Includes**:
- `COUNTRY_FACTS`: Object mapping country names to fun facts
- `COUNTRY_POLYGONS`: Array of ~190 countries with:
  - `name`: Country name (string)
  - `color`: Hex color code (string, currently unused but available for styling)
  - `points`: Array of [longitude, latitude] coordinate pairs defining country borders

To use this file in your integration: **Copy the entire `src/data/countries.js` file as-is** — it contains all necessary geolocation data for rendering the globe.

---

## Key Architecture Patterns

### 1. **Geodesic Subdivision**
Countries are rendered using geodesic subdivision to avoid flat-chord artifacts for large countries (Russia, Brazil). Russia uses depth=4 (256 sub-triangles), others use depth=1 (4 sub-triangles) for performance.

### 2. **Camera Focus System**
When a country is selected:
- Finds the centroid of the largest polygon (handles multi-polygon countries like USA)
- Lerps camera toward that centroid at distance 2.75 for full view
- Disables orbit damping/rotation during zoom
- Restores damping on deselection

### 3. **Particle Systems**
- **ParticleField**: Vector field particles flowing through curl noise (scientific visualization)
- **ParticlesField**: Orbital rings of particles around the globe
- **Starfield**: Two-layer system (bright constellations + twinkling background stars)

### 4. **Post-Processing Effects**
Applied via `@react-three/postprocessing`:
- Bloom: Higher intensity when country selected
- Vignette: Darkens edges, stronger on zoom
- Noise: Film grain overlay
- Color correction: Saturation, brightness, contrast adjustments

### 5. **Mouse Tracking**
Independent raycaster system that:
- Converts DOM mouse coordinates to NDC
- Performs ray-sphere intersection each frame
- Transforms to local space for proximity-based country scaling

---

## Integration Checklist

- [ ] Copy all files from `src/` directory maintaining folder structure
- [ ] Install dependencies: `npm install`
- [ ] Copy `package.json`, `vite.config.js`, `index.html` exactly
- [ ] Copy large `src/data/countries.js` file (DO NOT MODIFY)
- [ ] Run `npm run dev` to test
- [ ] Integrate into hurricane simulator project as needed

---

## Notes for Integration

1. **No Backend Required**: All data is static and bundled
2. **Responsive**: Uses `clamp()` CSS and viewport-aware sizing
3. **Collision**: Uses Ray3 + sphere intersection, not r3f physics
4. **Performance**: Optimized with `useMemo`, shader-based rendering, lazy borders
5. **Customizable**: Lighting, colors, animation speeds easily adjustable

Generated: 2025-02-21
