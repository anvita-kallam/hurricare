import { useState, useRef, useCallback } from 'react'

export interface ImpactEvent {
  time_hours: number
  location: {
    name: string
    lat: number
    lon: number
  }
  impact: {
    fatalities?: number
    power_outages?: number
    evacuations?: number
    damage_estimate_millions?: number
    flooding_reported?: boolean
  }
}

export interface CinematicState {
  isPlaying: boolean
  currentTime: number // in hours
  progress: number // 0 to 1
  phase: 'fadeIn' | 'playing' | 'fadeOut' | 'complete'
}

const TIME_SCALE = 0.5 // 1 second = 30 minutes = 0.5 hours (not used for fixed duration)

export function useCinematicController(
  durationHours: number,
  fixedDurationSeconds: number = 10
) {
  const [state, setState] = useState<CinematicState>({
    isPlaying: false,
    currentTime: 0,
    progress: 0,
    phase: 'fadeIn'
  })

  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const phaseStartTimeRef = useRef<number>()
  const isRunningRef = useRef<boolean>(false)

  const start = useCallback(() => {
    const fadeInDuration = 500 // 0.5 second fade in
    const fadeOutDuration = 1000 // 1 second fade out
    const playDuration = fixedDurationSeconds * 1000 // Fixed duration in ms

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    isRunningRef.current = true

    setState({
      isPlaying: true,
      currentTime: 0,
      progress: 0,
      phase: 'fadeIn'
    })
    phaseStartTimeRef.current = Date.now()

    const animate = () => {
      if (!isRunningRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        return
      }

      const now = Date.now()
      const phaseStart = phaseStartTimeRef.current || now
      const elapsed = now - phaseStart

      setState(prev => {
        if (prev.phase === 'fadeIn') {
          if (elapsed >= fadeInDuration) {
            phaseStartTimeRef.current = now
            return { ...prev, phase: 'playing', progress: 0 }
          }
          return { ...prev, progress: elapsed / fadeInDuration }
        }

        if (prev.phase === 'playing') {
          const playElapsed = now - phaseStartTimeRef.current!
          const playProgress = playElapsed / playDuration

          // Cap at 24 hours maximum
          const maxHours = 24
          const cappedDurationHours = Math.min(durationHours, maxHours)

          if (playProgress >= 1) {
            phaseStartTimeRef.current = now
            return { ...prev, phase: 'fadeOut', progress: 0 }
          }

          // Scale time to fit within fixed duration, capped at 24 hours
          const currentTime = Math.min(playProgress * cappedDurationHours, maxHours)
          return {
            ...prev,
            currentTime,
            progress: playProgress
          }
        }

        if (prev.phase === 'fadeOut') {
          if (elapsed >= fadeOutDuration) {
            // Stop animation — no side effects inside setState
            isRunningRef.current = false
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current)
              animationFrameRef.current = undefined
            }
            return { ...prev, phase: 'complete', isPlaying: false }
          }
          return { ...prev, progress: elapsed / fadeOutDuration }
        }

        // Complete phase - stop animation
        if (prev.phase === 'complete') {
          isRunningRef.current = false
          return prev
        }

        return prev
      })

      // Continue animation loop ONLY if still running
      if (isRunningRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = undefined
        }
      }
    }

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [durationHours, fixedDurationSeconds])
  
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setState({
      isPlaying: false,
      currentTime: 0,
      progress: 0,
      phase: 'complete'
    })
  }, [])
  
  return {
    state,
    start,
    stop
  }
}
