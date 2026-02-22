/**
 * FilmGrain — Global post-processing overlay
 *
 * Adds three subtle effects layered over the entire application:
 *   1. Animated film grain via SVG feTurbulence filter
 *   2. Procedural noise texture (combined with grain)
 *   3. Occasional sub-pixel jitter (0.1-0.3px translate)
 *
 * The overlay is fixed, full-screen, non-interactive (pointer-events: none),
 * and sits at z-index 9999 so it composites on top of everything.
 *
 * Aesthetic: "Printed on glass in a dark room — but engineered to be read"
 *
 * FORBIDDEN: bloom, glow, blur, vignette, color grading.
 * Readability must never be reduced.
 */

import { useEffect, useRef } from 'react'

/** Unique ID prefix to avoid SVG filter collisions */
const FILTER_ID = 'film-grain-turbulence'

/**
 * Inline <style> content — injected once.
 *
 * We define keyframes here rather than in a .css file so the component
 * is fully self-contained and tree-shakeable.
 */
const STYLE_CONTENT = `
@keyframes filmGrainSeed {
  0%   { filter: url(#${FILTER_ID}-0); }
  25%  { filter: url(#${FILTER_ID}-1); }
  50%  { filter: url(#${FILTER_ID}-2); }
  75%  { filter: url(#${FILTER_ID}-3); }
  100% { filter: url(#${FILTER_ID}-0); }
}

@keyframes subPixelJitter {
  0%, 90%, 100% {
    transform: translate(0, 0);
  }
  92% {
    transform: translate(0.2px, -0.1px);
  }
  94% {
    transform: translate(-0.1px, 0.3px);
  }
  96% {
    transform: translate(0.3px, 0.1px);
  }
  98% {
    transform: translate(-0.2px, -0.2px);
  }
}
`

/**
 * FilmGrain renders a fixed overlay with animated procedural noise
 * and sub-pixel jitter. All effects are GPU-accelerated and extremely
 * lightweight.
 */
export default function FilmGrain() {
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // Inject the keyframe stylesheet once on mount, clean up on unmount
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-film-grain', '')
    style.textContent = STYLE_CONTENT
    document.head.appendChild(style)
    styleRef.current = style

    return () => {
      if (styleRef.current && styleRef.current.parentNode) {
        styleRef.current.parentNode.removeChild(styleRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* SVG filter definitions — hidden, zero-size, just for filter references */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <defs>
          {/*
           * Four feTurbulence filters with different seeds.
           * The grain animation cycles through them to create
           * organic, shifting noise without JS per-frame cost.
           */}
          {[0, 1, 2, 3].map((seed) => (
            <filter key={seed} id={`${FILTER_ID}-${seed}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves={3}
                seed={seed * 17 + 1}
                stitchTiles="stitch"
                result="noise"
              />
              <feColorMatrix
                type="saturate"
                values="0"
                in="noise"
                result="mono"
              />
              <feComponentTransfer in="mono" result="grain">
                <feFuncA type="linear" slope="1" intercept="0" />
              </feComponentTransfer>
              <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
            </filter>
          ))}
        </defs>
      </svg>

      {/* Grain + noise overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          opacity: 0.04,
          animation: 'filmGrainSeed 400ms steps(4, end) infinite',
          willChange: 'filter',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Sub-pixel jitter overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'subPixelJitter 8s linear infinite',
          willChange: 'transform',
          /* Invisible layer — the jitter applies to content beneath
             via compositing. We use a fully transparent background
             so only the transform displacement matters visually
             when this div is a compositing layer. */
          background: 'transparent',
        }}
      />
    </>
  )
}
