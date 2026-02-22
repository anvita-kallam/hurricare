import * as THREE from 'three'

const LAYERS = [
  { r: 1.01, color: '#cccccc', opacity: 0.06 },
  { r: 1.03, color: '#aaaaaa', opacity: 0.045 },
  { r: 1.06, color: '#888888', opacity: 0.035 },
  { r: 1.10, color: '#666666', opacity: 0.025 },
  { r: 1.17, color: '#444444', opacity: 0.018 },
  { r: 1.26, color: '#333333', opacity: 0.01 },
  { r: 1.40, color: '#222222', opacity: 0.005 },
]

export default function GlobeShell() {
  return (
    <>
      {/* Base globe sphere with ocean color — renderOrder 1 */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>

      {/* Water/Ocean borders with subtle outline — renderOrder 2 */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[1.033, 64, 64]} />
        <meshBasicMaterial
          color="#1a1a1a"
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
          color="#2a2a2a"
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
