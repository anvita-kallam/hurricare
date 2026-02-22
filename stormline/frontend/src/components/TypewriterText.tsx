/**
 * TypewriterText — Kinetic text with per-character stagger + typing sound.
 *
 * Every character types in with:
 *  - Per-character stagger delay
 *  - Micro blur → crisp resolve
 *  - Slight vertical drift per glyph
 *  - Cherry MX Brown typing sound per keystroke
 *
 * Props:
 *  - text: string to render
 *  - emphasis: 'headline' | 'metric' | 'normal' | 'soft' (affects sound volume & animation speed)
 *  - delayMs: initial delay before typing starts
 *  - charIntervalMs: time between characters (randomized slightly)
 *  - className: pass through for styling
 *  - onComplete: callback when all characters are revealed
 *  - as: HTML element to render as (default 'span')
 */

import { useEffect, useState, useRef, useMemo, createElement } from 'react'
import { playTypeSoft } from '../audio/SoundEngine'

interface TypewriterTextProps {
  text: string
  emphasis?: 'headline' | 'metric' | 'normal' | 'soft'
  delayMs?: number
  charIntervalMs?: number
  className?: string
  style?: React.CSSProperties
  onComplete?: () => void
  as?: keyof JSX.IntrinsicElements
}

export default function TypewriterText({
  text,
  emphasis = 'normal',
  delayMs = 0,
  charIntervalMs,
  className = '',
  style,
  onComplete,
  as = 'span',
}: TypewriterTextProps) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [started, setStarted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef(false)
  const mountedRef = useRef(true)

  // Default intervals based on emphasis
  const interval = charIntervalMs ?? (
    emphasis === 'headline' ? 35 :
    emphasis === 'metric' ? 25 :
    emphasis === 'soft' ? 50 :
    30
  )

  // Start after delay
  useEffect(() => {
    mountedRef.current = true
    const t = setTimeout(() => {
      if (mountedRef.current) setStarted(true)
    }, delayMs)
    return () => {
      mountedRef.current = false
      clearTimeout(t)
    }
  }, [delayMs])

  // Character-by-character reveal with sound
  useEffect(() => {
    if (!started || revealedCount >= text.length) return

    const jitter = (Math.random() - 0.5) * interval * 0.4
    const delay = Math.max(10, interval + jitter)

    intervalRef.current = setTimeout(() => {
      if (!mountedRef.current) return

      // Play extremely subtle blip every ~3rd non-space character
      const nextChar = text[revealedCount]
      if (nextChar && nextChar !== ' ' && revealedCount % 3 === 0) {
        playTypeSoft(emphasis)
      }

      setRevealedCount(prev => prev + 1)
    }, delay)

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [started, revealedCount, text, interval, emphasis])

  // Fire onComplete when done
  useEffect(() => {
    if (revealedCount >= text.length && !completedRef.current && started) {
      completedRef.current = true
      onComplete?.()
    }
  }, [revealedCount, text.length, onComplete, started])

  // Reset when text changes
  useEffect(() => {
    setRevealedCount(0)
    setStarted(false)
    completedRef.current = false
    const t = setTimeout(() => {
      if (mountedRef.current) setStarted(true)
    }, delayMs)
    return () => clearTimeout(t)
  }, [text, delayMs])

  const chars = useMemo(() => text.split(''), [text])

  return createElement(
    as,
    { className: `typewriter-text ${className}`, style },
    chars.map((char, i) => {
      const isRevealed = i < revealedCount
      const isRevealing = i === revealedCount - 1

      return (
        <span
          key={`${i}-${char}`}
          className={`typewriter-char ${isRevealed ? 'typewriter-char-revealed' : ''} ${isRevealing ? 'typewriter-char-active' : ''}`}
          style={{
            opacity: isRevealed ? 1 : 0,
            filter: isRevealing ? 'blur(0.5px)' : isRevealed ? 'blur(0)' : 'blur(2px)',
            transform: isRevealed
              ? 'translateY(0)'
              : 'translateY(3px)',
            transition: 'opacity 0.08s ease-out, filter 0.12s ease-out, transform 0.1s ease-out',
            display: 'inline-block',
            whiteSpace: char === ' ' ? 'pre' : undefined,
          }}
        >
          {char}
        </span>
      )
    })
  )
}

/**
 * CountUpText — Animated counting number with tick sounds.
 *
 * Counts from 0 to target value over a duration, playing faint
 * tick sounds at regular intervals.
 */
export function CountUpText({
  value,
  duration = 1200,
  format,
  className = '',
  delayMs = 0,
  emphasis = 'metric',
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
  delayMs?: number
  emphasis?: 'headline' | 'metric' | 'normal' | 'soft'
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const [started, setStarted] = useState(false)
  const rafRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const t = setTimeout(() => {
      if (mountedRef.current) setStarted(true)
    }, delayMs)
    return () => {
      mountedRef.current = false
      clearTimeout(t)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [delayMs])

  useEffect(() => {
    if (!started) return

    startTimeRef.current = performance.now()
    lastTickRef.current = 0

    const animate = (now: number) => {
      if (!mountedRef.current) return
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * value)

      setDisplayValue(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [started, value, duration, emphasis])

  const formatted = format ? format(displayValue) : displayValue.toLocaleString()

  return (
    <span className={`typewriter-text ${className}`}>
      {formatted}
    </span>
  )
}
