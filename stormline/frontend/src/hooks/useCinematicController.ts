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

const TIME_SCALE = 0.5 // 1 second = 30 minutes = 0.5 hours

export function useCinematicController(
  durationHours: number,
  onComplete: () => void
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
  
  const start = useCallback(() => {
    const fadeInDuration = 1000 // 1 second fade in
    const fadeOutDuration = 2000 // 2 second fade out
    const playDuration = (durationHours / TIME_SCALE) * 1000 // Convert hours to ms
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    setState({
      isPlaying: true,
      currentTime: 0,
      progress: 0,
      phase: 'fadeIn'
    })
    phaseStartTimeRef.current = Date.now()
    
    const animate = () => {
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
          
          if (playProgress >= 1) {
            phaseStartTimeRef.current = now
            return { ...prev, phase: 'fadeOut', progress: 0 }
          }
          
          const currentTime = playProgress * durationHours
          return {
            ...prev,
            currentTime,
            progress: playProgress
          }
        }
        
        if (prev.phase === 'fadeOut') {
          if (elapsed >= fadeOutDuration) {
            onComplete()
            return { ...prev, phase: 'complete', isPlaying: false }
          }
          return { ...prev, progress: elapsed / fadeOutDuration }
        }
        
        // Complete phase - stop animation
        return prev
      })
      
      // Continue animation loop
      setState(currentState => {
        if (currentState.phase !== 'complete' && currentState.isPlaying) {
          animationFrameRef.current = requestAnimationFrame(animate)
        }
        return currentState
      })
    }
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [durationHours, onComplete])
  
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
