import { useState, useMemo, useEffect, useCallback } from 'react'
import { useStore } from '../state/useStore'
import {
  RingIndicator,
  CompactBarCluster,
  DeltaBar,
  SeverityGrid,
  DenseTimeSeries,
  FundingFlow,
  MetricCard,
  CoverageSurfaceMap,
  ContourSurface,
} from './HUDCharts'

// ─── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

const STEP_LABELS: Record<Step, string> = {
  1: 'System Overview',
  2: 'Funding & Allocation',
  3: 'Coverage & Response',
  4: 'Comparison & Delta',
}

const STEP_SUBTITLES: Record<Step, string> = {
  1: 'Situation Frame',
  2: 'Allocation Dynamics',
  3: 'Response Outcome',
  4: 'Delta Insights',
}

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function PostSimulationSteps() {
  const {
    selectedHurricane,
    comparisonData,
    setShowComparisonPage,
    setSelectedHurricane,
    coverage,
  } = useStore()

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [transitionDir, setTransitionDir] = useState<'forward' | 'backward'>('forward')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [stepRevealed, setStepRevealed] = useState(false)
  const [headerRevealed, setHeaderRevealed] = useState(false)

  // Reveal header on mount
  useEffect(() => {
    const t = setTimeout(() => setHeaderRevealed(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Reveal content after mount / step change
  useEffect(() => {
    setStepRevealed(false)
    const t = setTimeout(() => setStepRevealed(true), 120)
    return () => clearTimeout(t)
  }, [currentStep])

  const goToStep = useCallback((next: Step) => {
    if (next === currentStep || isTransitioning) return
    setTransitionDir(next > currentStep ? 'forward' : 'backward')
    setIsTransitioning(true)
    setStepRevealed(false)

    setTimeout(() => {
      setCurrentStep(next)
      setIsTransitioning(false)
    }, 350)
  }, [currentStep, isTransitioning])

  const handleBack = useCallback(() => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }, [setShowComparisonPage, setSelectedHurricane])

  // ─── Guard ───

  if (!comparisonData || !comparisonData.mlPlan || !comparisonData.realPlan || !comparisonData.userPlan) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#020810]">
        <div className="text-white/30 font-rajdhani tracking-widest uppercase text-sm">
          Initializing analysis systems...
        </div>
      </div>
    )
  }

  const { userPlan, mlPlan, realPlan, mismatchAnalysis } = comparisonData

  // ─── Derived Data ──────────────────────────────────────────────────────────

  const regionData = useMemo(() => {
    return realPlan.allocations.map((ra: any) => {
      const ua = userPlan.allocations.find((a: any) => a.region === ra.region)
      const ma = mlPlan.allocations.find((a: any) => a.region === ra.region)
      const covData = coverage.find(c => c.hurricane_id === selectedHurricane?.id && c.admin1 === ra.region)

      return {
        region: ra.region,
        userBudget: ua?.budget || 0,
        mlBudget: ma?.budget || 0,
        realBudget: ra.budget,
        userCoverage: ua?.coverage_estimate?.coverage_ratio || 0,
        mlCoverage: ma?.coverage_estimate?.coverage_ratio || 0,
        realCoverage: ra.coverage_estimate?.coverage_ratio || 0,
        peopleCovered: {
          user: ua?.coverage_estimate?.people_covered || 0,
          ml: ma?.coverage_estimate?.people_covered || 0,
          real: ra.coverage_estimate?.people_covered || 0,
        },
        unmetNeed: ra.coverage_estimate?.unmet_need || 0,
        severity: covData?.severity_index ? Math.min(covData.severity_index / 10, 1) : 0.5,
        peopleInNeed: covData?.people_in_need || 0,
      }
    })
  }, [userPlan, mlPlan, realPlan, coverage, selectedHurricane])

  const totalUserCovered = userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
  const totalMlCovered = mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
  const totalRealCovered = realPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)

  const avgUserCoverage = userPlan.allocations.length > 0
    ? userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / userPlan.allocations.length
    : 0
  const avgMlCoverage = mlPlan.allocations.length > 0
    ? mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length
    : 0
  const avgRealCoverage = realPlan.allocations.length > 0
    ? realPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length
    : 0

  const coverageDelta = totalMlCovered - totalRealCovered

  const barClusterData = useMemo(() => {
    return regionData.map((r: any) => ({
      label: r.region,
      user: r.userBudget,
      ml: r.mlBudget,
      real: r.realBudget,
    }))
  }, [regionData])

  const severityGridData = useMemo(() => {
    return regionData.map((r: any) => ({
      region: r.region,
      severity: r.severity,
      coverage: r.realCoverage,
      gap: r.mlCoverage - r.realCoverage,
    }))
  }, [regionData])

  const maxBudget = useMemo(() => {
    return Math.max(
      ...regionData.map((r: any) => Math.abs(r.mlBudget - r.realBudget)),
      1
    )
  }, [regionData])

  const timeSeriesData = useMemo(() => {
    const steps = 12
    const userVals: number[] = []
    const mlVals: number[] = []
    const realVals: number[] = []

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      const userCumulative = userPlan.total_budget * Math.pow(t, 0.7) * (0.8 + Math.random() * 0.2)
      const mlCumulative = mlPlan.total_budget * Math.pow(t, 0.5) * (0.9 + Math.random() * 0.1)
      const realCumulative = realPlan.total_budget * Math.pow(t, 0.9) * (0.7 + Math.random() * 0.3)
      userVals.push(userCumulative)
      mlVals.push(mlCumulative)
      realVals.push(realCumulative)
    }

    return [
      { name: 'You', color: '#4488aa', values: userVals },
      { name: 'ML', color: '#8855aa', values: mlVals },
      { name: 'Real', color: '#aa4444', values: realVals },
    ]
  }, [userPlan, mlPlan, realPlan])

  // ─── Transition class helper ──────────────────────────────────────────────

  const contentClass = isTransitioning
    ? `step-exit-${transitionDir}`
    : stepRevealed
      ? `step-enter-${transitionDir} step-enter-active`
      : `step-enter-${transitionDir}`

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-screen h-screen bg-[#020810] overflow-hidden flex flex-col cc-root">
      {/* ─── Top Bar ─── */}
      <header
        className="h-10 flex items-center justify-between px-4 border-b border-white/[0.06] bg-black/40 shrink-0 cc-header"
        style={{
          opacity: headerRevealed ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/80 font-rajdhani font-bold text-sm tracking-wider">HURRICARE</span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/30 font-rajdhani text-xs tracking-widest uppercase">Systems Analysis</span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/50 font-mono text-xs">
            {selectedHurricane?.name} ({selectedHurricane?.year}) — Cat {selectedHurricane?.max_category}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Step progress indicator */}
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4] as Step[]).map(step => (
              <button
                key={step}
                onClick={() => goToStep(step)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-rajdhani tracking-wider uppercase transition-all duration-300 border ${
                  currentStep === step
                    ? 'bg-white/10 text-white/80 border-white/15'
                    : currentStep > step
                      ? 'text-white/35 border-white/[0.06] hover:text-white/50 hover:border-white/10'
                      : 'text-white/15 border-transparent hover:text-white/30'
                }`}
              >
                <span className={`w-3.5 h-3.5 flex items-center justify-center text-[9px] font-mono rounded-full border transition-all duration-300 ${
                  currentStep === step
                    ? 'border-white/30 text-white/80'
                    : currentStep > step
                      ? 'border-white/15 text-white/30 bg-white/[0.04]'
                      : 'border-white/[0.06] text-white/15'
                }`}>
                  {currentStep > step ? '✓' : step}
                </span>
                <span className="hidden lg:inline">{STEP_LABELS[step]}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleBack}
            className="text-white/30 hover:text-white/60 font-rajdhani text-xs tracking-wider uppercase transition-colors px-2 py-1 border border-white/[0.06] hover:border-white/15"
          >
            Exit
          </button>
        </div>
      </header>

      {/* ─── Step Content ─── */}
      <div className="flex-1 overflow-hidden relative cc-grid">
        {/* Scanline */}
        <div className="cc-scanline" />

        {/* Animated content wrapper */}
        <div className={`absolute inset-0 overflow-hidden ${contentClass}`}>
          {currentStep === 1 && (
            <Step1Overview
              selectedHurricane={selectedHurricane}
              regionData={regionData}
              avgUserCoverage={avgUserCoverage}
              avgMlCoverage={avgMlCoverage}
              avgRealCoverage={avgRealCoverage}
              totalUserCovered={totalUserCovered}
              totalMlCovered={totalMlCovered}
              totalRealCovered={totalRealCovered}
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
              revealed={stepRevealed && !isTransitioning}
            />
          )}
          {currentStep === 2 && (
            <Step2Funding
              regionData={regionData}
              barClusterData={barClusterData}
              maxBudget={maxBudget}
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
              revealed={stepRevealed && !isTransitioning}
            />
          )}
          {currentStep === 3 && (
            <Step3Coverage
              regionData={regionData}
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
              avgUserCoverage={avgUserCoverage}
              avgMlCoverage={avgMlCoverage}
              avgRealCoverage={avgRealCoverage}
              totalUserCovered={totalUserCovered}
              totalMlCovered={totalMlCovered}
              totalRealCovered={totalRealCovered}
              timeSeriesData={timeSeriesData}
              revealed={stepRevealed && !isTransitioning}
            />
          )}
          {currentStep === 4 && (
            <Step4Delta
              regionData={regionData}
              severityGridData={severityGridData}
              maxBudget={maxBudget}
              coverageDelta={coverageDelta}
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
              mismatchAnalysis={mismatchAnalysis}
              revealed={stepRevealed && !isTransitioning}
            />
          )}
        </div>
      </div>

      {/* ─── Bottom Navigation Bar ─── */}
      <div className="h-11 shrink-0 flex items-center justify-between px-4 border-t border-white/[0.06] bg-black/40">
        <button
          onClick={() => currentStep > 1 && goToStep((currentStep - 1) as Step)}
          disabled={currentStep === 1}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-rajdhani tracking-wider uppercase transition-all border border-white/[0.06] hover:border-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70"
        >
          <span className="text-[10px]">◂</span> Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-white/20 font-mono text-[10px]">
            Step {currentStep} of 4
          </span>
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4] as Step[]).map(step => (
              <div
                key={step}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  step === currentStep
                    ? 'w-5 bg-white/40'
                    : step < currentStep
                      ? 'w-2 bg-white/15'
                      : 'w-2 bg-white/[0.06]'
                }`}
              />
            ))}
          </div>
          <span className="text-white/15 font-rajdhani text-[10px] tracking-wider uppercase">
            {STEP_SUBTITLES[currentStep]}
          </span>
        </div>

        <button
          onClick={() => currentStep < 4 && goToStep((currentStep + 1) as Step)}
          disabled={currentStep === 4}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-rajdhani tracking-wider uppercase transition-all border border-white/[0.06] hover:border-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70"
        >
          Next <span className="text-[10px]">▸</span>
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — System Overview / Situation Frame
// ═══════════════════════════════════════════════════════════════════════════════

