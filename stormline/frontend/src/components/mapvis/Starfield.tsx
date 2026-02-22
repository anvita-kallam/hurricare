import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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

const CONSTELLATION_LINES: [number, number][] = [
  [0, 1], [1, 3], [3, 4], [4, 5], [5, 6], [4, 2],
  [19, 20], [20, 21], [21, 19],
  [9, 10], [10, 11], [11, 12], [10, 9],
  [13, 14], [14, 15],
  [16, 17], [17, 18],
  [28, 29],
]

function raDecToVec3(ra: number, dec: number) {
  const raRad = (ra / 24) * Math.PI * 2
  const decRad = (dec * Math.PI) / 180
  return new THREE.Vector3(
    Math.cos(decRad) * Math.cos(raRad),
    Math.sin(decRad),
    Math.cos(decRad) * Math.sin(raRad)
  )
}

function hash(i: number, j: number = 0) {
  const x = Math.sin((i + j * 7.3) * 12.9898 + j * 456.7) * 43758.5453
  return x - Math.floor(x)
}

const constellationVertexShader = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vColor = aColor;

    float brightness = max(0.5, 1.0 - gl_VertexID / 100.0);
    float baseSize = 1.5 + brightness * 2.5;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = baseSize * (200.0 / length(mvPos));
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
    float alpha = (core + glow) * 0.55;
    gl_FragColor = vec4(color, alpha);
  }
`

const backgroundVertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vTwinkle;

  void main() {
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
    float alpha = (core + glow) * 0.45 * vTwinkle;
    gl_FragColor = vec4(color, alpha);
  }
`

export default function Starfield() {
  const constellationPointsRef = useRef<THREE.Points>(null)
  const backgroundPointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)

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
    const constellationPositions: number[] = []
    const constellationColors: number[] = []

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
    const backgroundPositions: number[] = []
    const backgroundPhases: number[] = []

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
    const linePositions: number[] = []
    const lineIndices: number[] = []
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
      opacity: 0.25,
      fog: false,
      depthWrite: false,
      linewidth: 1,
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
    if ((backgroundMatl as any).uniforms.uTime) {
      (backgroundMatl as any).uniforms.uTime.value = clock.elapsedTime
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
