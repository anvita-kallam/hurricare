import * as THREE from 'three'

const LAYERS = [
  { r: 1.01, color: '#7733ff', opacity: 0.12 },
  { r: 1.03, color: '#6622ee', opacity: 0.09 },
  { r: 1.06, color: '#5511cc', opacity: 0.06 },
  { r: 1.10, color: '#4400aa', opacity: 0.04 },
  { r: 1.17, color: '#330088', opacity: 0.025 },
  { r: 1.26, color: '#220066', opacity: 0.015 },
  { r: 1.40, color: '#160044', opacity: 0.008 },
]

export default function GlobeShell() {
  return (
    <>
      {/* Base globe sphere with ocean color — renderOrder 1 */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial color="#0a2a42" />
      </mesh>

      {/* Water/Ocean borders with subtle outline — renderOrder 2 */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[1.033, 64, 64]} />
        <meshBasicMaterial
          color="#1a4a6a"
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* Subtle wireframe sphere for sphere definition — renderOrder 3 */}
      <mesh renderOrder={3}>
        <sphereGeometry args={[1.035, 32, 32]} />
        <meshBasicMaterial
          color="#2a6a9a"
          transparent
          opacity={0.15}
          wireframe={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Atmosphere halo layers — renderOrder 4-10, static opacity (no pulsing) */}
      {LAYERS.map(({ r, color, opacity }, i) => (
        <mesh key={r} renderOrder={i + 4}>
          <sphereGeometry args={[r, 48, 48]} />
          <meshBasicMaterial
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
