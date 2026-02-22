/**
 * useScrollSound — Attaches scroll-driven micro-sounds to a container or window.
 *
 * Scrolling produces faint fabric/friction sounds.
 * Volume is tied to scroll velocity:
 *   Fast scroll → slightly louder
 *   Slow scroll → softer, more granular
 */

import { useEffect, useRef } from 'react'
import { playScrollTick } from '../audio/SoundEngine'

export function useScrollSound(
  elementRef?: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handleScroll = (e: Event) => {
      const now = performance.now()
      const dt = now - lastTimeRef.current
      if (dt < 20) return // Throttle

      let currentY: number
      if (elementRef?.current) {
        currentY = elementRef.current.scrollTop
      } else {
        currentY = window.scrollY
      }

      const dy = currentY - lastYRef.current
      const velocity = dt > 0 ? Math.abs(dy) / (dt / 16) : 0

      if (Math.abs(dy) > 1) {
        playScrollTick(velocity)
      }

      lastYRef.current = currentY
      lastTimeRef.current = now
    }

    const target = elementRef?.current || window
    target.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      target.removeEventListener('scroll', handleScroll)
    }
  }, [elementRef, enabled])
}

/**
 * useWheelSound — Wheel event based scroll sound (for non-scrolling containers).
 * Useful when the main content doesn't have overflow scroll but uses wheel for interaction.
 */
export function useWheelSound(enabled: boolean = true) {
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handleWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now - lastTimeRef.current < 30) return
      lastTimeRef.current = now

      const velocity = Math.abs(e.deltaY) / 3
      if (velocity > 0.5) {
        playScrollTick(velocity)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [enabled])
}
