/**
 * useScrollReveal — Intersection Observer hook for scroll-driven animations.
 *
 * Returns a ref to attach to the target element, plus visibility/progress state.
 * Triggers once (stays visible after first reveal) to avoid flicker on re-scroll.
 *
 * Uses threshold array for progressive reveal — progress goes 0→1 as element
 * enters viewport.
 */

import { useRef, useState, useEffect, useCallback } from 'react'

interface UseScrollRevealOptions {
  /** Viewport margin (e.g. '-80px' to trigger slightly before entering) */
  rootMargin?: string
  /** Threshold at which element is considered "visible" (default 0.15) */
  threshold?: number
  /** If true, element can re-hide when scrolled away (default false) */
  once?: boolean
}

interface ScrollRevealResult {
  ref: React.RefObject<HTMLDivElement>
  isVisible: boolean
  /** 0-1 progress of element entering viewport */
  progress: number
}

export default function useScrollReveal({
  rootMargin = '-60px',
  threshold = 0.15,
  once = true,
}: UseScrollRevealOptions = {}): ScrollRevealResult {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const hasBeenVisible = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Build threshold array for progress tracking
    const thresholds = Array.from({ length: 20 }, (_, i) => i / 19)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const ratio = entry.intersectionRatio

          if (once && hasBeenVisible.current) return

          if (ratio >= threshold) {
            setIsVisible(true)
            hasBeenVisible.current = true
          } else if (!once) {
            setIsVisible(false)
          }

          setProgress(Math.min(ratio / Math.max(threshold, 0.01), 1))
        })
      },
      {
        rootMargin,
        threshold: thresholds,
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once])

  return { ref, isVisible, progress }
}

/**
 * useScrollVelocity — Tracks scroll velocity on a given container.
 *
 * Returns current velocity (px/frame) for motion blur and sound effects.
 */
export function useScrollVelocity(containerRef: React.RefObject<HTMLElement | null>) {
  const [velocity, setVelocity] = useState(0)
  const lastScrollTop = useRef(0)
  const lastTime = useRef(performance.now())
  const rafRef = useRef<number>()
  const velocityRef = useRef(0)

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const now = performance.now()
    const dt = now - lastTime.current
    if (dt < 1) return

    const scrollTop = containerRef.current.scrollTop
    const delta = scrollTop - lastScrollTop.current
    const v = (delta / dt) * 16 // Normalize to ~px per frame at 60fps

    lastScrollTop.current = scrollTop
    lastTime.current = now
    velocityRef.current = v

    // Smooth the velocity with decay
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setVelocity(v)
    })
  }, [containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef, handleScroll])

  return velocity
}
