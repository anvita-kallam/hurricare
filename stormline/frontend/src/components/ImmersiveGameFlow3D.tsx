import { useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'

import * as THREE from 'three'

/**
 * Grid Shader Background — Animated perspective grid matching Dashboard3D
 */
const gridVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const gridFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float grid(vec2 uv, float spacing, float thickness) {
    vec2 g = abs(fract(uv / spacing - 0.5) - 0.5) * spacing;
    float line = min(g.x, g.y);
    return 1.0 - smoothstep(0.0, thickness, line);
  }

  void main() {
    vec2 uv = vUv;

    // Major grid
    float g1 = grid(uv, 0.05, 0.001) * 0.04;
    // Minor grid
    float g2 = grid(uv, 0.2, 0.001) * 0.08;

    // Horizontal scan line
    float scanY = fract(uTime * 0.03);
    float scanDist = abs(uv.y - scanY);
    float scan = exp(-scanDist * 80.0) * 0.06;

    // Edge fade
    float edgeFade = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x) *
                     smoothstep(0.0, 0.2, uv.y) * smoothstep(1.0, 0.8, uv.y);

    float alpha = (g1 + g2 + scan) * edgeFade;
    gl_FragColor = vec4(0.2, 0.4, 0.8, alpha);
  }
`

function BackgroundGrid() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <mesh position={[0, 0, -3]} renderOrder={0}>
      <planeGeometry args={[20, 12]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={gridVertexShader}
        fragmentShader={gridFragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function ThreeScene() {
  return (
    <>
      <color attach="background" args={['#020202']} />
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 2, 5]} intensity={0.12} color="#ffffff" distance={14} />
      <pointLight position={[-4, 1, 3]} intensity={0.08} color="#cccccc" distance={14} />
      <pointLight position={[4, -1, 3]} intensity={0.06} color="#aaaaaa" distance={14} />

      <BackgroundGrid />

      {/* Removed Vignette — forbidden by design standards */}
    </>
  )
}

interface ImmersiveGameFlow3DProps {
  children: React.ReactNode
}

export default function ImmersiveGameFlow3D({ children }: ImmersiveGameFlow3DProps) {
  const [scanlinePos, setScanlinePos] = useState(0)

  // Scanline animation
  useEffect(() => {
    let raf: number
    const animate = () => {
      setScanlinePos((p) => (p + 0.15) % 100)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="fixed inset-0 z-0 bg-[#020202] overflow-hidden">
      {/* 3D Canvas backdrop */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 9], fov: 40 }} dpr={[1, 2]}>
          <ThreeScene />
        </Canvas>
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.008) 2px,
            rgba(255,255,255,0.008) 4px
          )`,
        }}
      />

      {/* Moving scan line */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none z-[3]"
        style={{
          top: `${scanlinePos}%`,
          background: 'linear-gradient(90deg, transparent 0%, rgba(100,150,255,0.06) 30%, rgba(100,150,255,0.1) 50%, rgba(100,150,255,0.06) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(100,150,255,0.03)',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-4 h-4 pointer-events-none z-[4]" style={{
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute top-4 right-4 w-4 h-4 pointer-events-none z-[4]" style={{
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 left-4 w-4 h-4 pointer-events-none z-[4]" style={{
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 right-4 w-4 h-4 pointer-events-none z-[4]" style={{
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />

      {/* Content layer — children rendered on top with proper pointer events */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  )
}
