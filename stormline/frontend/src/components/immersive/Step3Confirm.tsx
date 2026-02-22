/**
 * Step 3 — Confirm & Run
 *
 * One focused confirmation panel.
 * Shows allocation summary, then runs the pipeline.
 * Cinematic "processing" transition with subtle depth motion.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../../state/useStore'
import { resolveRegion } from '../../utils/regionRegistry'

const API_BASE = 'http://localhost:8000'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

type PipelineStage = 'idle' | 'validating' | 'ml_generating' | 'real_loading' | 'analyzing' | 'complete' | 'error'

interface Step3ConfirmProps {
  onPipelineComplete: () => void
}

export default function Step3Confirm({ onPipelineComplete }: Step3ConfirmProps) {
  const {
    selectedHurricane,
    coverage,
    gameAllocations,
    gameTotalBudget,
    gameResponseWindow,
    setComparisonData,
    setLastSimulationScore,
    setIsRunningPipeline,
    setPipelineError,
    pipelineError,
    comparisonData,
  } = useStore()

  const [stage, setStage] = useState<PipelineStage>('idle')
  const [progress, setProgress] = useState(0)
  const [hasRun, setHasRun] = useState(false)

  // If we already have comparison data (e.g., navigated back and forward), show complete state
  useEffect(() => {
    if (comparisonData && !hasRun) {
      setStage('complete')
      setProgress(100)
      setHasRun(true)
    }
  }, [comparisonData, hasRun])

  const totalAllocated = useMemo(() => {
    return Object.values(gameAllocations).reduce((s, v) => s + (v || 0), 0)
  }, [gameAllocations])

  const regionCount = Object.keys(gameAllocations).filter(r => (gameAllocations[r] || 0) > 0).length
  const utilization = gameTotalBudget > 0 ? (totalAllocated / gameTotalBudget) * 100 : 0

  const runPipeline = useCallback(async () => {
    if (!selectedHurricane || stage !== 'idle') return

    setIsRunningPipeline(true)
    setPipelineError(null)
    setHasRun(true)

    try {
      // Step 1: Validate user plan
      setStage('validating')
      setProgress(10)

      // Build known regions from coverage data
      const knownRegions = new Set(
        coverage
          .filter(c => c.hurricane_id === selectedHurricane.id)
          .map(c => c.admin1)
      )

      // Map allocations to known region names
      const completeAllocations: Record<string, number> = {}
      if (Object.keys(gameAllocations).length === 0 && knownRegions.size > 0) {
        // No allocations set — distribute evenly across known regions
        const perRegion = Math.floor(gameTotalBudget / knownRegions.size)
        knownRegions.forEach(region => {
          completeAllocations[region] = perRegion
        })
      } else {
        Object.entries(gameAllocations).forEach(([region, amount]) => {
          if (knownRegions.size > 0 && !knownRegions.has(region)) {
            // Try resolved name
            const resolved = resolveRegion(region)
            if (knownRegions.has(resolved)) {
              completeAllocations[resolved] = (completeAllocations[resolved] || 0) + (amount || 0)
            } else {
              // Try case-insensitive match against known regions
              const match = [...knownRegions].find(
                k => k.toLowerCase() === region.toLowerCase()
              )
              if (match) {
                completeAllocations[match] = (completeAllocations[match] || 0) + (amount || 0)
              } else {
                console.warn(`[Step3] Skipping unmappable region: ${region}`)
              }
            }
          } else {
            completeAllocations[region] = amount || 0
          }
        })
      }

      const userRes = await axios.post(`${API_BASE}/simulation/stage1/user-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: completeAllocations,
        total_budget: gameTotalBudget,
        response_window_hours: gameResponseWindow,
      })
      const newUserPlan = userRes.data
      setProgress(25)

      // Run simulation for score
      try {
        const simRes = await axios.post(`${API_BASE}/simulate_allocation`, {
          hurricane_id: selectedHurricane.id,
          allocations: completeAllocations,
        })
        const score = simRes.data?.impact_score
        if (typeof score === 'number') {
          setLastSimulationScore(score)
        }
      } catch {
        console.warn('[Step3] Simulation score failed (non-blocking)')
      }

      // Step 2: Generate ML plan
      setStage('ml_generating')
      setProgress(40)

      const mlRes = await axios.post(`${API_BASE}/simulation/stage2/ml-ideal-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: {},
        total_budget: gameTotalBudget,
        response_window_hours: gameResponseWindow,
      })
      const newMlPlan = mlRes.data
      setProgress(60)

      // Step 3: Load real-world data
      setStage('real_loading')
      setProgress(70)

      const realRes = await axios.get(`${API_BASE}/simulation/stage3/real-world/${selectedHurricane.id}`)
      const newRealPlan = realRes.data
      setProgress(80)

      // Step 4: Generate mismatch analysis
      setStage('analyzing')
      setProgress(90)

      let newMismatchAnalysis = null
      try {
        const mismatchRes = await axios.post(`${API_BASE}/simulation/mismatch-analysis`, {
          ideal_plan: newMlPlan,
          real_plan: newRealPlan,
        })
        newMismatchAnalysis = mismatchRes.data
      } catch {
        console.warn('[Step3] Mismatch analysis failed (non-blocking)')
      }

      setStage('complete')
      setProgress(100)

      // Store comparison data
      setComparisonData({
        userPlan: newUserPlan,
        mlPlan: newMlPlan,
        realPlan: newRealPlan,
        mismatchAnalysis: newMismatchAnalysis,
      })

      setIsRunningPipeline(false)

      // Auto-advance to results
      onPipelineComplete()

    } catch (error: any) {
      console.error('[Step3] Pipeline error:', error)
      setStage('error')
      setIsRunningPipeline(false)

      const detail = error.response?.data?.detail
      let errorMessage: string

      if (detail && typeof detail === 'object') {
        // Backend returns {message: "...", errors: [...], warnings: [...]}
        const errors: string[] = detail.errors || []
        const message = detail.message || 'Analysis failed'
        if (errors.length > 0) {
          errorMessage = `${message}: ${errors.join('; ')}`
        } else {
          errorMessage = message
        }
      } else if (typeof detail === 'string') {
        errorMessage = detail
      } else {
        errorMessage = error.message || 'Analysis failed. Please try again.'
      }

      // Guard against region errors — provide a helpful message
      const isRegionError = errorMessage.toLowerCase().includes('unknown region')
        || errorMessage.toLowerCase().includes('region not found')
        || errorMessage.toLowerCase().includes('invalid region')

      if (isRegionError) {
        setPipelineError(`Region mapping issue: ${errorMessage}. Try adjusting allocations.`)
      } else {
        setPipelineError(errorMessage)
      }
    }
  }, [selectedHurricane, stage, coverage, gameAllocations, gameTotalBudget, gameResponseWindow, setComparisonData, setLastSimulationScore, setIsRunningPipeline, setPipelineError, onPipelineComplete])

  if (!selectedHurricane) return null

  const stageLabels: Record<PipelineStage, string> = {
    idle: '',
    validating: 'Validating your response plan',
    ml_generating: 'Generating ML-optimized allocation',
    real_loading: 'Loading historical response data',
    analyzing: 'Running mismatch analysis',
    complete: 'Analysis complete',
    error: 'Error occurred',
  }

  // Processing state
  if (stage !== 'idle' && stage !== 'error' && stage !== 'complete') {
    return (
      <div className="space-y-8 py-4">
        <div className="text-center space-y-2">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
            Processing
          </div>
          <h2 className="text-white/70 font-rajdhani font-bold text-xl tracking-wider">
            Running Analysis
          </h2>
        </div>

        {/* Progress bar */}
        <div className="mx-auto w-64">
          <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden sim-progress-bar">
            <div
              className="h-full bg-white/30 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-white/25 font-mono text-[10px] text-center mt-3">
            {stageLabels[stage]}
          </div>
        </div>

        {/* Pipeline stage dots */}
        <div className="flex items-center justify-center gap-3">
          {(['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete'] as PipelineStage[]).map((s, i) => {
            const stageOrder = ['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete']
            const currentIdx = stageOrder.indexOf(stage)
            const isActive = i === currentIdx
            const isPast = i < currentIdx
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    isActive ? 'bg-white/50 scale-125 confirm-dot' : isPast ? 'bg-white/20' : 'bg-white/[0.06]'
                  }`}
                />
                <span className={`font-mono text-[8px] ${isActive ? 'text-white/30' : 'text-white/10'}`}>
                  {['Validate', 'ML', 'Real', 'Analyze', 'Done'][i]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Subtle instruction */}
        <div className="text-center">
          <div className="text-white/10 font-mono text-[9px]">
            Please wait while the analysis runs
          </div>
        </div>
      </div>
    )
  }

  // Complete state (briefly shown before auto-advance)
  if (stage === 'complete') {
    return (
      <div className="space-y-8 py-4">
        <div className="text-center space-y-2">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
            Analysis Complete
          </div>
          <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
            Results Ready
          </h2>
        </div>
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />
          ))}
        </div>
        <div className="text-center">
          <div className="text-white/20 font-mono text-[10px]">
            Proceeding to results...
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (stage === 'error') {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center space-y-2">
          <div className="text-[#cc5566]/60 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
            Analysis Error
          </div>
          <h2 className="text-white/70 font-rajdhani font-bold text-xl tracking-wider">
            Could Not Complete
          </h2>
        </div>

        {pipelineError && (
          <div className="mx-auto max-w-sm bg-[#cc5566]/10 border border-[#cc5566]/20 p-3 rounded">
            <div className="text-[#cc5566]/80 font-mono text-[10px] text-center">
              {pipelineError}
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => {
              setStage('idle')
              setProgress(0)
              setHasRun(false)
              setPipelineError(null)
            }}
            className="px-6 py-2 text-white/50 hover:text-white/80 font-rajdhani text-xs tracking-wider uppercase border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Idle state — confirmation panel
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
          Response Plan Prepared
        </div>
        <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
          Confirm & Analyze
        </h2>
      </div>

      {/* Budget utilization ring */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-28 h-28">
          <svg width={112} height={112} className="transform -rotate-90">
            <circle
              cx={56} cy={56} r={48}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3}
            />
            <circle
              cx={56} cy={56} r={48}
              fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3}
              strokeDasharray={2 * Math.PI * 48}
              strokeDashoffset={2 * Math.PI * 48 * (1 - utilization / 100)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white/80 font-mono text-lg font-medium">
              {utilization.toFixed(0)}%
            </span>
            <span className="text-white/25 font-rajdhani text-[8px] tracking-widest uppercase">
              Utilized
            </span>
          </div>
        </div>

        {/* Plan summary */}
        <div className="flex gap-8">
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">{formatBudget(totalAllocated)}</div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Allocated</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">{regionCount}</div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Regions</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">{gameResponseWindow}h</div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Window</div>
          </div>
        </div>
      </div>

      {/* Comparison indicators */}
      <div className="flex items-center justify-center gap-3">
        {['Your Plan', 'ML Ideal', 'Historical', 'Mismatch'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/20"
            />
            <span className="text-white/25 font-mono text-[9px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Run button */}
      <div className="text-center">
        <button
          onClick={runPipeline}
          className="px-8 py-3 text-white/60 hover:text-white/90 font-rajdhani font-semibold text-sm tracking-widest uppercase transition-all border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.03] hover:bg-white/[0.06]"
        >
          Run Analysis
        </button>
      </div>
    </div>
  )
}
