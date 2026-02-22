import { useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import Starfield from './mapvis/Starfield'

function ThreeScene() {
  return (
    <>
      <color attach="background" args={['#020408']} />
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 2, 5]} intensity={0.12} color="#2244ff" distance={14} />
      <pointLight position={[-4, 1, 3]} intensity={0.08} color="#9900ff" distance={14} />
      <pointLight position={[4, -1, 3]} intensity={0.06} color="#0055ff" distance={14} />

      <Starfield />

      <EffectComposer>
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
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
    <div className="fixed inset-0 bg-[#020408] overflow-hidden" style={{ isolation: 'isolate' }}>
      {/* 3D Canvas backdrop — pinned behind everything */}
      <div className="absolute inset-0" style={{ zIndex: 0, willChange: 'auto' }}>
        <Canvas camera={{ position: [0, 0, 9], fov: 40 }} dpr={[1, 1.5]} style={{ pointerEvents: 'none' }}>
          <ThreeScene />
        </Canvas>
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
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
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{
          zIndex: 2,
          top: `${scanlinePos}%`,
          background: 'linear-gradient(90deg, transparent 0%, rgba(100,150,255,0.06) 30%, rgba(100,150,255,0.1) 50%, rgba(100,150,255,0.06) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(100,150,255,0.03)',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-4 h-4 pointer-events-none" style={{
        zIndex: 3,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute top-4 right-4 w-4 h-4 pointer-events-none" style={{
        zIndex: 3,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 left-4 w-4 h-4 pointer-events-none" style={{
        zIndex: 3,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div className="absolute bottom-4 right-4 w-4 h-4 pointer-events-none" style={{
        zIndex: 3,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />

      {/* Content layer — children rendered on top, own compositing layer */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 10, willChange: 'transform', transform: 'translateZ(0)' }}>
        {children}
      </div>
    </div>
  )
}
