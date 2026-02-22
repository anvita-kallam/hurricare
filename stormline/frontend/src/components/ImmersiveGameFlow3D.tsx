import { useRef, useEffect, useState } from 'react'

interface ImmersiveGameFlow3DProps {
  children: React.ReactNode
}

/**
 * ImmersiveGameFlow3D — Pure CSS backdrop.
 * Subtle grid + scanline overlay. No Three.js Canvas.
 */
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
      {/* CSS grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Minor grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '15px 15px',
        }}
      />

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
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(255,255,255,0.03)',
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

      {/* Content layer — children rendered on top */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  )
}
