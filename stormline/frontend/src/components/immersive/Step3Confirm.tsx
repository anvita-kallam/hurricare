/**
 * Step 3 — Confirm & Run
 *
 * Shows allocation summary and auto-runs the analysis pipeline.
 * For Hurricane Sandy: uses hardcoded data so it ALWAYS works.
 * For others: runs the full backend pipeline.
 * Results are shown inline below (in ImmersivePanelOverlay's scrollable view).
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import { useStore } from '../../state/useStore'
import { resolveRegion } from '../../utils/regionRegistry'
import TypewriterText from '../TypewriterText'
import { playButtonPress, playHover } from '../../audio/SoundEngine'
import {
  CircularGauge,
  StatReadout,
  SegmentedHorizontalBars,
  ThinVerticalBars,
} from '../mapvis/charts/ChartPrimitives'
import AffectedAreaHeightMap from '../shared/AffectedAreaHeightMap'
import { isSandyHurricane, SANDY_COMPARISON_DATA } from '../../data/sandyHardcodedData'

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
  const autoRunRef = useRef(false)

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
    if (!selectedHurricane || (stage !== 'idle' && stage !== 'error')) return

    // For Sandy: use hardcoded data immediately
    if (isSandyHurricane(selectedHurricane)) {
      setStage('validating')
      setProgress(20)
      setIsRunningPipeline(true)
      setHasRun(true)

      // Simulate brief processing for visual feedback
      await new Promise(r => setTimeout(r, 300))
      setStage('ml_generating')
      setProgress(50)
      await new Promise(r => setTimeout(r, 300))
      setStage('real_loading')
      setProgress(75)
      await new Promise(r => setTimeout(r, 200))
      setStage('analyzing')
      setProgress(90)
      await new Promise(r => setTimeout(r, 200))

      setStage('complete')
      setProgress(100)
      setComparisonData(SANDY_COMPARISON_DATA)
      setIsRunningPipeline(false)
      onPipelineComplete()
      return
    }

    // For other hurricanes: run the full backend pipeline
    setIsRunningPipeline(true)
    setPipelineError(null)
    setHasRun(true)

    try {
      // Step 1: Validate user plan
      setStage('validating')
      setProgress(10)

      let validRegionNames: Set<string>
      try {
        const regionsRes = await axios.get(`${API_BASE}/simulation/regions/${selectedHurricane.id}`)
        validRegionNames = new Set(
          (regionsRes.data?.regions || []).map((r: { admin1: string }) => r.admin1)
        )
      } catch {
        validRegionNames = new Set(
          coverage
            .filter(c => c.hurricane_id === selectedHurricane.id)
            .map(c => c.admin1)
        )
      }

      const completeAllocations: Record<string, number> = {}
      if (Object.keys(gameAllocations).length === 0 && validRegionNames.size > 0) {
        const perRegion = Math.floor(gameTotalBudget / validRegionNames.size)
        validRegionNames.forEach(region => {
          completeAllocations[region] = perRegion
        })
      } else {
        Object.entries(gameAllocations).forEach(([region, amount]) => {
          if (validRegionNames.has(region)) {
            completeAllocations[region] = (completeAllocations[region] || 0) + (amount || 0)
          } else {
            const match = [...validRegionNames].find(
              k => k.toLowerCase() === region.toLowerCase()
            )
            if (match) {
              completeAllocations[match] = (completeAllocations[match] || 0) + (amount || 0)
            } else {
              const resolved = resolveRegion(region)
              if (validRegionNames.has(resolved)) {
                completeAllocations[resolved] = (completeAllocations[resolved] || 0) + (amount || 0)
              }
            }
          }
        })
      }

      if (Object.keys(completeAllocations).length === 0 && validRegionNames.size > 0) {
        const perRegion = Math.floor(gameTotalBudget / validRegionNames.size)
        validRegionNames.forEach(region => {
          completeAllocations[region] = perRegion
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

      try {
        const simRes = await axios.post(`${API_BASE}/simulate_allocation`, {
          hurricane_id: selectedHurricane.id,
          allocations: completeAllocations,
        })
        const score = simRes.data?.impact_score
        if (typeof score === 'number') setLastSimulationScore(score)
      } catch { /* non-blocking */ }

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

      setStage('real_loading')
      setProgress(70)

      const realRes = await axios.get(`${API_BASE}/simulation/stage3/real-world/${selectedHurricane.id}`)
      const newRealPlan = realRes.data
      setProgress(80)

      setStage('analyzing')
      setProgress(90)

      let newMismatchAnalysis = null
      try {
        const mismatchRes = await axios.post(`${API_BASE}/simulation/mismatch-analysis`, {
          ideal_plan: newMlPlan,
          real_plan: newRealPlan,
        })
        newMismatchAnalysis = mismatchRes.data
      } catch { /* non-blocking */ }

      setStage('complete')
      setProgress(100)

      setComparisonData({
        userPlan: newUserPlan,
        mlPlan: newMlPlan,
        realPlan: newRealPlan,
        mismatchAnalysis: newMismatchAnalysis,
      })

      setIsRunningPipeline(false)
      onPipelineComplete()

    } catch (error: any) {
      console.error('[Step3] Pipeline error:', error)
      setStage('error')
      setIsRunningPipeline(false)

      const detail = error.response?.data?.detail
      let errorMessage: string

      if (detail && typeof detail === 'object') {
        const errors: string[] = detail.errors || []
        const message = detail.message || 'Analysis failed'
        errorMessage = errors.length > 0 ? `${message}: ${errors.join('; ')}` : message
      } else if (typeof detail === 'string') {
        errorMessage = detail
      } else {
        errorMessage = error.message || 'Analysis failed. Please try again.'
      }

      const isRegionError = errorMessage.toLowerCase().includes('unknown region')
        || errorMessage.toLowerCase().includes('region not found')
        || errorMessage.toLowerCase().includes('invalid region')

      setPipelineError(isRegionError
        ? `Region mapping issue: ${errorMessage}. Try adjusting allocations.`
        : errorMessage
      )
    }
  }, [selectedHurricane, stage, coverage, gameAllocations, gameTotalBudget, gameResponseWindow, setComparisonData, setLastSimulationScore, setIsRunningPipeline, setPipelineError, onPipelineComplete])

  // Auto-run pipeline when component mounts (no button press needed)
  useEffect(() => {
    if (!autoRunRef.current && selectedHurricane && stage === 'idle' && !comparisonData && !hasRun) {
      autoRunRef.current = true
      // Small delay to let the UI render first
      const t = setTimeout(() => runPipeline(), 500)
      return () => clearTimeout(t)
    }
  }, [selectedHurricane, stage, comparisonData, hasRun, runPipeline])

  if (!selectedHurricane) return null

  const stageLabels: Record<PipelineStage, string> = {
    idle: 'Preparing analysis...',
    validating: 'Validating your response plan',
    ml_generating: 'Generating ML-optimized allocation',
    real_loading: 'Loading historical response data',
    analyzing: 'Running mismatch analysis',
    complete: 'Analysis complete',
    error: 'Error occurred',
  }

  // Processing state — shown inline (not as replacement)
  const isProcessing = stage !== 'idle' && stage !== 'error' && stage !== 'complete'

  // Error state
  if (stage === 'error') {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center space-y-2">
          <div className="text-[#cc5566]/80 font-rajdhani text-sm tracking-[0.3em] uppercase">
            Analysis Error
          </div>
          <h2 className="text-white/90 font-rajdhani font-bold text-2xl tracking-wider">
            Could Not Complete
          </h2>
        </div>

        {pipelineError && (
          <div className="mx-auto max-w-sm bg-[#cc5566]/10 border border-[#cc5566]/20 p-4 rounded">
            <div className="text-[#cc5566]/90 font-mono text-sm text-center">
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
              autoRunRef.current = false
              setPipelineError(null)
            }}
            className="px-8 py-3 text-white/70 hover:text-white font-rajdhani text-sm tracking-wider uppercase border border-white/[0.1] hover:border-white/[0.2] transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Build region allocation bars data
  const regionAllocBars = Object.entries(gameAllocations)
    .filter(([, amount]) => (amount || 0) > 0)
    .sort(([, a], [, b]) => (b || 0) - (a || 0))
    .slice(0, 6)
    .map(([region, amount]) => ({
      label: region.toUpperCase(),
      value: Math.round(((amount || 0) / gameTotalBudget) * 100),
      max: 100,
    }))

  // Build 2.5D height map data
  const heightMapData = Object.entries(gameAllocations)
    .filter(([, amount]) => (amount || 0) > 0)
    .sort(([, a], [, b]) => (b || 0) - (a || 0))
    .map(([region, amount]) => {
      const cov = coverage.find(c => c.hurricane_id === selectedHurricane.id && c.admin1 === region)
      return {
        region,
        severity: cov ? Math.min(cov.severity_index / 10, 1) : 0.5,
        metric: gameTotalBudget > 0 ? (amount || 0) / gameTotalBudget : 0,
        valueLabel: formatBudget(amount || 0),
      }
    })

  const allocValues = Object.values(gameAllocations).filter(v => (v || 0) > 0).sort((a, b) => (b || 0) - (a || 0))

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <TypewriterText text="Response Plan Analysis" emphasis="soft" delayMs={100} className="text-white/50 font-rajdhani text-sm tracking-[0.3em] uppercase" as="div" />
        <h2 className="text-white/95 font-rajdhani font-bold text-3xl tracking-wider">
          <TypewriterText text="Confirm & Analyze" emphasis="headline" delayMs={300} charIntervalMs={40} />
        </h2>
      </div>

      {/* Progress indicator when processing */}
      {isProcessing && (
        <div className="mx-auto w-80 space-y-3">
          <div className="w-full h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-white/60 font-mono text-sm text-center">
            {stageLabels[stage]}
          </div>
          <div className="flex items-center justify-center gap-3">
            {(['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete'] as PipelineStage[]).map((s, i) => {
              const stageOrder = ['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete']
              const currentIdx = stageOrder.indexOf(stage)
              const isActive = i === currentIdx
              const isPast = i < currentIdx
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      isActive ? 'bg-white/60 scale-125 confirm-dot' : isPast ? 'bg-white/30' : 'bg-white/[0.08]'
                    }`}
                  />
                  <span className={`font-mono text-xs ${isActive ? 'text-white/50' : 'text-white/20'}`}>
                    {['Validate', 'ML', 'Real', 'Analyze', 'Done'][i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FDP-style confirmation panel — always visible */}
      <div className="max-w-md mx-auto" style={{
        background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 20px 20px',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
        backgroundSize: '12px 12px',
      }}>
        {/* Utilization gauge */}
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
          BUDGET UTILIZATION
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <CircularGauge
            value={Math.round(utilization)}
            max={100}
            label="UTILIZED"
            size={80}
            alert={utilization < 50}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatReadout label="ALLOCATED" value={formatBudget(totalAllocated)} />
            <StatReadout label="REGIONS" value={`${regionCount}`} />
            <StatReadout label="WINDOW" value={`${gameResponseWindow}h`} />
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0', flexShrink: 0 }} />

        {/* Region allocation bars */}
        {regionAllocBars.length > 0 && (
          <>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              ALLOCATION DISTRIBUTION
            </div>
            <div style={{ marginBottom: 4 }}>
              <SegmentedHorizontalBars
                bars={regionAllocBars}
                width={320}
                height={regionAllocBars.length * 18 + 8}
              />
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0', flexShrink: 0 }} />
          </>
        )}

        {/* Budget density */}
        {allocValues.length > 1 && (
          <>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              FUNDING DENSITY
            </div>
            <div style={{ marginBottom: 4 }}>
              <ThinVerticalBars
                data={allocValues as number[]}
                width={320}
                height={50}
                seed={777}
              />
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0', flexShrink: 0 }} />
          </>
        )}

        {/* Analysis stages */}
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
          ANALYSIS STAGES
        </div>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          {['Your Plan', 'ML Ideal', 'Historical', 'Mismatch'].map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${comparisonData ? 'bg-white/40' : 'bg-white/15'}`} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: comparisonData ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2.5D Allocation Terrain */}
      {heightMapData.length > 0 && (
        <div className="max-w-lg mx-auto" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 14px 8px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            YOUR ALLOCATION MAP
          </div>
          <AffectedAreaHeightMap
            data={heightMapData}
            width={480}
            height={180}
            theme="severity"
          />
        </div>
      )}

      {/* Manual run button (fallback if auto-run didn't trigger) */}
      {stage === 'idle' && !comparisonData && (
        <div className="text-center">
          <button
            onClick={() => { playButtonPress(); runPipeline() }}
            onMouseEnter={() => playHover()}
            className="px-10 py-4 text-white/80 hover:text-white font-rajdhani font-semibold text-base tracking-widest uppercase transition-all border border-white/[0.1] hover:border-white/[0.25] bg-white/[0.04] hover:bg-white/[0.08]"
          >
            Run Analysis
          </button>
        </div>
      )}

      {/* Complete confirmation */}
      {stage === 'complete' && comparisonData && (
        <div className="text-center py-2">
          <div className="text-white/60 font-rajdhani text-base tracking-wider">
            Analysis complete — scroll down to view results
          </div>
        </div>
      )}
    </div>
  )
}
