/**
 * ImmersivePanelOverlay — Full-screen 3D game-flow system.
 *
 * Step 1: Situation / System Framing (uses hurricane + coverage data only)
 * Step 2: Budget Allocation (interactive — user allocates budget with region viz)
 * Step 3: Analysis Dashboard — single scrollable view with Confirm + Results + Summary
 *         (auto-runs pipeline; for Sandy, uses hardcoded data)
 */

import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../state/useStore'
import Step1Situation from './immersive/Step1Situation'
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
    comparisonData,
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
    if (next < 1 || next > 3) return

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
    if (gameFlowStep < 3) {
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

  // Pipeline complete is a no-op now since results are shown inline
  const handlePipelineComplete = useCallback(() => {
    // Results are shown inline below the confirm panel — no step transition needed
  }, [])

  const contentClass = isTransitioning
    ? `immersive-exit-${transitionDir}`
    : panelRevealed
      ? `immersive-enter-${transitionDir} immersive-enter-active`
      : `immersive-enter-${transitionDir}`

  const stepLabels = [
    'Situation Frame',
    'Allocation',
    'Analysis Dashboard',
  ]

  return (
    <ImmersiveGameFlow3D>
      {/* Full-screen immersive game flow container */}
      <div className="w-full h-full flex flex-col">
        {/* Header — step progress and exit */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
          {/* Step progress dots — minimal, left aligned */}
          <div className="flex items-center gap-3">
            {[1, 2, 3].map(step => (
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
                  w-2.5 h-2.5 rounded-full transition-all duration-500
                  ${gameFlowStep === step
                    ? 'bg-white/70 scale-125'
                    : gameFlowStep > step
                      ? 'bg-white/30'
                      : 'bg-white/10'
                  }
                `} />
                {gameFlowStep === step && (
                  <span className="text-white/70 font-rajdhani text-sm tracking-widest uppercase">
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
            className="text-white/40 hover:text-white/70 font-rajdhani text-sm tracking-wider uppercase px-4 py-2 border border-white/[0.08] hover:border-white/20 transition-colors disabled:opacity-10 disabled:cursor-not-allowed"
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
              {gameFlowStep === 1 && <Step1Situation />}
              {gameFlowStep === 2 && <Step2Allocation />}
              {gameFlowStep === 3 && (
                <>
                  {/* Step 3: Scrollable Analysis Dashboard — all panels visible */}
                  <Step3Confirm onPipelineComplete={handlePipelineComplete} />

                  {/* Divider */}
                  <div className="my-8 border-t border-white/[0.08]" />

                  {/* Results section — shows when data is available */}
                  {comparisonData ? (
                    <>
                      <Step4Results />
                      <div className="my-8 border-t border-white/[0.08]" />
                      <Step5Summary />
                    </>
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <div className="flex items-center justify-center gap-2">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-white/30 confirm-dot"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        ))}
                      </div>
                      <div className="text-white/50 font-rajdhani text-base tracking-wider">
                        Results will appear here once the analysis completes
                      </div>
                      <div className="text-white/30 font-mono text-sm">
                        Scroll down after analysis to see full results and summary
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-white/[0.06]">
          <button
            onClick={handlePrev}
            onMouseEnter={() => playHover()}
            disabled={gameFlowStep === 1 || isRunningPipeline}
            className="flex items-center gap-2 px-4 py-2 text-sm font-rajdhani tracking-wider uppercase transition-all text-white/50 hover:text-white/80 disabled:opacity-10 disabled:cursor-not-allowed"
          >
            <span className="text-sm">&#9666;</span> Previous
          </button>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`h-[4px] rounded-full transition-all duration-500 ${
                  step === gameFlowStep ? 'w-8 bg-white/50' : step < gameFlowStep ? 'w-3 bg-white/20' : 'w-3 bg-white/[0.08]'
                }`}
              />
            ))}
          </div>

          {gameFlowStep < 3 ? (
            <button
              onClick={handleNext}
              onMouseEnter={() => playHover()}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 px-4 py-2 text-sm font-rajdhani tracking-wider uppercase transition-all text-white/50 hover:text-white/80 disabled:opacity-10 disabled:cursor-not-allowed"
            >
              Next <span className="text-sm">&#9656;</span>
            </button>
          ) : (
            <button
              onClick={() => {
                playButtonPress()
                handleExit()
              }}
              onMouseEnter={() => playHover()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-rajdhani tracking-wider uppercase transition-all text-white/60 hover:text-white/90 border border-white/[0.1] hover:border-white/[0.2]"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </ImmersiveGameFlow3D>
  )
}
