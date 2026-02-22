import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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

type ViewMode = 'overview' | 'funding' | 'coverage' | 'equity'

// ─── Utilities ──────────────────────────────────────────────────────────────────

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const {
    selectedHurricane,
    comparisonData,
    setShowComparisonPage,
    setSelectedHurricane,
    coverage,
  } = useStore()

  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [revealPhase, setRevealPhase] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // Progressive reveal animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setRevealPhase(1), 100),
      setTimeout(() => setRevealPhase(2), 400),
      setTimeout(() => setRevealPhase(3), 700),
      setTimeout(() => setRevealPhase(4), 1000),
      setTimeout(() => setRevealPhase(5), 1300),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

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

  // ─── Derived Data ───────────────────────────────────────────────────────

  const totalUserCovered = userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
  const totalMlCovered = mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
  const totalRealCovered = realPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)

  const avgUserCoverage = userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / userPlan.allocations.length
  const avgMlCoverage = mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length
  const avgRealCoverage = realPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length

  const budgetDelta = mlPlan.total_budget - realPlan.total_budget
  const coverageDelta = totalMlCovered - totalRealCovered

  // Region-level data for charts
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

  // Bar cluster data
  const barClusterData = useMemo(() => {
    return regionData.map((r: any) => ({
      label: r.region,
      user: r.userBudget,
      ml: r.mlBudget,
      real: r.realBudget,
    }))
  }, [regionData])

  // Severity grid data
  const severityGridData = useMemo(() => {
    return regionData.map((r: any) => ({
      region: r.region,
      severity: r.severity,
      coverage: r.realCoverage,
      gap: r.mlCoverage - r.realCoverage,
    }))
  }, [regionData])

  // Simulated time-series (based on budget distribution pattern)
  const timeSeriesData = useMemo(() => {
    const steps = 12
    const userVals: number[] = []
    const mlVals: number[] = []
    const realVals: number[] = []

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      // Simulate cumulative deployment curves
      const userCumulative = userPlan.total_budget * Math.pow(t, 0.7) * (0.8 + Math.random() * 0.2)
      const mlCumulative = mlPlan.total_budget * Math.pow(t, 0.5) * (0.9 + Math.random() * 0.1)
      const realCumulative = realPlan.total_budget * Math.pow(t, 0.9) * (0.7 + Math.random() * 0.3)
      userVals.push(userCumulative)
      mlVals.push(mlCumulative)
      realVals.push(realCumulative)
    }

    return [
      { name: 'You', color: 'rgba(255,255,255,0.6)', values: userVals },
      { name: 'ML', color: 'rgba(255,255,255,0.35)', values: mlVals },
      { name: 'Real', color: 'rgba(255,255,255,0.15)', values: realVals },
    ]
  }, [userPlan, mlPlan, realPlan])

  // Max budget for delta bars
  const maxBudget = useMemo(() => {
    return Math.max(
      ...regionData.map((r: any) => Math.abs(r.mlBudget - r.realBudget)),
      1
    )
  }, [regionData])

  const handleBack = useCallback(() => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }, [setShowComparisonPage, setSelectedHurricane])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-screen h-screen bg-[#020810] overflow-hidden flex flex-col cc-root">
      {/* ─── Top Bar ─── */}
      <header
        className="h-10 flex items-center justify-between px-4 border-b border-white/[0.06] bg-black/40 shrink-0 cc-header"
        style={{ opacity: revealPhase >= 1 ? 1 : 0, transition: 'opacity 0.6s ease' }}
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
          {/* View mode switcher */}
          <div className="flex gap-px">
            {(['overview', 'funding', 'coverage', 'equity'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-[10px] font-rajdhani tracking-wider uppercase transition-all duration-200 ${
                  viewMode === mode
                    ? 'bg-white/10 text-white/80 border border-white/15'
                    : 'text-white/25 hover:text-white/50 border border-transparent'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleBack}
            className="text-white/30 hover:text-white/60 font-rajdhani text-xs tracking-wider uppercase transition-colors px-2 py-1 border border-white/[0.06] hover:border-white/15"
          >
            Exit Analysis
          </button>
        </div>
      </header>

      {/* ─── Main Grid ─── */}
      <div className="flex-1 overflow-hidden grid grid-cols-12 grid-rows-6 gap-px p-px cc-grid">

        {/* ─── LEFT COLUMN: Key Metrics (cols 1-3, rows 1-6) ─── */}
        <div
          className="col-span-3 row-span-6 bg-black/30 border-r border-white/[0.04] overflow-y-auto p-3 space-y-3 cc-panel"
          style={{ opacity: revealPhase >= 2 ? 1 : 0, transform: revealPhase >= 2 ? 'translateX(0)' : 'translateX(-20px)', transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          {/* Plan Legend */}
          <div className="flex items-center gap-3 pb-2 border-b border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/60" />
              <span className="text-white/30 font-mono text-[9px]">Your Plan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/35" />
              <span className="text-white/30 font-mono text-[9px]">ML Ideal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span className="text-white/30 font-mono text-[9px]">Historical</span>
            </div>
          </div>

          {/* Ring Indicators Row */}
          <div className="flex justify-between">
            <RingIndicator value={avgUserCoverage * 100} max={100} label="Your Coverage" color="rgba(255,255,255,0.6)" size={64}>
              {(avgUserCoverage * 100).toFixed(0)}%
            </RingIndicator>
            <RingIndicator value={avgMlCoverage * 100} max={100} label="ML Coverage" color="rgba(255,255,255,0.35)" size={64}>
              {(avgMlCoverage * 100).toFixed(0)}%
            </RingIndicator>
            <RingIndicator value={avgRealCoverage * 100} max={100} label="Historical" color="rgba(255,255,255,0.2)" size={64}>
              {(avgRealCoverage * 100).toFixed(0)}%
            </RingIndicator>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-1.5">
            <MetricCard
              label="Budget"
              value={formatBudget(userPlan.total_budget)}
              subtext="total allocation"
            />
            <MetricCard
              label="Coverage Gap"
              value={`${((avgMlCoverage - avgRealCoverage) * 100).toFixed(1)}%`}
              subtext="ideal vs actual"
              trend={avgMlCoverage > avgRealCoverage ? 'down' : 'up'}
              color="rgba(255,255,255,0.4)"
            />
            <MetricCard
              label="People Reached"
              value={totalUserCovered.toLocaleString()}
              subtext={`of ${(selectedHurricane?.estimated_population_affected || 0).toLocaleString()}`}
              trend={totalUserCovered > totalRealCovered ? 'up' : 'down'}
            />
            <MetricCard
              label="Regions"
              value={regionData.length.toString()}
              subtext="affected areas"
            />
          </div>

          {/* UN Values (if available) */}
          {mlPlan.objective_scores && (
            <div className="space-y-1.5">
              <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">UN Principles Score</div>
              {Object.entries(mlPlan.objective_scores).map(([key, value]) => {
                const score = (value as number) * 100
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-white/25 font-rajdhani text-[9px] w-16 truncate uppercase tracking-wide">{key.replace('_', ' ')}</span>
                    <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/35/60 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-white/40 font-mono text-[9px] w-8 text-right">{score.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Funding Flow */}
          <div className="space-y-2">
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Funding Distribution</div>
            <FundingFlow
              allocations={userPlan.allocations}
              totalBudget={userPlan.total_budget}
              planLabel="Your Plan"
              color="rgba(255,255,255,0.6)"
            />
          </div>

          {/* Coverage comparison surface */}
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Coverage by Region</div>
            <CoverageSurfaceMap
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
            />
          </div>
        </div>

        {/* ─── CENTER: Primary Visualization (cols 4-9, rows 1-4) ─── */}
        <div
          className="col-span-6 row-span-4 bg-black/20 p-3 flex flex-col cc-panel"
          style={{ opacity: revealPhase >= 3 ? 1 : 0, transform: revealPhase >= 3 ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s' }}
        >
          {/* View-dependent content */}
          {viewMode === 'overview' && (
            <>
              {/* Regional Budget Comparison */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Regional Budget Comparison</span>
                <span className="text-white/15 font-mono text-[8px]">{regionData.length} regions</span>
              </div>
              <div className="flex-1 min-h-0">
                <CompactBarCluster data={barClusterData} height={180} />
              </div>

              {/* Time-series deployment curve */}
              <div className="mt-3">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Deployment Curve</span>
                <DenseTimeSeries series={timeSeriesData} height={110} />
              </div>
            </>
          )}

          {viewMode === 'funding' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Funding Delta: ML Ideal vs Historical</span>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto">
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
              <div className="mt-3 pt-2 border-t border-white/[0.04]">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase mb-2 block">Your Plan vs Historical</span>
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
            </>
          )}

          {viewMode === 'coverage' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Coverage Analysis</span>
              </div>
              <div className="flex-1 min-h-0">
                <ContourSurface
                  regions={regionData.map((r: any) => ({
                    name: r.region,
                    value: r.realCoverage,
                    max: 1,
                  }))}
                  colorFn={(ratio) => {
                    if (ratio > 0.7) return 'rgba(255,255,255,0.5)'
                    if (ratio > 0.4) return 'rgba(255,255,255,0.3)'
                    return 'rgba(255,255,255,0.15)'
                  }}
                  height={160}
                />
              </div>
              <div className="mt-3">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase mb-2 block">Unmet Need by Region</span>
                <div className="space-y-1">
                  {regionData
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
                                background: `linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.15) 100%)`,
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
            </>
          )}

          {viewMode === 'equity' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase">Equity & Severity Analysis</span>
              </div>
              <SeverityGrid data={severityGridData} />
              <div className="mt-3 pt-2 border-t border-white/[0.04]">
                <span className="text-white/30 font-rajdhani text-[10px] tracking-widest uppercase mb-2 block">Severity vs Funding Alignment</span>
                <div className="space-y-1.5">
                  {regionData
                    .sort((a: any, b: any) => b.severity - a.severity)
                    .map((r: any, i: number) => {
                      const fundingRatio = r.realBudget / (realPlan.total_budget || 1)
                      const mismatch = Math.abs(r.severity - fundingRatio) * 100
                      return (
                        <div key={i} className="flex items-center gap-2 group">
                          <span className="text-white/25 font-rajdhani text-[9px] w-20 truncate tracking-wide uppercase">{r.region}</span>
                          <div className="flex-1 flex items-center gap-1">
                            {/* Severity indicator */}
                            <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${r.severity * 100}%`,
                                  backgroundColor: `rgba(255, 255, 255, ${0.15 + r.severity * 0.35})`,
                                }}
                              />
                            </div>
                            {/* Funding indicator */}
                            <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-white/60/50"
                                style={{ width: `${fundingRatio * 100 * regionData.length}%` }}
                              />
                            </div>
                          </div>
                          <span className={`font-mono text-[9px] w-8 text-right ${mismatch > 20 ? 'text-white/50' : 'text-white/30'}`}>
                            {mismatch.toFixed(0)}%
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Region Details (cols 10-12, rows 1-4) ─── */}
        <div
          className="col-span-3 row-span-4 bg-black/30 border-l border-white/[0.04] p-3 overflow-y-auto space-y-2 cc-panel"
          style={{ opacity: revealPhase >= 3 ? 1 : 0, transform: revealPhase >= 3 ? 'translateX(0)' : 'translateX(20px)', transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s' }}
        >
          <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Region Detail</div>

          {/* Region selector */}
          <div className="space-y-px">
            {regionData.map((r: any, i: number) => {
              const isSelected = selectedRegion === r.region
              return (
                <button
                  key={i}
                  onClick={() => setSelectedRegion(isSelected ? null : r.region)}
                  className={`w-full text-left p-2 rounded-sm transition-all duration-200 border ${
                    isSelected
                      ? 'bg-white/[0.06] border-white/10'
                      : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 font-rajdhani text-[11px] font-semibold tracking-wide">{r.region}</span>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: r.severity > 0.7 ? 'rgba(255,255,255,0.5)' : r.severity > 0.4 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                        }}
                      />
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-2 space-y-2 cc-region-detail">
                      {/* Budget comparison */}
                      <div className="space-y-1">
                        <div className="text-white/20 font-rajdhani text-[8px] tracking-widest uppercase">Budget</div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                            <span className="text-white/40 font-mono text-[9px] flex-1">You</span>
                            <span className="text-white/60 font-mono text-[9px]">{formatBudget(r.userBudget)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/35" />
                            <span className="text-white/40 font-mono text-[9px] flex-1">ML</span>
                            <span className="text-white/60 font-mono text-[9px]">{formatBudget(r.mlBudget)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            <span className="text-white/40 font-mono text-[9px] flex-1">Real</span>
                            <span className="text-white/60 font-mono text-[9px]">{formatBudget(r.realBudget)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Coverage */}
                      <div className="space-y-1">
                        <div className="text-white/20 font-rajdhani text-[8px] tracking-widest uppercase">Coverage</div>
                        <div className="flex gap-2">
                          <RingIndicator value={r.userCoverage * 100} max={100} label="You" color="rgba(255,255,255,0.6)" size={40}>
                            {(r.userCoverage * 100).toFixed(0)}%
                          </RingIndicator>
                          <RingIndicator value={r.mlCoverage * 100} max={100} label="ML" color="rgba(255,255,255,0.35)" size={40}>
                            {(r.mlCoverage * 100).toFixed(0)}%
                          </RingIndicator>
                          <RingIndicator value={r.realCoverage * 100} max={100} label="Real" color="rgba(255,255,255,0.2)" size={40}>
                            {(r.realCoverage * 100).toFixed(0)}%
                          </RingIndicator>
                        </div>
                      </div>

                      {/* Key stats */}
                      <div className="grid grid-cols-2 gap-1">
                        <div className="bg-white/[0.02] rounded-sm p-1.5">
                          <div className="text-white/20 font-rajdhani text-[8px] tracking-wider uppercase">Severity</div>
                          <div className="text-white/60 font-mono text-[11px]">{(r.severity * 10).toFixed(1)}</div>
                        </div>
                        <div className="bg-white/[0.02] rounded-sm p-1.5">
                          <div className="text-white/20 font-rajdhani text-[8px] tracking-wider uppercase">Unmet</div>
                          <div className="text-white/60 font-mono text-[11px]">{r.unmetNeed.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── BOTTOM: Insights Strip (cols 4-12, rows 5-6) ─── */}
        <div
          className="col-span-9 row-span-2 bg-black/30 border-t border-white/[0.04] p-3 overflow-y-auto cc-panel"
          style={{ opacity: revealPhase >= 4 ? 1 : 0, transform: revealPhase >= 4 ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s' }}
        >
          <div className="flex gap-4 h-full">
            {/* Summary insight */}
            <div className="flex-1 space-y-2">
              <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">System Insights</div>

              {/* Key findings */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2">
                  <div className="text-white/25 font-rajdhani text-[8px] tracking-widest uppercase mb-1">Where Money Mattered</div>
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

                <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2">
                  <div className="text-white/25 font-rajdhani text-[8px] tracking-widest uppercase mb-1">Where Equity Broke Down</div>
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

                <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2">
                  <div className="text-white/25 font-rajdhani text-[8px] tracking-widest uppercase mb-1">Coverage Impact</div>
                  <div className="text-white/50 font-mono text-[9px] leading-relaxed">
                    {coverageDelta > 0
                      ? `${coverageDelta.toLocaleString()} more people could have been reached with ideal allocation`
                      : `Historical response covered ${Math.abs(coverageDelta).toLocaleString()} more than ML ideal`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Mismatch narrative */}
            {mismatchAnalysis?.narrative && (
              <div className="w-64 shrink-0 space-y-1">
                <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase">Analysis</div>
                <div className="text-white/35 font-mono text-[9px] leading-relaxed overflow-y-auto max-h-full" style={{ maxHeight: 'calc(100% - 20px)' }}>
                  {mismatchAnalysis.narrative.slice(0, 400)}
                  {mismatchAnalysis.narrative.length > 400 && '...'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Scan Line Effect ─── */}
      <div className="cc-scanline" />
    </div>
  )
}
