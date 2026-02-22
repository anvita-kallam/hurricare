/**
 * BeginGameOverlay — Phase B entry point.
 *
 * After the simulation completes, the user sees ONLY the post-simulation map
 * and this single "Begin Game" button. Nothing else.
 */

import { useState } from 'react'
import { useStore } from '../state/useStore'

export default function BeginGameOverlay() {
  const { setGamePhase, setGameFlowStep } = useStore()
  const [pressed, setPressed] = useState(false)

  const handleBeginGame = () => {
    setPressed(true)
    // Small delay for the press animation before transitioning
    setTimeout(() => {
      setGameFlowStep(1)
      setGamePhase('game-flow')
    }, 400)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center pb-16 pointer-events-none">
      <button
        onClick={handleBeginGame}
        className={`
          pointer-events-auto
          begin-game-btn
          px-12 py-4
          font-rajdhani font-bold text-lg tracking-[0.2em] uppercase
          text-white/80 hover:text-white
          bg-white/[0.04] hover:bg-white/[0.08]
          border border-white/[0.12] hover:border-white/[0.25]
          backdrop-blur-sm
          transition-all duration-500
          ${pressed ? 'begin-game-btn-pressed scale-95 opacity-0' : ''}
        `}
      >
        Begin Game
      </button>
    </div>
  )
}
