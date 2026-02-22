import { useRef, useEffect } from 'react'

/**
 * Hook that applies a breathing/scaling effect on mouse hover
 * Matches the Dashboard3D globe hover effect
 */
export function useBreathingEffect(enabled: boolean = true) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled || !elementRef.current) return

    const element = elementRef.current
    let isHovering = false
    let animationFrameId: number

    const applyBreathingAnimation = () => {
      if (!isHovering) return

      const time = performance.now() * 0.001
      const breatheScale = 1 + Math.sin(time * 2) * 0.03 // Subtle scale variation
      const breatheOpacity = 1 + Math.sin(time * 2.5) * 0.05 // Subtle opacity variation

      element.style.transform = `scale(${breatheScale})`
      element.style.opacity = String(breatheOpacity)

      animationFrameId = requestAnimationFrame(applyBreathingAnimation)
    }

    const handleMouseEnter = () => {
      isHovering = true
      animationFrameId = requestAnimationFrame(applyBreathingAnimation)
    }

    const handleMouseLeave = () => {
      isHovering = false
      cancelAnimationFrame(animationFrameId)
      element.style.transform = 'scale(1)'
      element.style.opacity = '1'
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(animationFrameId)
    }
  }, [enabled])

  return elementRef
}
