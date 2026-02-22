/**
 * ScrollRevealSection — Scroll-driven kinetic reveal wrapper.
 *
 * Wrap any content section in this component to give it:
 * - IntersectionObserver-based reveal animation
 * - Configurable animation style (fade-up, scale-in, slide-left/right, blur-resolve)
 * - Sound effect on first reveal
 * - Stagger delay support for sequential reveals
 * - Parallax offset based on scroll position
 *
 * Designed for Igloo Inc / museum-grade scroll storytelling.
 */

import { useRef, useEffect, type ReactNode } from 'react'
import useScrollReveal from '../../hooks/useScrollReveal'
import { playPanelSlide, playMagneticTick, playPanelSettle } from '../../audio/SoundEngine'

type AnimationStyle = 'fade-up' | 'scale-in' | 'slide-left' | 'slide-right' | 'blur-resolve' | 'depth-emerge'

interface ScrollRevealSectionProps {
  children: ReactNode
  /** Animation style to use on reveal */
  animation?: AnimationStyle
  /** Delay before animation starts (ms) — useful for staggering */
  staggerDelay?: number
  /** Sound to play on reveal */
  sound?: 'slide' | 'tick' | 'settle' | 'none'
  /** CSS class name for the wrapper */
  className?: string
  /** Parallax multiplier — 0 = no parallax, 1 = full parallax offset */
  parallax?: number
  /** Snap this section to viewport */
  snap?: boolean
  /** IntersectionObserver threshold */
  threshold?: number
}

export default function ScrollRevealSection({
  children,
  animation = 'fade-up',
  staggerDelay = 0,
  sound = 'tick',
  className = '',
  parallax = 0,
  snap = false,
  threshold = 0.15,
}: ScrollRevealSectionProps) {
  const { ref, isVisible } = useScrollReveal({ threshold })
  const hasPlayedSound = useRef(false)
  const innerRef = useRef<HTMLDivElement>(null)

  // Play sound on first reveal
  useEffect(() => {
    if (isVisible && !hasPlayedSound.current) {
      hasPlayedSound.current = true
      if (sound !== 'none') {
        // Delay sound to match stagger
        const t = setTimeout(() => {
          switch (sound) {
            case 'slide': playPanelSlide(); break
            case 'tick': playMagneticTick(); break
            case 'settle': playPanelSettle(); break
          }
        }, staggerDelay)
        return () => clearTimeout(t)
      }
    }
  }, [isVisible, sound, staggerDelay])

  // Animation class mapping
  const animationClass = isVisible
    ? `scroll-reveal-visible scroll-reveal-${animation}`
    : `scroll-reveal-hidden scroll-reveal-${animation}-initial`

  return (
    <div
      ref={ref}
      className={`scroll-reveal-section ${snap ? 'scroll-snap-section' : ''} ${className}`}
      style={{
        // Parallax offset via CSS custom property (consumed by parent scroll handler)
        '--parallax-factor': parallax,
      } as React.CSSProperties}
    >
      <div
        ref={innerRef}
        className={animationClass}
        style={{
          transitionDelay: `${staggerDelay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * ScrollDivider — Animated section divider that reveals on scroll.
 * A thin line that draws itself across when it enters the viewport.
 */
export function ScrollDivider({
  className = '',
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.5 })

  return (
    <div ref={ref} className={`scroll-divider-wrapper ${className}`}>
      <div
        className={`scroll-divider ${isVisible ? 'scroll-divider-visible' : ''}`}
        style={{ transitionDelay: `${delay}ms` }}
      />
    </div>
  )
}
