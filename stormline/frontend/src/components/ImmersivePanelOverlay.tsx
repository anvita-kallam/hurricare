/**
 * ImmersivePanelOverlay — Full-screen 3D game-flow system.
 *
 * Renders each step in a full-screen immersive environment with:
 * - Sophisticated 3D backdrop (grid shader, scanlines, HUD elements)
 * - 2.5D region visualizations with color-coded allocations
 * - Breathing hover effects on interactive elements
 * - No content cropping — full viewport utilization
 *
 * Step 1: Situation / System Framing (uses hurricane + coverage data only)
 * Step 2: Budget Allocation (interactive — user allocates budget with region viz)
 * Step 3: Confirm & Run (runs pipeline, cinematic processing)
 * Step 4: Results Play Out (uses comparisonData from pipeline)
 * Step 5: Summary Insight
 */

import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../state/useStore'
import Step2Allocation from './immersive/Step2Allocation'
import Step3Confirm from './immersive/Step3Confirm'
import Step4Results from './immersive/Step4Results'
import Step5Summary from './immersive/Step5Summary'
import ImmersiveGameFlow3D from './ImmersiveGameFlow3D'
import { playButtonPress, playHover } from '../audio/SoundEngine'
import '../styles/mapvis.css'

export default function ImmersivePanelOverlay() {
  const {
    gameFlowStep,
    setGameFlowStep,
    setGamePhase,
    setSelectedHurricane,
    setShowComparisonPage,
    setPostSimulationMapMode,
    setGameAllocations,
    setGameClusterAllocations,
    setComparisonData,
    setCinematicCompleted,
    isRunningPipeline,
  } = useStore()

  const [transitionDir, setTransitionDir] = useState<'forward' | 'backward'>('forward')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [panelRevealed, setPanelRevealed] = useState(false)

  // Reveal panel content after mount / step change
  useEffect(() => {
    setPanelRevealed(false)
    const t = setTimeout(() => setPanelRevealed(true), 150)
    return () => clearTimeout(t)
  }, [gameFlowStep])

  const goToStep = useCallback((next: number) => {
    if (next === gameFlowStep || isTransitioning || isRunningPipeline) return
    if (next < 2 || next > 5) return

    const dir = next > gameFlowStep ? 'forward' : 'backward'
    setTransitionDir(dir)
    setIsTransitioning(true)
    setPanelRevealed(false)

    setTimeout(() => {
      setGameFlowStep(next)
      setIsTransitioning(false)
    }, 350)
  }, [gameFlowStep, isTransitioning, isRunningPipeline, setGameFlowStep])

  const handleNext = useCallback(() => {
    if (gameFlowStep < 5) {
      goToStep(gameFlowStep + 1)
    }
  }, [gameFlowStep, goToStep])

  const handlePrev = useCallback(() => {
    if (gameFlowStep > 1) {
      goToStep(gameFlowStep - 1)
    }
  }, [gameFlowStep, goToStep])

  const handleExit = useCallback(() => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
    setPostSimulationMapMode(false)
    setCinematicCompleted(false)
    setGamePhase('pre-sim')
    setGameFlowStep(2)
    setGameAllocations({})
    setGameClusterAllocations({})
    setComparisonData(null)
  }, [setShowComparisonPage, setSelectedHurricane, setPostSimulationMapMode, setCinematicCompleted, setGamePhase, setGameFlowStep, setGameAllocations, setComparisonData])

  // Auto-advance from Step 3 to Step 4 when pipeline completes
  const handlePipelineComplete = useCallback(() => {
    setTimeout(() => {
      goToStep(4)
    }, 600)
  }, [goToStep])

  const contentClass = isTransitioning
    ? `immersive-exit-${transitionDir}`
    : panelRevealed
      ? `immersive-enter-${transitionDir} immersive-enter-active`
      : `immersive-enter-${transitionDir}`

  const stepLabels = [
    '',             // Step 1 removed
    'Allocation',
    'Confirm & Run',
    'Results',
    'Summary',
  ]

  return (
    <ImmersiveGameFlow3D>
      {/* Full-screen immersive game flow container */}
      <div className="w-full h-full flex flex-col">
        {/* Header — step progress and exit */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
          {/* Step progress dots — minimal, left aligned */}
          <div className="flex items-center gap-3">
            {[2, 3, 4, 5].map(step => (
              <button
                key={step}
                onClick={() => {
                  if (step <= gameFlowStep && !isRunningPipeline) goToStep(step)
                }}
                className={`
                  flex items-center gap-1.5 transition-all duration-300
                  ${gameFlowStep === step ? 'opacity-100' : step < gameFlowStep ? 'opacity-40 hover:opacity-60 cursor-pointer' : 'opacity-15 cursor-default'}
                `}
              >
                <div className={`
                  w-2 h-2 rounded-full transition-all duration-500
                  ${gameFlowStep === step
                    ? 'bg-white/70 scale-125'
                    : gameFlowStep > step
                      ? 'bg-white/30'
                      : 'bg-white/10'
                  }
                `} />
                {gameFlowStep === step && (
                  <span className="text-white/50 font-rajdhani text-[10px] tracking-widest uppercase">
                    {stepLabels[step - 1]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Exit button — top right */}
          <button
            onClick={handleExit}
            disabled={isRunningPipeline}
            className="text-white/20 hover:text-white/50 font-rajdhani text-xs tracking-wider uppercase px-3 py-1.5 border border-white/[0.06] hover:border-white/15 transition-colors disabled:opacity-10 disabled:cursor-not-allowed"
          >
            Exit
          </button>
        </div>

        {/* Main content area — centered with comfortable max width + frosted glass backdrop */}
        <div className={`flex-1 overflow-y-auto px-8 py-6 ${contentClass}`}>
          <div className="max-w-5xl mx-auto relative">
            {/* Frosted glass backdrop for readability over grid */}
            <div className="absolute inset-0 -mx-6 -my-4 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/[0.03]" style={{ boxShadow: '0 0 80px rgba(0,0,0,0.6)' }} />
            <div className="relative z-10">
              {gameFlowStep === 2 && <Step2Allocation />}
              {gameFlowStep === 3 && <Step3Confirm onPipelineComplete={handlePipelineComplete} />}
              {gameFlowStep === 4 && <Step4Results />}
              {gameFlowStep === 5 && <Step5Summary />}
            </div>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-white/[0.06]">
          <button
            onClick={handlePrev}
            onMouseEnter={() => playHover()}
            disabled={gameFlowStep <= 2 || isRunningPipeline}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/30 hover:text-white/60 disabled:opacity-10 disabled:cursor-not-allowed"
          >
            <span className="text-[10px]">&#9666;</span> Previous
          </button>

          <div className="flex items-center gap-1.5">
            {[2, 3, 4, 5].map(step => (
              <div
                key={step}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  step === gameFlowStep ? 'w-6 bg-white/40' : step < gameFlowStep ? 'w-2 bg-white/15' : 'w-2 bg-white/[0.06]'
                }`}
              />
            ))}
          </div>

          {gameFlowStep < 5 ? (
            gameFlowStep === 3 ? (
              <div className="w-20" />
            ) : (
              <button
                onClick={handleNext}
                onMouseEnter={() => playHover()}
                disabled={isRunningPipeline}
                className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/30 hover:text-white/60 disabled:opacity-10 disabled:cursor-not-allowed"
              >
                Next <span className="text-[10px]">&#9656;</span>
              </button>
            )
          ) : (
            <button
              onClick={() => {
                playButtonPress()
                handleExit()
              }}
              onMouseEnter={() => playHover()}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.15]"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </ImmersiveGameFlow3D>
  )
}
