/**
 * ImmersivePanelOverlay — The game-flow overlay system.
 *
 * Renders a blurred/dimmed background with ONE centered panel at a time.
 * Steps progress sequentially. Each step renders exactly one immersive panel.
 *
 * Step 1: Situation / System Framing (uses hurricane + coverage data only)
 * Step 2: Budget Allocation (interactive — user allocates budget)
 * Step 3: Confirm & Run (runs pipeline, cinematic processing)
 * Step 4: Results Play Out (uses comparisonData from pipeline)
 * Step 5: Summary Insight
 */

import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../state/useStore'
import Step1Situation from './immersive/Step1Situation'
import Step2Allocation from './immersive/Step2Allocation'
import Step3Confirm from './immersive/Step3Confirm'
import Step4Results from './immersive/Step4Results'
import Step5Summary from './immersive/Step5Summary'

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
    if (next < 1 || next > 5) return

    setTransitionDir(next > gameFlowStep ? 'forward' : 'backward')
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
    setGameFlowStep(1)
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
    'Situation Frame',
    'Allocation',
    'Confirm & Run',
    'Results',
    'Summary',
  ]

  return (
    <div className="fixed inset-0 z-50">
      {/* Dimmed background overlay — NO blur to keep panel content crisp */}
      <div className="absolute inset-0 bg-black/70 immersive-backdrop" />

      {/* Step progress dots — minimal, top center */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        {[1, 2, 3, 4, 5].map(step => (
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

      {/* Exit button — top right corner */}
      <button
        onClick={handleExit}
        disabled={isRunningPipeline}
        className="absolute top-5 right-6 z-10 text-white/20 hover:text-white/50 font-rajdhani text-xs tracking-wider uppercase px-3 py-1.5 border border-white/[0.06] hover:border-white/15 transition-colors disabled:opacity-10 disabled:cursor-not-allowed"
      >
        Exit
      </button>

      {/* Centered panel container */}
      <div className="absolute inset-0 top-14 bottom-16 flex items-center justify-center p-8">
        <div className={`relative w-full max-w-3xl max-h-full overflow-y-auto ${contentClass}`}>
          <div className="immersive-panel bg-[#0a0a0f] border border-white/[0.08] rounded p-6">
            {gameFlowStep === 1 && <Step1Situation />}
            {gameFlowStep === 2 && <Step2Allocation />}
            {gameFlowStep === 3 && <Step3Confirm onPipelineComplete={handlePipelineComplete} />}
            {gameFlowStep === 4 && <Step4Results />}
            {gameFlowStep === 5 && <Step5Summary />}
          </div>
        </div>
      </div>

      {/* Bottom navigation — minimal */}
      <div className="absolute bottom-0 left-0 right-0 h-14 flex items-center justify-between px-8">
        <button
          onClick={handlePrev}
          disabled={gameFlowStep === 1 || isRunningPipeline}
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/30 hover:text-white/60 disabled:opacity-10 disabled:cursor-not-allowed"
        >
          <span className="text-[10px]">&#9666;</span> Previous
        </button>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map(step => (
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
            /* Step 3 handles its own advancement via pipeline completion */
            <div className="w-20" />
          ) : (
            <button
              onClick={handleNext}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/30 hover:text-white/60 disabled:opacity-10 disabled:cursor-not-allowed"
            >
              Next <span className="text-[10px]">&#9656;</span>
            </button>
          )
        ) : (
          <button
            onClick={handleExit}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-rajdhani tracking-wider uppercase transition-all text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.15]"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  )
}
