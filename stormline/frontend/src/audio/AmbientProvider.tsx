/**
 * AmbientProvider — Initializes audio context and starts ambient drone.
 *
 * Audio context requires user gesture to start. This component listens for
 * the first click/touch/keydown and initializes the entire sound system.
 *
 * Place once at the app root level.
 */

import { useEffect, useRef } from 'react'
import { initAudio, startAmbient } from './SoundEngine'

export default function AmbientProvider() {
  const startedRef = useRef(false)

  useEffect(() => {
    const start = () => {
      if (startedRef.current) return
      startedRef.current = true

      initAudio()
      startAmbient()

      // Remove all listeners after first interaction
      window.removeEventListener('click', start)
      window.removeEventListener('touchstart', start)
      window.removeEventListener('keydown', start)
    }

    window.addEventListener('click', start, { once: false })
    window.addEventListener('touchstart', start, { once: false })
    window.addEventListener('keydown', start, { once: false })

    return () => {
      window.removeEventListener('click', start)
      window.removeEventListener('touchstart', start)
      window.removeEventListener('keydown', start)
    }
  }, [])

  return null
}
