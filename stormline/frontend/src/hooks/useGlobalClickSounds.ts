import { useEffect } from 'react'
import { playButtonPress } from '../audio/SoundEngine'

/**
 * Hook that plays a satisfying click sound on every button/interactive element click
 * Attaches a global click listener and filters for interactive elements
 */
export function useGlobalClickSounds(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleClickSound = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target) return

      // Check if click is on a button or within a button
      const isButton = target.tagName === 'BUTTON' || target.closest('button')
      // Also trigger on clickable divs/spans with role="button"
      const isClickable = target.getAttribute('role') === 'button' || target.closest('[role="button"]')
      // Or elements with click handlers (heuristic: inputs, selects, etc)
      // Exclude range inputs (sliders) — they must be silent
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') return
      const isFormElement = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
      // Check for custom interactive classes
      const isInteractive = target.classList.contains('clickable') ||
                           target.classList.contains('interactive') ||
                           target.classList.contains('btn') ||
                           target.closest('.clickable') ||
                           target.closest('.interactive') ||
                           target.closest('.btn')

      if (isButton || isClickable || isFormElement || isInteractive) {
        playButtonPress()
      }
    }

    document.addEventListener('click', handleClickSound, true) // Capture phase
    return () => document.removeEventListener('click', handleClickSound, true)
  }, [enabled])
}
