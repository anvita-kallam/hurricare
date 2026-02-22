/**
 * InteractiveChartWrapper — Adds hover glow, click-to-zoom modal,
 * and natural language explanations to any chart primitive.
 *
 * Wrap any chart in this component to give it:
 * - Hover: magnetic glow border + subtle scale lift + tooltip label
 * - Click: cinematic zoom to centered modal with full explanation
 * - Sound: click sound on zoom, hover sound on enter
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { playButtonPress, playHover } from '../../audio/SoundEngine'
import TypewriterText from '../TypewriterText'

interface InteractiveChartWrapperProps {
  children: ReactNode
  /** Short label shown on hover (e.g. "Severity Index") */
  label: string
  /** Natural language explanation shown in the zoom modal */
  explanation: string
  /** Optional chart width hint for modal sizing */
  modalScale?: number
}

export default function InteractiveChartWrapper({
  children,
  label,
  explanation,
  modalScale = 1.6,
}: InteractiveChartWrapperProps) {
  const [hovered, setHovered] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [closing, setClosing] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }, [])

  const handleClick = useCallback(() => {
    playButtonPress()
    setZoomed(true)
  }, [])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setZoomed(false)
      setClosing(false)
    }, 300)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!zoomed) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [zoomed, handleClose])

  return (
    <>
      {/* Inline chart with hover effects */}
      <div
        ref={wrapperRef}
        onMouseEnter={() => { setHovered(true); playHover() }}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="relative cursor-pointer transition-transform duration-300 ease-out"
        style={{
          transform: hovered ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {/* Magnetic glow border on hover */}
        {hovered && (
          <div
            className="absolute inset-0 pointer-events-none rounded-sm transition-opacity duration-300"
            style={{
              opacity: 0.7,
              background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(100,180,230,0.15) 0%, transparent 60%)`,
              border: '1px solid rgba(100,180,230,0.2)',
              zIndex: 5,
            }}
          />
        )}

        {/* Hover label tooltip */}
        {hovered && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(100,180,230,0.3)',
              padding: '2px 8px',
              borderRadius: '3px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="text-white/80 font-rajdhani text-xs tracking-wider uppercase">
              {label} — click to explore
            </span>
          </div>
        )}

        {children}
      </div>

      {/* Zoom modal overlay */}
      {zoomed && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center ${closing ? 'chart-zoom-out' : 'chart-zoom-in'}`}
          onClick={handleClose}
          style={{
            background: 'rgba(0,0,2,0.92)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="relative max-w-3xl w-full mx-8"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `scale(${modalScale})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Close hint */}
            <div className="absolute -top-8 right-0 text-white/40 font-mono text-xs">
              ESC or click outside to close
            </div>

            {/* Chart content scaled up */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,2,0.95) 0%, rgba(0,0,4,0.95) 100%)',
                border: '1px solid rgba(100,180,230,0.15)',
                padding: '20px',
                boxShadow: '0 0 60px rgba(100,180,230,0.08), 0 0 120px rgba(0,0,0,0.5)',
              }}
            >
              {/* Label */}
              <div className="text-white/60 font-rajdhani text-sm tracking-[0.2em] uppercase mb-3">
                {label}
              </div>

              {/* Chart */}
              <div className="flex justify-center mb-4">
                {children}
              </div>

              {/* Natural language explanation */}
              <div
                className="mt-4 pt-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-white/80 font-mono text-sm leading-relaxed">
                  <TypewriterText
                    text={explanation}
                    emphasis="normal"
                    delayMs={100}
                    charIntervalMs={12}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
