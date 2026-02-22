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

// ─── Main Component (fixed overlay on top of map) ───────────────────────────────

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

  const handleExit = useCallback(() => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }, [setShowComparisonPage, setSelectedHurricane])

  // ─── Guard ───

  if (!comparisonData || !comparisonData.mlPlan || !comparisonData.realPlan || !comparisonData.userPlan) {
    return null
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
    ? userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / userPlan.allocations.length : 0
  const avgMlCoverage = mlPlan.allocations.length > 0
    ? mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length : 0
  const avgRealCoverage = realPlan.allocations.length > 0
    ? realPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length : 0

  const coverageDelta = totalMlCovered - totalRealCovered

  const barClusterData = regionData.map((r: any) => ({ label: r.region, user: r.userBudget, ml: r.mlBudget, real: r.realBudget }))

  const severityGridData = regionData.map((r: any) => ({ region: r.region, severity: r.severity, coverage: r.realCoverage, gap: r.mlCoverage - r.realCoverage }))

  const maxBudget = Math.max(...regionData.map((r: any) => Math.abs(r.mlBudget - r.realBudget)), 1)

  const timeSeriesData = useMemo(() => {
    const steps = 12
    const uV: number[] = [], mV: number[] = [], rV: number[] = []
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      uV.push(userPlan.total_budget * Math.pow(t, 0.7) * (0.85 + Math.random() * 0.15))
      mV.push(mlPlan.total_budget * Math.pow(t, 0.5) * (0.9 + Math.random() * 0.1))
      rV.push(realPlan.total_budget * Math.pow(t, 0.9) * (0.75 + Math.random() * 0.25))
    }
    return [
      { name: 'You', color: '#4488aa', values: uV },
      { name: 'ML', color: '#8855aa', values: mV },
      { name: 'Real', color: '#aa4444', values: rV },
    ]
  }, [userPlan, mlPlan, realPlan])

  // ─── Transition class ─────────────────────────────────────────────────────

  const contentClass = isTransitioning
    ? `step-exit-${transitionDir}`
    : stepRevealed
      ? `step-enter-${transitionDir} step-enter-active`
      : `step-enter-${transitionDir}`

  // ─── Render (fixed overlay) ───────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Top nav bar */}
      <div className="pointer-events-auto absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md border-b border-white/[0.06] z-10">
        <div className="flex items-center gap-3">
          <span className="text-white/80 font-rajdhani font-bold text-sm tracking-wider">HURRICARE</span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/50 font-mono text-xs">
            {selectedHurricane?.name} ({selectedHurricane?.year}) — Cat {selectedHurricane?.max_category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4] as Step[]).map(step => (
            <button
              key={step}
              onClick={() => goToStep(step)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-rajdhani tracking-wider uppercase transition-all duration-300 border ${
                currentStep === step
                  ? 'bg-white/10 text-white/80 border-white/15'
                  : currentStep > step
                    ? 'text-white/35 border-white/[0.06] hover:text-white/50'
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
              <span className="hidden xl:inline">{STEP_LABELS[step]}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button onClick={handleExit} className="text-white/30 hover:text-white/60 font-rajdhani text-xs tracking-wider uppercase px-2 py-1 border border-white/[0.06] hover:border-white/15 transition-colors">
            Exit
          </button>
        </div>
      </div>

      {/* Centered step panel */}
      <div className="absolute inset-0 top-10 bottom-11 flex items-center justify-center p-6">
        <div className={`pointer-events-auto relative w-full max-w-2xl max-h-full overflow-y-auto step-panel ${contentClass}`}>
          <div className="bg-black/70 backdrop-blur-xl border border-white/[0.08] rounded-sm p-5 space-y-4">
            {/* Step title */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">{STEP_SUBTITLES[currentStep]}</div>
                <h2 className="text-white/80 font-rajdhani font-bold text-lg tracking-wider">{STEP_LABELS[currentStep]}</h2>
              </div>
              <span className="text-white/15 font-mono text-[10px]">Step {currentStep} / 4</span>
            </div>

            {/* Step content */}
            {currentStep === 1 && (
              <Step1Content
                selectedHurricane={selectedHurricane}
                regionData={regionData}
                avgUserCoverage={avgUserCoverage}
                avgMlCoverage={avgMlCoverage}
                avgRealCoverage={avgRealCoverage}
                totalUserCovered={totalUserCovered}
                totalMlCovered={totalMlCovered}
                totalRealCovered={totalRealCovered}
                userPlan={userPlan}
              />
            )}
            {currentStep === 2 && (
              <Step2Content
                regionData={regionData}
                barClusterData={barClusterData}
                maxBudget={maxBudget}
                userPlan={userPlan}
                mlPlan={mlPlan}
                realPlan={realPlan}
              />
            )}
            {currentStep === 3 && (
              <Step3Content
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
              />
            )}
            {currentStep === 4 && (
              <Step4Content
                regionData={regionData}
                severityGridData={severityGridData}
                maxBudget={maxBudget}
                coverageDelta={coverageDelta}
                userPlan={userPlan}
                mlPlan={mlPlan}
                realPlan={realPlan}
                mismatchAnalysis={mismatchAnalysis}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 h-11 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md border-t border-white/[0.06]">
        <button
          onClick={() => currentStep > 1 && goToStep((currentStep - 1) as Step)}
          disabled={currentStep === 1}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-rajdhani tracking-wider uppercase transition-all border border-white/[0.06] hover:border-white/15 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70"
        >
          <span className="text-[10px]">◂</span> Previous
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4] as Step[]).map(step => (
              <div
                key={step}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  step === currentStep ? 'w-5 bg-white/40' : step < currentStep ? 'w-2 bg-white/15' : 'w-2 bg-white/[0.06]'
                }`}
              />
            ))}
          </div>
          <span className="text-white/15 font-rajdhani text-[10px] tracking-wider uppercase">{STEP_SUBTITLES[currentStep]}</span>
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

function Step1Content({ selectedHurricane, regionData, avgUserCoverage, avgMlCoverage, avgRealCoverage, totalUserCovered, totalMlCovered, totalRealCovered, userPlan }: any) {
  return (
    <>
      {/* Hurricane Identity */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white/90 font-rajdhani font-bold text-xl tracking-wider">{selectedHurricane?.name}</h3>
          <div className="text-white/30 font-mono text-xs">{selectedHurricane?.year} — Category {selectedHurricane?.max_category}</div>
          <div className="text-white/20 font-mono text-[10px]">{selectedHurricane?.affected_countries?.join(' / ')}</div>
        </div>
        <div className="text-right">
          <div className="text-white/50 font-mono text-sm">{formatBudget(userPlan.total_budget)}</div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-wider uppercase">total budget</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-1.5">
        <MetricCard label="Population" value={(selectedHurricane?.estimated_population_affected || 0).toLocaleString()} subtext="affected" />
        <MetricCard label="Regions" value={regionData.length.toString()} subtext="affected areas" />
        <MetricCard label="Budget" value={formatBudget(userPlan.total_budget)} subtext="allocated" />
        <MetricCard label="Window" value={`${userPlan.response_window_hours || 72}h`} subtext="response time" />
      </div>

      {/* Coverage Rings */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Overall Coverage</div>
        <div className="flex justify-around">
          <RingIndicator value={avgUserCoverage * 100} max={100} label="Your Plan" color="#4488aa" size={64}>{(avgUserCoverage * 100).toFixed(0)}%</RingIndicator>
          <RingIndicator value={avgMlCoverage * 100} max={100} label="ML Ideal" color="#8855aa" size={64}>{(avgMlCoverage * 100).toFixed(0)}%</RingIndicator>
          <RingIndicator value={avgRealCoverage * 100} max={100} label="Historical" color="#aa4444" size={64}>{(avgRealCoverage * 100).toFixed(0)}%</RingIndicator>
        </div>
      </div>

      {/* Severity contour */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Severity Surface</div>
        <ContourSurface
          regions={regionData.map((r: any) => ({ name: r.region, value: r.severity, max: 1 }))}
          colorFn={(ratio: number) => ratio > 0.7 ? '#cc4444' : ratio > 0.4 ? '#ccaa44' : '#44aa77'}
          height={120}
        />
      </div>

      {/* Region severity list */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-1.5">Region Severity</div>
        <div className="space-y-1">
          {[...regionData].sort((a: any, b: any) => b.severity - a.severity).map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.severity > 0.7 ? '#cc4444' : r.severity > 0.4 ? '#ccaa44' : '#44aa77' }} />
              <span className="text-white/40 font-rajdhani text-[10px] flex-1 truncate">{r.region}</span>
              <span className="text-white/30 font-mono text-[10px]">{(r.severity * 10).toFixed(1)}</span>
              <div className="w-16 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-800" style={{ width: `${r.severity * 100}%`, backgroundColor: r.severity > 0.7 ? '#cc4444' : r.severity > 0.4 ? '#ccaa44' : '#44aa77', opacity: 0.6, transitionDelay: `${i * 60}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Funding & Allocation Dynamics
// ═══════════════════════════════════════════════════════════════════════════════

function Step2Content({ regionData, barClusterData, maxBudget, userPlan, mlPlan, realPlan }: any) {
  return (
    <>
      {/* Plan Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#4488aa]" /><span className="text-white/30 font-mono text-[9px]">Your Plan</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8855aa]" /><span className="text-white/30 font-mono text-[9px]">ML Ideal</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#aa4444]" /><span className="text-white/30 font-mono text-[9px]">Historical</span></div>
      </div>

      {/* Budget Comparison */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Regional Budget Comparison</div>
        <CompactBarCluster data={barClusterData} height={140} />
      </div>

      {/* Funding Flows side by side */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4488aa]" />
            <span className="text-white/35 font-rajdhani text-[9px] tracking-wider uppercase">You</span>
            <span className="text-white/20 font-mono text-[8px] ml-auto">{formatBudget(userPlan.total_budget)}</span>
          </div>
          <FundingFlow allocations={userPlan.allocations} totalBudget={userPlan.total_budget} planLabel="You" color="#4488aa" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8855aa]" />
            <span className="text-white/35 font-rajdhani text-[9px] tracking-wider uppercase">ML</span>
            <span className="text-white/20 font-mono text-[8px] ml-auto">{formatBudget(mlPlan.total_budget)}</span>
          </div>
          <FundingFlow allocations={mlPlan.allocations} totalBudget={mlPlan.total_budget} planLabel="ML" color="#8855aa" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#aa4444]" />
            <span className="text-white/35 font-rajdhani text-[9px] tracking-wider uppercase">Real</span>
            <span className="text-white/20 font-mono text-[8px] ml-auto">{formatBudget(realPlan.total_budget)}</span>
          </div>
          <FundingFlow allocations={realPlan.allocations} totalBudget={realPlan.total_budget} planLabel="Real" color="#aa4444" />
        </div>
      </div>

      {/* Funding Deltas */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">ML Ideal vs Historical Delta</div>
        <div className="space-y-1">
          {regionData.map((r: any, i: number) => (
            <DeltaBar key={i} label={r.region} ideal={r.mlBudget} actual={r.realBudget} maxRange={maxBudget} />
          ))}
        </div>
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Coverage & Response Outcome
// ═══════════════════════════════════════════════════════════════════════════════

function Step3Content({ regionData, userPlan, mlPlan, realPlan, avgUserCoverage, avgMlCoverage, avgRealCoverage, totalUserCovered, totalMlCovered, totalRealCovered, timeSeriesData }: any) {
  return (
    <>
      {/* Coverage Rings */}
      <div className="flex justify-around">
        <RingIndicator value={avgUserCoverage * 100} max={100} label="Your Plan" color="#4488aa" size={64}>{(avgUserCoverage * 100).toFixed(0)}%</RingIndicator>
        <RingIndicator value={avgMlCoverage * 100} max={100} label="ML Ideal" color="#8855aa" size={64}>{(avgMlCoverage * 100).toFixed(0)}%</RingIndicator>
        <RingIndicator value={avgRealCoverage * 100} max={100} label="Historical" color="#aa4444" size={64}>{(avgRealCoverage * 100).toFixed(0)}%</RingIndicator>
      </div>

      {/* People Reached */}
      <div className="space-y-1">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">People Reached</div>
        {[
          { label: 'Your Plan', value: totalUserCovered, color: '#4488aa' },
          { label: 'ML Ideal', value: totalMlCovered, color: '#8855aa' },
          { label: 'Historical', value: totalRealCovered, color: '#aa4444' },
        ].map((p, i) => {
          const maxR = Math.max(totalUserCovered, totalMlCovered, totalRealCovered, 1)
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-white/30 font-rajdhani text-[10px] w-16">{p.label}</span>
              <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(p.value / maxR) * 100}%`, backgroundColor: p.color, opacity: 0.5, transitionDelay: `${i * 100}ms` }} />
              </div>
              <span className="text-white/40 font-mono text-[9px] w-16 text-right">{p.value.toLocaleString()}</span>
            </div>
          )
        })}
      </div>

      {/* Coverage Surface Map */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Coverage by Region</div>
        <CoverageSurfaceMap userPlan={userPlan} mlPlan={mlPlan} realPlan={realPlan} />
      </div>

      {/* Deployment Curve */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Deployment Curve</div>
        <DenseTimeSeries series={timeSeriesData} height={110} />
      </div>

      {/* Unmet Need */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-1.5">Unmet Need</div>
        <div className="space-y-1">
          {[...regionData].sort((a: any, b: any) => b.unmetNeed - a.unmetNeed).map((r: any, i: number) => {
            const maxU = Math.max(...regionData.map((rd: any) => rd.unmetNeed), 1)
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/25 font-rajdhani text-[9px] w-20 truncate uppercase">{r.region}</span>
                <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-800" style={{ width: `${(r.unmetNeed / maxU) * 100}%`, background: 'linear-gradient(90deg, #aa4455, #cc6655)', opacity: 0.6, transitionDelay: `${i * 60}ms` }} />
                </div>
                <span className="text-white/30 font-mono text-[9px] w-14 text-right">{r.unmetNeed.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Comparison / Delta Insights
// ═══════════════════════════════════════════════════════════════════════════════

function Step4Content({ regionData, severityGridData, maxBudget, coverageDelta, userPlan, mlPlan, realPlan, mismatchAnalysis }: any) {
  return (
    <>
      {/* Key Insight Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase mb-1">Where Money Mattered</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const sorted = [...regionData].sort((a: any, b: any) => Math.abs(b.mlBudget - b.realBudget) - Math.abs(a.mlBudget - a.realBudget))
              const top = sorted[0]
              if (!top) return 'No data'
              const delta = top.mlBudget - top.realBudget
              return `${top.region}: ${delta > 0 ? 'underfunded' : 'overfunded'} by ${formatBudget(Math.abs(delta))}`
            })()}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase mb-1">Where Equity Broke</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const worst = [...regionData].sort((a: any, b: any) => {
                return Math.abs(b.severity - (b.realBudget / (realPlan.total_budget || 1))) - Math.abs(a.severity - (a.realBudget / (realPlan.total_budget || 1)))
              })[0]
              if (!worst) return 'No data'
              return `${worst.region}: severity ${(worst.severity * 10).toFixed(1)}, got ${((worst.realBudget / (realPlan.total_budget || 1)) * 100).toFixed(0)}% budget`
            })()}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase mb-1">Coverage Impact</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {coverageDelta > 0
              ? `${coverageDelta.toLocaleString()} more reachable with ideal allocation`
              : `Historical covered ${Math.abs(coverageDelta).toLocaleString()} more than ML ideal`}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-sm p-2.5">
          <div className="text-white/30 font-rajdhani text-[9px] tracking-widest uppercase mb-1">Your Plan vs ML</div>
          <div className="text-white/50 font-mono text-[9px] leading-relaxed">
            {(() => {
              const uT = userPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
              const mT = mlPlan.allocations.reduce((s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0)
              const d = uT - mT
              if (d > 0) return `You covered ${d.toLocaleString()} more people`
              if (d < 0) return `ML ideal covers ${Math.abs(d).toLocaleString()} more`
              return 'Matched ML ideal'
            })()}
          </div>
        </div>
      </div>

      {/* Severity Grid */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Severity vs Coverage</div>
        <SeverityGrid data={severityGridData} />
      </div>

      {/* Budget Deltas */}
      <div>
        <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">Budget Delta: ML vs Historical</div>
        <div className="space-y-1">
          {regionData.map((r: any, i: number) => (
            <DeltaBar key={i} label={r.region} ideal={r.mlBudget} actual={r.realBudget} maxRange={maxBudget} />
          ))}
        </div>
      </div>

      {/* UN Principles */}
      {mlPlan.objective_scores && (
        <div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-2">UN Principles Score</div>
          <div className="space-y-1.5">
            {Object.entries(mlPlan.objective_scores).map(([key, value]) => {
              const score = (value as number) * 100
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-white/25 font-rajdhani text-[9px] w-20 truncate uppercase">{key.replace('_', ' ')}</span>
                  <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full bg-[#8855aa]/60 rounded-full transition-all duration-1000" style={{ width: `${score}%` }} />
                  </div>
                  <span className="text-white/40 font-mono text-[9px] w-8 text-right">{score.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mismatch Narrative */}
      {mismatchAnalysis?.narrative && (
        <div className="pt-2 border-t border-white/[0.04]">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase mb-1">Analysis</div>
          <div className="text-white/35 font-mono text-[9px] leading-relaxed">
            {mismatchAnalysis.narrative.slice(0, 400)}{mismatchAnalysis.narrative.length > 400 && '...'}
          </div>
        </div>
      )}
    </>
  )
}
