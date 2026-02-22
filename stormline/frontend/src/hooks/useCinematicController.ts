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

/**
 * Cinematic controller — time-based approach.
 *
 * Phase is derived directly from elapsed time since start.
 * No sequential phase transitions that can get stuck.
 * Timeline: [fadeIn 0.5s] → [playing Ns] → [fadeOut 1s] → complete
 */
export function useCinematicController(
  durationHours: number,
  fixedDurationSeconds: number = 10
) {
  const FADE_IN_MS = 500
  const PLAY_MS = fixedDurationSeconds * 1000
  const FADE_OUT_MS = 3000 // Enough time for the transition typing text to complete fully
  const TOTAL_MS = FADE_IN_MS + PLAY_MS + FADE_OUT_MS

  const [state, setState] = useState<CinematicState>({
    isPlaying: false,
    currentTime: 0,
    progress: 0,
    phase: 'fadeIn'
  })

  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const isRunningRef = useRef<boolean>(false)

  const start = useCallback(() => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }

    isRunningRef.current = true
    startTimeRef.current = Date.now()

    setState({
      isPlaying: true,
      currentTime: 0,
      progress: 0,
      phase: 'fadeIn'
    })

    const maxHours = Math.min(durationHours, 24)

    const animate = () => {
      if (!isRunningRef.current) return

      const elapsed = Date.now() - startTimeRef.current

      // Determine phase and progress purely from elapsed time
      if (elapsed >= TOTAL_MS) {
        // Animation definitively complete
        isRunningRef.current = false
        setState({
          isPlaying: false,
          currentTime: 0,
          progress: 0,
          phase: 'complete'
        })
        return
      }

      let phase: 'fadeIn' | 'playing' | 'fadeOut'
      let progress: number
      let currentTime = 0

      if (elapsed < FADE_IN_MS) {
        // Fade in phase
        phase = 'fadeIn'
        progress = elapsed / FADE_IN_MS
      } else if (elapsed < FADE_IN_MS + PLAY_MS) {
        // Playing phase
        phase = 'playing'
        const playElapsed = elapsed - FADE_IN_MS
        progress = playElapsed / PLAY_MS
        currentTime = Math.min(progress * maxHours, maxHours)
      } else {
        // Fade out phase
        phase = 'fadeOut'
        const fadeOutElapsed = elapsed - FADE_IN_MS - PLAY_MS
        progress = fadeOutElapsed / FADE_OUT_MS
      }

      setState({
        isPlaying: true,
        currentTime,
        progress,
        phase
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [durationHours, fixedDurationSeconds, FADE_IN_MS, PLAY_MS, FADE_OUT_MS, TOTAL_MS])

  const stop = useCallback(() => {
    isRunningRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
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