function Step1Overview({ selectedHurricane, regionData, avgUserCoverage, avgMlCoverage, avgRealCoverage, totalUserCovered, totalMlCovered, totalRealCovered, userPlan, mlPlan, realPlan, revealed }: any) {

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-px p-px">

      {/* LEFT: Situation Summary (cols 1-4, full height) */}
      <div
        className="col-span-4 row-span-6 bg-black/30 p-4 overflow-y-auto cc-panel space-y-4"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(-24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Hurricane Identity */}
        <div className="pb-3 border-b border-white/[0.05]">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Situation Frame</div>
          <h2 className="text-white/90 font-rajdhani font-bold text-xl tracking-wider leading-tight">
            {selectedHurricane?.name}
          </h2>
          <div className="text-white/30 font-mono text-xs mt-1">
            {selectedHurricane?.year} — Category {selectedHurricane?.max_category}
          </div>
          <div className="text-white/20 font-mono text-[10px] mt-0.5">
            {selectedHurricane?.affected_countries?.join(' / ')}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MetricCard
            label="Population Affected"
            value={(selectedHurricane?.estimated_population_affected || 0).toLocaleString()}
            subtext="total impacted"
          />
          <MetricCard
            label="Regions"
            value={regionData.length.toString()}
            subtext="affected areas"
          />
          <MetricCard
            label="Total Budget"
            value={formatBudget(userPlan.total_budget)}
            subtext="allocated funds"
          />
          <MetricCard
            label="Response Window"
            value={`${userPlan.response_window_hours || 72}h`}
            subtext="deployment time"
          />
        </div>

        {/* Plan Legend */}
        <div className="flex items-center gap-3 py-2 border-y border-white/[0.05]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4488aa]" />
            <span className="text-white/30 font-mono text-[9px]">Your Plan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#8855aa]" />
            <span className="text-white/30 font-mono text-[9px]">ML Ideal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#aa4444]" />
            <span className="text-white/30 font-mono text-[9px]">Historical</span>
          </div>
        </div>

        {/* Coverage Ring Indicators */}
        <div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Overall Coverage</div>
          <div className="flex justify-between">
            <RingIndicator value={avgUserCoverage * 100} max={100} label="Your Plan" color="#4488aa" size={68}>
              {(avgUserCoverage * 100).toFixed(0)}%
            </RingIndicator>
            <RingIndicator value={avgMlCoverage * 100} max={100} label="ML Ideal" color="#8855aa" size={68}>
              {(avgMlCoverage * 100).toFixed(0)}%
            </RingIndicator>
            <RingIndicator value={avgRealCoverage * 100} max={100} label="Historical" color="#aa4444" size={68}>
              {(avgRealCoverage * 100).toFixed(0)}%
            </RingIndicator>
          </div>
        </div>

        {/* People Reached */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-sm p-2">
            <div className="text-[#4488aa]/70 font-mono text-[10px]">{totalUserCovered.toLocaleString()}</div>
            <div className="text-white/20 font-rajdhani text-[8px] tracking-wider uppercase">You Reached</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-sm p-2">
            <div className="text-[#8855aa]/70 font-mono text-[10px]">{totalMlCovered.toLocaleString()}</div>
            <div className="text-white/20 font-rajdhani text-[8px] tracking-wider uppercase">ML Reached</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-sm p-2">
            <div className="text-[#aa4444]/70 font-mono text-[10px]">{totalRealCovered.toLocaleString()}</div>
            <div className="text-white/20 font-rajdhani text-[8px] tracking-wider uppercase">Real Reached</div>
          </div>
        </div>
      </div>

      {/* CENTER: Severity Contour Surface (cols 5-12, rows 1-4) */}
      <div
        className="col-span-8 row-span-4 bg-black/20 p-4 flex flex-col cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Severity Intensity Surface</span>
          <span className="text-white/15 font-mono text-[8px]">{regionData.length} regions mapped</span>
        </div>
        <div className="flex-1 min-h-0">
          <ContourSurface
            regions={regionData.map((r: any) => ({
              name: r.region,
              value: r.severity,
              max: 1,
            }))}
            colorFn={(ratio: number) => {
              if (ratio > 0.7) return '#cc4444'
              if (ratio > 0.4) return '#ccaa44'
              return '#44aa77'
            }}
            height={260}
          />
        </div>

        {/* Severity legend */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 rounded-full bg-[#44aa77]/60" />
            <span className="text-white/20 font-mono text-[8px]">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 rounded-full bg-[#ccaa44]/60" />
            <span className="text-white/20 font-mono text-[8px]">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 rounded-full bg-[#cc4444]/60" />
            <span className="text-white/20 font-mono text-[8px]">Critical</span>
          </div>
        </div>
      </div>

      {/* BOTTOM RIGHT: Region severity list (cols 5-12, rows 5-6) */}
      <div
        className="col-span-8 row-span-2 bg-black/30 border-t border-white/[0.04] p-3 overflow-y-auto cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
        }}
      >
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Region Severity Index</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {[...regionData]
            .sort((a: any, b: any) => b.severity - a.severity)
            .map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: r.severity > 0.7 ? '#cc4444' : r.severity > 0.4 ? '#ccaa44' : '#44aa77',
                  }}
                />
                <span className="text-white/40 font-rajdhani text-[10px] tracking-wide flex-1 truncate">{r.region}</span>
                <span className="text-white/30 font-mono text-[10px]">{(r.severity * 10).toFixed(1)}</span>
                <div className="w-16 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-800 ease-out"
                    style={{
                      width: `${r.severity * 100}%`,
                      backgroundColor: r.severity > 0.7 ? '#cc4444' : r.severity > 0.4 ? '#ccaa44' : '#44aa77',
                      opacity: 0.6,
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Funding & Allocation Dynamics
// ═══════════════════════════════════════════════════════════════════════════════

function Step2Funding({ regionData, barClusterData, maxBudget, userPlan, mlPlan, realPlan, revealed }: any) {

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-px p-px">

      {/* LEFT: Funding Flows (cols 1-4, full height) */}
      <div
        className="col-span-4 row-span-6 bg-black/30 p-4 overflow-y-auto cc-panel space-y-4"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(-24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Funding Distribution</div>

        {/* Your plan flow */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4488aa]" />
            <span className="text-white/40 font-rajdhani text-[10px] tracking-wider uppercase">Your Allocation</span>
            <span className="text-white/25 font-mono text-[9px] ml-auto">{formatBudget(userPlan.total_budget)}</span>
          </div>
          <FundingFlow
            allocations={userPlan.allocations}
            totalBudget={userPlan.total_budget}
            planLabel="Your Plan"
            color="#4488aa"
          />
        </div>

        {/* ML plan flow */}
        <div className="space-y-2 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#8855aa]" />
            <span className="text-white/40 font-rajdhani text-[10px] tracking-wider uppercase">ML Ideal</span>
            <span className="text-white/25 font-mono text-[9px] ml-auto">{formatBudget(mlPlan.total_budget)}</span>
          </div>
          <FundingFlow
            allocations={mlPlan.allocations}
            totalBudget={mlPlan.total_budget}
            planLabel="ML Ideal"
            color="#8855aa"
          />
        </div>

        {/* Real plan flow */}
        <div className="space-y-2 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#aa4444]" />
            <span className="text-white/40 font-rajdhani text-[10px] tracking-wider uppercase">Historical</span>
            <span className="text-white/25 font-mono text-[9px] ml-auto">{formatBudget(realPlan.total_budget)}</span>
          </div>
          <FundingFlow
            allocations={realPlan.allocations}
            totalBudget={realPlan.total_budget}
            planLabel="Historical"
            color="#aa4444"
          />
        </div>
      </div>

      {/* CENTER: Budget Comparison (cols 5-12, rows 1-3) */}
      <div
        className="col-span-8 row-span-3 bg-black/20 p-4 flex flex-col cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Regional Budget Comparison</span>
          <span className="text-white/15 font-mono text-[8px]">{regionData.length} regions</span>
        </div>
        <div className="flex-1 min-h-0">
          <CompactBarCluster data={barClusterData} height={160} />
        </div>
      </div>

      {/* BOTTOM: Funding Deltas (cols 5-12, rows 4-6) */}
      <div
        className="col-span-8 row-span-3 bg-black/30 border-t border-white/[0.04] p-4 overflow-y-auto cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
        }}
      >
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* ML vs Historical Delta */}
          <div className="space-y-2">
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">ML Ideal vs Historical</div>
            <div className="space-y-1.5">
              {regionData.map((r: any, i: number) => (
                <DeltaBar
                  key={i}
                  label={r.region}
                  ideal={r.mlBudget}
                  actual={r.realBudget}
                  maxRange={maxBudget}
                />
              ))}
            </div>
          </div>

          {/* Your Plan vs Historical Delta */}
          <div className="space-y-2">
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Your Plan vs Historical</div>
            <div className="space-y-1.5">
              {regionData.map((r: any, i: number) => (
                <DeltaBar
                  key={i}
                  label={r.region}
                  ideal={r.userBudget}
                  actual={r.realBudget}
                  maxRange={maxBudget}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Coverage & Response Outcome
// ═══════════════════════════════════════════════════════════════════════════════

function Step3Coverage({ regionData, userPlan, mlPlan, realPlan, avgUserCoverage, avgMlCoverage, avgRealCoverage, totalUserCovered, totalMlCovered, totalRealCovered, timeSeriesData, revealed }: any) {

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-px p-px">

      {/* LEFT: Coverage Rings + Surface Map (cols 1-4, full height) */}
      <div
        className="col-span-4 row-span-6 bg-black/30 p-4 overflow-y-auto cc-panel space-y-4"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(-24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Coverage Overview</div>

        {/* Ring indicators */}
        <div className="flex justify-between">
          <RingIndicator value={avgUserCoverage * 100} max={100} label="Your Plan" color="#4488aa" size={68}>
            {(avgUserCoverage * 100).toFixed(0)}%
          </RingIndicator>
          <RingIndicator value={avgMlCoverage * 100} max={100} label="ML Ideal" color="#8855aa" size={68}>
            {(avgMlCoverage * 100).toFixed(0)}%
          </RingIndicator>
          <RingIndicator value={avgRealCoverage * 100} max={100} label="Historical" color="#aa4444" size={68}>
            {(avgRealCoverage * 100).toFixed(0)}%
          </RingIndicator>
        </div>

        {/* People reached comparison */}
        <div className="space-y-1.5 pt-3 border-t border-white/[0.04]">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">People Reached</div>
          <div className="space-y-1">
            {[
              { label: 'Your Plan', value: totalUserCovered, color: '#4488aa' },
              { label: 'ML Ideal', value: totalMlCovered, color: '#8855aa' },
              { label: 'Historical', value: totalRealCovered, color: '#aa4444' },
            ].map((p, i) => {
              const maxReached = Math.max(totalUserCovered, totalMlCovered, totalRealCovered, 1)
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-white/30 font-rajdhani text-[10px] w-16 tracking-wide">{p.label}</span>
                  <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${(p.value / maxReached) * 100}%`,
                        backgroundColor: p.color,
                        opacity: 0.5,
                        transitionDelay: `${i * 100}ms`,
                      }}
                    />
                  </div>
                  <span className="text-white/40 font-mono text-[9px] w-16 text-right">{p.value.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coverage by region */}
        <div className="space-y-2 pt-3 border-t border-white/[0.04]">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Coverage by Region</div>
          <CoverageSurfaceMap
            userPlan={userPlan}
            mlPlan={mlPlan}
            realPlan={realPlan}
          />
        </div>
      </div>

      {/* CENTER TOP: Coverage contour surface (cols 5-12, rows 1-3) */}
      <div
        className="col-span-8 row-span-3 bg-black/20 p-4 flex flex-col cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Coverage Intensity Map</span>
          <span className="text-white/15 font-mono text-[8px]">historical response coverage</span>
        </div>
        <div className="flex-1 min-h-0">
          <ContourSurface
            regions={regionData.map((r: any) => ({
              name: r.region,
              value: r.realCoverage,
              max: 1,
            }))}
            colorFn={(ratio: number) => {
              if (ratio > 0.7) return '#44aa77'
              if (ratio > 0.4) return '#aaaa44'
              return '#aa4455'
            }}
            height={180}
          />
        </div>
      </div>

      {/* BOTTOM: Deployment Curve + Unmet Need (cols 5-12, rows 4-6) */}
      <div
        className="col-span-8 row-span-3 bg-black/30 border-t border-white/[0.04] p-4 cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
        }}
      >
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Deployment Curve */}
          <div>
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Deployment Curve</div>
            <DenseTimeSeries series={timeSeriesData} height={130} />
          </div>

          {/* Unmet Need */}
          <div>
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Unmet Need by Region</div>
            <div className="space-y-1">
              {[...regionData]
                .sort((a: any, b: any) => b.unmetNeed - a.unmetNeed)
                .map((r: any, i: number) => {
                  const maxUnmet = Math.max(...regionData.map((rd: any) => rd.unmetNeed), 1)
                  const pct = (r.unmetNeed / maxUnmet) * 100
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-white/25 font-rajdhani text-[9px] w-20 truncate tracking-wide uppercase">{r.region}</span>
                      <div className="flex-1 h-[5px] bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-800 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, #aa4455 0%, #cc6655 100%)`,
                            opacity: 0.6,
                            transitionDelay: `${i * 60}ms`,
                          }}
                        />
                      </div>
                      <span className="text-white/30 font-mono text-[9px] w-16 text-right">
                        {r.unmetNeed.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Comparison / Delta Insights
// ═══════════════════════════════════════════════════════════════════════════════

function Step4Delta({ regionData, severityGridData, maxBudget, coverageDelta, userPlan, mlPlan, realPlan, mismatchAnalysis, revealed }: any) {

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-px p-px">

      {/* LEFT: Key Insights (cols 1-4, full height) */}
      <div
        className="col-span-4 row-span-6 bg-black/30 p-4 overflow-y-auto cc-panel space-y-3"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(-24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Delta Insights</div>

        {/* Where Money Mattered */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5 space-y-1">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase">Where Money Mattered</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const sorted = [...regionData].sort((a: any, b: any) =>
                Math.abs(b.mlBudget - b.realBudget) - Math.abs(a.mlBudget - a.realBudget)
              )
              const top = sorted[0]
              if (!top) return 'No data'
              const delta = top.mlBudget - top.realBudget
              return `${top.region}: ${delta > 0 ? 'underfunded' : 'overfunded'} by ${formatBudget(Math.abs(delta))}`
            })()}
          </div>
        </div>

        {/* Where Equity Broke */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5 space-y-1">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase">Where Equity Broke Down</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const worstEquity = [...regionData].sort((a: any, b: any) => {
                const aMismatch = Math.abs(a.severity - (a.realBudget / (realPlan.total_budget || 1)))
                const bMismatch = Math.abs(b.severity - (b.realBudget / (realPlan.total_budget || 1)))
                return bMismatch - aMismatch
              })[0]
              if (!worstEquity) return 'No data'
              return `${worstEquity.region}: severity ${(worstEquity.severity * 10).toFixed(1)} but only ${((worstEquity.realBudget / (realPlan.total_budget || 1)) * 100).toFixed(0)}% of budget`
            })()}
          </div>
        </div>

        {/* Coverage Impact */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5 space-y-1">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase">Coverage Impact</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {coverageDelta > 0
              ? `${coverageDelta.toLocaleString()} more people could have been reached with ideal allocation`
              : `Historical response covered ${Math.abs(coverageDelta).toLocaleString()} more than ML ideal`
            }
          </div>
        </div>

        {/* Your Plan Assessment */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5 space-y-1">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase">Your Plan vs ML</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const userTotal = userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
              const mlTotal = mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
              const diff = userTotal - mlTotal
              if (diff > 0) return `Your plan covered ${diff.toLocaleString()} more people than ML ideal`
              if (diff < 0) return `ML ideal would have covered ${Math.abs(diff).toLocaleString()} more people`
              return 'Your plan matched ML ideal coverage'
            })()}
          </div>
        </div>

        {/* Mismatch narrative */}
        {mismatchAnalysis?.narrative && (
          <div className="pt-2 border-t border-white/[0.04] space-y-1">
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Analysis Summary</div>
            <div className="text-white/35 font-mono text-[9px] leading-relaxed">
              {mismatchAnalysis.narrative.slice(0, 500)}
              {mismatchAnalysis.narrative.length > 500 && '...'}
            </div>
          </div>
        )}
      </div>

      {/* CENTER TOP: Severity Grid (cols 5-9, rows 1-3) */}
      <div
        className="col-span-5 row-span-3 bg-black/20 p-4 flex flex-col cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
        }}
      >
        <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Severity vs Coverage Grid</div>
        <SeverityGrid data={severityGridData} />
      </div>

      {/* RIGHT TOP: Severity vs Funding Alignment (cols 10-12, rows 1-3) */}
      <div
        className="col-span-3 row-span-3 bg-black/30 border-l border-white/[0.04] p-3 overflow-y-auto cc-panel space-y-2"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(24px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
        }}
      >
        <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Severity vs Funding</div>
        <div className="space-y-1.5">
          {[...regionData]
            .sort((a: any, b: any) => b.severity - a.severity)
            .map((r: any, i: number) => {
              const fundingRatio = r.realBudget / (realPlan.total_budget || 1)
              const mismatch = Math.abs(r.severity - fundingRatio) * 100
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/25 font-rajdhani text-[9px] w-16 truncate tracking-wide uppercase">{r.region}</span>
                  <div className="flex-1 flex items-center gap-0.5">
                    <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.severity * 100}%`,
                          backgroundColor: `rgba(${180 + r.severity * 75}, ${70 - r.severity * 50}, ${50}, 0.6)`,
                        }}
                      />
                    </div>
                    <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4488aa]/50"
                        style={{ width: `${fundingRatio * 100 * regionData.length}%` }}
                      />
                    </div>
                  </div>
                  <span className={`font-mono text-[9px] w-8 text-right ${mismatch > 20 ? 'text-[#cc5566]' : 'text-white/30'}`}>
                    {mismatch.toFixed(0)}%
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* BOTTOM: Budget Deltas (cols 5-12, rows 4-6) */}
      <div
        className="col-span-8 row-span-3 bg-black/30 border-t border-white/[0.04] p-4 overflow-y-auto cc-panel"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.35s',
        }}
      >
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* ML vs Real Deltas */}
          <div className="space-y-2">
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Budget Delta: ML vs Historical</div>
            <div className="space-y-1.5">
              {regionData.map((r: any, i: number) => (
                <DeltaBar
                  key={i}
                  label={r.region}
                  ideal={r.mlBudget}
                  actual={r.realBudget}
                  maxRange={maxBudget}
                />
              ))}
            </div>
          </div>

          {/* UN Principles (if available) */}
          <div className="space-y-2">
            {mlPlan.objective_scores ? (
              <>
                <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">UN Principles Score</div>
                {Object.entries(mlPlan.objective_scores).map(([key, value]) => {
                  const score = (value as number) * 100
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-white/25 font-rajdhani text-[9px] w-20 truncate uppercase tracking-wide">{key.replace('_', ' ')}</span>
                      <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#8855aa]/60 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="text-white/40 font-mono text-[9px] w-8 text-right">{score.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </>
            ) : (
              <>
                <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Budget Delta: You vs Historical</div>
                <div className="space-y-1.5">
                  {regionData.map((r: any, i: number) => (
                    <DeltaBar
                      key={i}
                      label={r.region}
                      ideal={r.userBudget}
                      actual={r.realBudget}
                      maxRange={maxBudget}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
