/**
 * InteractiveGraph — Magnetic hover + click-to-zoom wrapper for any chart/graph.
 *
 * Adds two interaction layers to wrapped content:
 *
 *   1. MAGNETIC HOVER PHYSICS
 *      Cursor proximity drives a subtle 3D lift/tilt via perspective transforms.
 *      Motion is heavy, purposeful — Igloo-Inc-style magnetic feel. No bounce,
 *      no playfulness. Cubic-bezier(0.22, 1, 0.36, 1) for lift,
 *      cubic-bezier(0.4, 0, 0.2, 1) for settle-back.
 *
 *   2. CLICK-TO-ZOOM WITH EXPLANATION
 *      On click, the graph expands into a fixed full-screen overlay with:
 *        - Motion-blur transition (CSS filter blur 4px -> 0)
 *        - Backdrop softening (backdrop-filter: blur 8px)
 *        - Film grain noise texture on overlay background
 *        - Typewriter explanation text (monospaced, per-character reveal)
 *        - Click-again or Escape to close with reverse animation
 *
 * Props:
 *   children      — The chart/graph ReactNode to wrap
 *   title         — Chart title shown in expanded view
 *   explanation   — Data provenance / insight text, typed out character-by-character
 *   className     — Optional extra classes on the outer wrapper
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from 'react'

// ─── Props ───────────────────────────────────────────────────────────────────────

interface InteractiveGraphProps {
  children: ReactNode
  title: string
  explanation: string
  className?: string
}

// ─── Easing constants ────────────────────────────────────────────────────────────

const EASE_LIFT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_SETTLE = 'cubic-bezier(0.4, 0, 0.2, 1)'

// ─── Inline film-grain SVG (base64) ─────────────────────────────────────────────
// Tiny 150x150 feTurbulence noise baked into a data-URI so we avoid external assets.

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.08'/%3E%3C/svg%3E")`

// ─── Typewriter hook ─────────────────────────────────────────────────────────────

function useTypewriter(text: string, active: boolean, charInterval = 18) {
  const [revealed, setRevealed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Reset when text changes or when deactivated
  useEffect(() => {
    if (!active) {
      setRevealed(0)
      return
    }
    setRevealed(0)
  }, [text, active])

  // Tick forward one character at a time
  useEffect(() => {
    if (!active || revealed >= text.length) return

    const jitter = (Math.random() - 0.5) * charInterval * 0.35
    const delay = Math.max(8, charInterval + jitter)

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setRevealed(prev => prev + 1)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, revealed, text, charInterval])

  return text.slice(0, revealed)
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function InteractiveGraph({
  children,
  title,
  explanation,
  className = '',
}: InteractiveGraphProps) {
  // ── State ────────────────────────────────────────────────────────────────────

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hoverStyle, setHoverStyle] = useState<CSSProperties>({})
  const [expanded, setExpanded] = useState(false)
  const [overlayPhase, setOverlayPhase] = useState<'idle' | 'entering' | 'open' | 'exiting'>('idle')
  const [showText, setShowText] = useState(false)

  const typedExplanation = useTypewriter(explanation, showText, 18)

  // ── Magnetic hover ───────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (expanded) return
    const el = wrapperRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    // Normalised offset from center (-1 to 1)
    const nx = (e.clientX - cx) / (rect.width / 2)
    const ny = (e.clientY - cy) / (rect.height / 2)

    // Proximity factor (closer to center = stronger effect)
    const dist = Math.sqrt(nx * nx + ny * ny)
    const proximity = Math.max(0, 1 - dist * 0.6)

    const translateY = -2 - proximity * 2          // -2px to -4px lift
    const rotateX = ny * -1.2 * proximity           // subtle tilt away from cursor
    const rotateY = nx * 1.2 * proximity

    setHoverStyle({
      transform: `perspective(800px) translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      transition: `transform 0.45s ${EASE_LIFT}`,
    })
  }, [expanded])

  const handleMouseLeave = useCallback(() => {
    if (expanded) return
    setHoverStyle({
      transform: 'perspective(800px) translateY(0px) rotateX(0deg) rotateY(0deg)',
      transition: `transform 0.7s ${EASE_SETTLE}`,
    })
  }, [expanded])

  // ── Click-to-expand ──────────────────────────────────────────────────────────

  const open = useCallback(() => {
    if (expanded) return
    setExpanded(true)
    setOverlayPhase('entering')

    // After the expansion transition, switch to "open" and begin typing
    setTimeout(() => {
      setOverlayPhase('open')
      // Small additional delay so the user perceives the graph settling first
      setTimeout(() => setShowText(true), 120)
    }, 420)
  }, [expanded])

  const close = useCallback(() => {
    if (!expanded) return
    setShowText(false)
    setOverlayPhase('exiting')

    setTimeout(() => {
      setExpanded(false)
      setOverlayPhase('idle')
    }, 380)
  }, [expanded])

  // ── Escape key ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!expanded) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, close])

  // ── Overlay styles (phase-driven) ────────────────────────────────────────────

  const overlayStyles: Record<typeof overlayPhase, CSSProperties> = {
    idle: { display: 'none' },

    entering: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      opacity: 1,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      background: 'rgba(0, 0, 0, 0.82)',
      transition: `opacity 0.4s ${EASE_LIFT}, backdrop-filter 0.4s ${EASE_LIFT}`,
    },

    open: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      opacity: 1,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      background: 'rgba(0, 0, 0, 0.82)',
    },

    exiting: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      opacity: 0,
      backdropFilter: 'blur(0px)',
      WebkitBackdropFilter: 'blur(0px)',
      background: 'rgba(0, 0, 0, 0)',
      transition: `opacity 0.38s ${EASE_SETTLE}, backdrop-filter 0.38s ${EASE_SETTLE}, background 0.38s ${EASE_SETTLE}`,
      pointerEvents: 'none' as const,
    },
  }

  // Motion blur on the graph content during transition
  const graphContentStyle: CSSProperties =
    overlayPhase === 'entering'
      ? {
          filter: 'blur(4px)',
          transform: 'scale(0.92)',
          transition: `filter 0.4s ${EASE_LIFT}, transform 0.4s ${EASE_LIFT}`,
        }
      : overlayPhase === 'open'
        ? {
            filter: 'blur(0px)',
            transform: 'scale(1)',
            transition: `filter 0.35s ${EASE_SETTLE}, transform 0.35s ${EASE_SETTLE}`,
          }
        : overlayPhase === 'exiting'
          ? {
              filter: 'blur(4px)',
              transform: 'scale(0.92)',
              opacity: 0,
              transition: `filter 0.3s ${EASE_SETTLE}, transform 0.3s ${EASE_SETTLE}, opacity 0.3s ${EASE_SETTLE}`,
            }
          : {}

  // Explanation panel
  const textPanelStyle: CSSProperties =
    overlayPhase === 'open' && showText
      ? {
          opacity: 1,
          transform: 'translateY(0px)',
          transition: `opacity 0.5s ${EASE_LIFT}, transform 0.5s ${EASE_LIFT}`,
        }
      : {
          opacity: 0,
          transform: 'translateY(6px)',
          transition: `opacity 0.25s ${EASE_SETTLE}, transform 0.25s ${EASE_SETTLE}`,
        }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inline wrapper — magnetic hover target */}
      <div
        ref={wrapperRef}
        className={`interactive-graph-wrapper cursor-pointer ${className}`}
        style={{
          willChange: 'transform',
          ...hoverStyle,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={open}
      >
        {children}
      </div>

      {/* Expanded overlay */}
      {expanded && (
        <div
          style={overlayStyles[overlayPhase]}
          onClick={close}
        >
          {/* Film grain texture layer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: GRAIN_SVG,
              backgroundRepeat: 'repeat',
              opacity: 0.35,
              pointerEvents: 'none',
              mixBlendMode: 'overlay',
            }}
          />

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            style={{
              position: 'absolute',
              top: 24,
              right: 28,
              zIndex: 60,
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.3)',
              fontFamily: '"Rajdhani", sans-serif',
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              padding: '4px 8px',
              textTransform: 'uppercase' as const,
              transition: `color 0.3s ${EASE_SETTLE}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.6)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.3)'
            }}
          >
            ESC
          </button>

          {/* Centered content area — stop click-propagation so clicking the graph doesn't close */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 40px',
              pointerEvents: 'none',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontFamily: '"Rajdhani", sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.8)',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.18em',
                marginBottom: 20,
                opacity: overlayPhase === 'open' ? 1 : 0,
                transform: overlayPhase === 'open' ? 'translateY(0)' : 'translateY(-4px)',
                transition: `opacity 0.4s ${EASE_LIFT} 0.08s, transform 0.4s ${EASE_LIFT} 0.08s`,
              }}
            >
              {title}
            </div>

            {/* Graph content — scaled up */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '72vw',
                maxHeight: '50vh',
                width: '100%',
                pointerEvents: 'auto',
                ...graphContentStyle,
              }}
            >
              {children}
            </div>

            {/* Explanation panel */}
            <div
              style={{
                marginTop: 28,
                maxWidth: 600,
                width: '100%',
                minHeight: 48,
                ...textPanelStyle,
              }}
            >
              {/* Thin separator */}
              <div
                style={{
                  width: 32,
                  height: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  marginBottom: 14,
                }}
              />

              <p
                style={{
                  fontFamily: '"DM Mono", "SF Mono", "Fira Code", monospace',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: 'rgba(255, 255, 255, 0.6)',
                  letterSpacing: '0.14em',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {typedExplanation}
                {/* Blinking cursor while typing */}
                {showText && typedExplanation.length < explanation.length && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 1,
                      height: 12,
                      background: 'rgba(255, 255, 255, 0.4)',
                      marginLeft: 1,
                      verticalAlign: 'middle',
                      animation: 'ig-cursor-blink 0.9s step-end infinite',
                    }}
                  />
                )}
              </p>
            </div>
          </div>

          {/* Keyframe injection (once) */}
          <style>{`
            @keyframes ig-cursor-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
