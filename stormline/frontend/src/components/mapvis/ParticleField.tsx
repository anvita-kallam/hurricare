import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LAYERS = 3
const COUNT = 6000
const LIFETIME = 12
const BASE_SPEED = 1.1

function hash(i: number, cycle: number) {
  const x = Math.sin((i + cycle * 73.1) * 12.9898 + cycle * 456.7) * 43758.5453
  return x - Math.floor(x)
}

function spawnPosition(i: number, cycle: number, layer: number) {
  const h1 = hash(i, cycle * 2)
  const h2 = hash(i, cycle * 3)

  const x = h1 * 8 - 4
  const y = h2 * 8 - 4

  const zBase = -6 - layer * 2.5
  const zVar = hash(i, cycle * 5) * 1.5
  const z = zBase + zVar

  return new THREE.Vector3(x, y, z)
}

const vertexShader = /* glsl */ `
  uniform float uTime;

  attribute float aSpeed;
  attribute float aLife;
  attribute float aLayer;
  attribute float aSpawnTime;

  varying float vAlpha;

  vec3 curlNoise(vec3 p, float t) {
    float f1 = 0.35;
    float f2 = 0.58;
    float amp = 0.18;

    float cx = (sin(p.y * f1 + t * 0.3) + sin(p.z * f2 + t * 0.4)) * amp;
    float cy = (sin(p.z * f1 + t * 0.5) + sin(p.x * f2 + t * 0.35)) * amp;
    float cz = (sin(p.x * f1 + t * 0.4) + sin(p.y * f2 + t * 0.6)) * amp;

    return vec3(cx, cy, cz);
  }

  void main() {
    float age = mod(uTime - aSpawnTime, aLife);
    float progress = age / aLife;

    float fadeIn = smoothstep(0.0, 0.2, progress);
    float fadeOut = smoothstep(1.0, 0.75, progress);
    float ageFade = fadeIn * fadeOut;

    vec3 windDir = normalize(vec3(0.2, -0.08, 0.97));

    float speed = aSpeed * (0.85 + aLayer * 0.1);
    vec3 baseVel = windDir * speed;

    vec3 samplePos = position + baseVel * age * 0.6;
    vec3 curl = curlNoise(samplePos, uTime);

    vec3 totalVel = baseVel + curl * 0.08;

    vec3 worldPos = position + totalVel * age;

    float baseAlpha = mix(0.10, 0.50, aLayer / 2.0);
    vAlpha = baseAlpha * ageFade;

    vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
    float depth = -mvPos.z;

    float baseSize = mix(0.4, 1.6, aLayer / 2.0);
    gl_PointSize = baseSize * (200.0 / max(depth, 0.1));

    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;

    if (d > 1.0) discard;

    float core = exp(-d * d * 10.0);

    vec3 color = vec3(0.78, 0.88, 1.0);

    gl_FragColor = vec4(color, vAlpha * core);
  }
`

interface Particle {
  index: number
  layer: number
  spawnTime: number
  cycle: number
}

export default function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const geomRef = useRef<THREE.BufferGeometry>(null)
  const particlesRef = useRef<Particle[]>([])

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    const lifetimes = new Float32Array(COUNT)
    const layers = new Float32Array(COUNT)
    const spawnTimes = new Float32Array(COUNT)

    const particles: Particle[] = []

    const perLayer = COUNT / LAYERS

    for (let i = 0; i < COUNT; i++) {
      const layer = Math.floor(i / perLayer)
      const spawn = spawnPosition(i, 0, layer)

      particles.push({
        index: i,
        layer: layer,
        spawnTime: Math.random() * LIFETIME,
        cycle: 0,
      })

      positions[i * 3] = spawn.x
      positions[i * 3 + 1] = spawn.y
      positions[i * 3 + 2] = spawn.z

      speeds[i] = BASE_SPEED * (0.85 + Math.random() * 0.2)
      lifetimes[i] = LIFETIME * (0.9 + Math.random() * 0.15)
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

  if (geomRef.current === null) {
    geomRef.current = geometry
  }

  useFrame(({ clock }) => {
    if (!materialRef.current || !geomRef.current) return

    materialRef.current.uniforms.uTime.value = clock.elapsedTime

    const particles = particlesRef.current
    const time = clock.elapsedTime
    const positions = geomRef.current.attributes.position.array as Float32Array
    const spawnTimes = geomRef.current.attributes.aSpawnTime.array as Float32Array

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const life = (geomRef.current.attributes.aLife.array as Float32Array)[i]
      const age = (time - p.spawnTime) % (life + 0.01)

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
