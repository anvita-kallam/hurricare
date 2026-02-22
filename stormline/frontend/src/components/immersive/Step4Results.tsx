/**
 * Step 4 — Results Play Out
 *
 * FDP-style intelligence panels with ChartPrimitives.
 * Shows coverage results with dense telemetry visuals.
 * Regions rise/fall, coverage spreads, gaps appear.
 */

import { useMemo } from 'react'
import { useStore } from '../../state/useStore'
import TypewriterText, { CountUpText } from '../TypewriterText'
import {
  CircularGauge,
  TriangularAreaFill,
  RidgeChart,
  FanBurst,
  MountainSilhouette,
  SegmentedHorizontalBars,
  ThinVerticalBars,
  PerspectiveGrid,
  StatReadout,
} from '../mapvis/charts/ChartPrimitives'
import AffectedAreaHeightMap from '../shared/AffectedAreaHeightMap'
import InteractiveChartWrapper from '../shared/InteractiveChartWrapper'
import ScrollRevealSection, { ScrollDivider } from '../shared/ScrollRevealSection'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const W = 288

export default function Step4Results() {
  const { comparisonData } = useStore()

  const seed = useMemo(() => {
    if (!comparisonData?.realPlan) return 400
    const regions = comparisonData.realPlan.allocations.map((a: any) => a.region).join('')
    let h = 0
    for (let i = 0; i < regions.length; i++)
      h = ((h << 5) - h + regions.charCodeAt(i)) | 0
    return Math.abs(h) + 4000
  }, [comparisonData])

  const regionData = useMemo(() => {
    if (!comparisonData?.realPlan) return []
    return comparisonData.realPlan.allocations.map((ra: any) => {
      const ua = comparisonData.userPlan?.allocations?.find((a: any) => a.region === ra.region)
      const ma = comparisonData.mlPlan?.allocations?.find((a: any) => a.region === ra.region)
      return {
        region: ra.region,
        userCoverage: ua?.coverage_estimate?.coverage_ratio || 0,
        mlCoverage: ma?.coverage_estimate?.coverage_ratio || 0,
        realCoverage: ra.coverage_estimate?.coverage_ratio || 0,
        unmetNeed: ra.coverage_estimate?.unmet_need || 0,
        userBudget: ua?.budget || 0,
        mlBudget: ma?.budget || 0,
        realBudget: ra.budget || 0,
        peopleCovered: {
          user: ua?.coverage_estimate?.people_covered || 0,
          ml: ma?.coverage_estimate?.people_covered || 0,
          real: ra.coverage_estimate?.people_covered || 0,
        },
      }
    })
  }, [comparisonData])

  const totalUserCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.user, 0)
  const totalMlCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.ml, 0)
  const totalRealCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.real, 0)

  const avgUserCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.userCoverage, 0) / regionData.length : 0
  const avgMlCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.mlCoverage, 0) / regionData.length : 0
  const avgRealCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.realCoverage, 0) / regionData.length : 0

  // Derived data for charts
  const userCoverageSeries = regionData.map((r: any) => r.userCoverage * 100)
  const mlCoverageSeries = regionData.map((r: any) => r.mlCoverage * 100)
  const realCoverageSeries = regionData.map((r: any) => r.realCoverage * 100)
  const unmetNeedSeries = regionData.map((r: any) => r.unmetNeed)
  const gapSeries = regionData.map((r: any) => Math.max(0, (r.mlCoverage - r.realCoverage) * 100))
  const budgetSeries = regionData.map((r: any) => r.userBudget)

  // Loading state if data isn't ready yet
  if (!comparisonData) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <div className="text-white/60 font-rajdhani text-sm tracking-[0.3em] uppercase">
            Loading Results
          </div>
          <div className="text-white/60 font-mono text-sm mt-2">
            Waiting for analysis data...
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/20 confirm-dot"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <ScrollRevealSection animation="blur-resolve" staggerDelay={0}>
      <div className="text-center space-y-1">
        <TypewriterText text="Response Outcome" emphasis="soft" delayMs={100} className="text-white/60 font-rajdhani text-sm tracking-[0.3em] uppercase" as="div" />
        <h2 className="text-white/95 font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text="Coverage Results" emphasis="headline" delayMs={300} charIntervalMs={40} />
        </h2>
      </div>
      </ScrollRevealSection>

      {/* FDP-style two-panel layout */}
      <div className="flex gap-4">
        {/* Left Panel — Coverage Intelligence */}
        <ScrollRevealSection animation="slide-left" staggerDelay={150} sound="slide">
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* Coverage Gauges */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            PLAN COVERAGE
          </div>
          <InteractiveChartWrapper label="Plan Coverage" explanation="Three coverage gauges comparing your allocation plan, the ML-optimized ideal, and the historical response. The gap between your plan and the ML ideal shows where your intuition diverged from data-driven optimization.">
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 2 }}>
            <CircularGauge
              value={Math.round(avgUserCoverage * 100)}
              max={100}
              label="YOUR PLAN"
              size={72}
              alert={avgUserCoverage < 0.4}
            />
            <CircularGauge
              value={Math.round(avgMlCoverage * 100)}
              max={100}
              label="ML IDEAL"
              size={72}
            />
            <CircularGauge
              value={Math.round(avgRealCoverage * 100)}
              max={100}
              label="HISTORICAL"
              size={72}
              alert={avgRealCoverage < 0.4}
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* People covered stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="YOUR" value={totalUserCovered > 1e6 ? `${(totalUserCovered / 1e6).toFixed(1)}M` : `${(totalUserCovered / 1e3).toFixed(0)}K`} />
            <StatReadout label="ML" value={totalMlCovered > 1e6 ? `${(totalMlCovered / 1e6).toFixed(1)}M` : `${(totalMlCovered / 1e3).toFixed(0)}K`} />
            <StatReadout label="REAL" value={totalRealCovered > 1e6 ? `${(totalRealCovered / 1e6).toFixed(1)}M` : `${(totalRealCovered / 1e3).toFixed(0)}K`} alert={totalRealCovered < totalMlCovered} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* TriangularAreaFill — user coverage vs ML coverage */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            YOUR PLAN / ML DIVERGENCE
          </div>
          <InteractiveChartWrapper label="Your Plan / ML Divergence" explanation="The shaded area between your coverage curve and the ML ideal reveals divergence patterns. Wider gaps indicate regions where your allocation strategy differed most from the computed optimal distribution.">
          <div style={{ marginBottom: 2 }}>
            <TriangularAreaFill
              dataA={userCoverageSeries.length > 1 ? userCoverageSeries : [0, 50]}
              dataB={mlCoverageSeries.length > 1 ? mlCoverageSeries : [0, 50]}
              width={W}
              height={80}
              seed={seed + 10}
              accentColor={avgUserCoverage < avgMlCoverage ? 'rgba(255,160,60,0.6)' : 'rgba(100,180,220,0.5)'}
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* RidgeChart — all three coverage profiles */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            COVERAGE PROFILES
          </div>
          <InteractiveChartWrapper label="Coverage Profiles" explanation="Three layered coverage profiles across all regions. The overlap pattern shows where all three approaches (yours, ML, historical) aligned. Separation between layers highlights strategic disagreements.">
          <div style={{ marginBottom: 2 }}>
            <RidgeChart
              series={[
                userCoverageSeries.length > 1 ? userCoverageSeries : [0],
                mlCoverageSeries.length > 1 ? mlCoverageSeries : [0],
                realCoverageSeries.length > 1 ? realCoverageSeries : [0],
              ]}
              width={W}
              height={90}
              seed={seed + 20}
              colors={[
                'rgba(68,136,170,0.15)',
                'rgba(136,85,170,0.1)',
                'rgba(170,68,68,0.08)',
              ]}
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* SegmentedHorizontalBars — per-region user coverage */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            REGIONAL COVERAGE
          </div>
          <InteractiveChartWrapper label="Regional Coverage" explanation="Per-region coverage achieved by your plan. Amber bars indicate regions exceeding 70% coverage. Shorter bars may need increased allocation to improve humanitarian outcomes.">
          <div style={{ marginBottom: 2 }}>
            <SegmentedHorizontalBars
              bars={regionData.slice(0, 6).map((r: any) => ({
                label: r.region.toUpperCase(),
                value: Math.round(r.userCoverage * 100),
                max: 100,
              }))}
              width={W}
              height={Math.min(regionData.length, 6) * 16 + 8}
            />
          </div>
          </InteractiveChartWrapper>
        </div>
        </ScrollRevealSection>

        {/* Right Panel — Gap Analysis */}
        <ScrollRevealSection animation="slide-right" staggerDelay={300} sound="slide">
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* FanBurst — gap dispersion */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            COVERAGE GAP DISPERSION
          </div>
          <InteractiveChartWrapper label="Coverage Gap Dispersion" explanation="Radiating lines show how coverage gaps are distributed across regions. Longer, brighter lines indicate larger gaps. A concentrated fan suggests the gap is localized; a wide fan indicates systemic under-coverage.">
          <div style={{ marginBottom: 2 }}>
            <FanBurst
              values={gapSeries.length > 1 ? gapSeries : [0, 50]}
              width={W}
              height={64}
              seed={seed + 30}
              accentColor={avgRealCoverage < avgMlCoverage ? 'rgba(255,160,60,0.4)' : 'rgba(100,220,120,0.3)'}
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* Gap stats */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            GAP METRICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="AVG GAP" value={`${Math.abs(Math.round((avgMlCoverage - avgRealCoverage) * 100))}%`}
              alert={Math.abs(avgMlCoverage - avgRealCoverage) > 0.2} />
            <StatReadout label="REACH" value={`${Math.abs(totalMlCovered - totalRealCovered) > 1e6 ? `${((totalMlCovered - totalRealCovered) / 1e6).toFixed(1)}M` : `${((totalMlCovered - totalRealCovered) / 1e3).toFixed(0)}K`}`}
              alert={totalMlCovered > totalRealCovered} />
            <StatReadout label="YOUR VS ML" value={`${totalUserCovered > totalMlCovered ? '+' : ''}${Math.abs(totalUserCovered - totalMlCovered) > 1e6 ? `${((totalUserCovered - totalMlCovered) / 1e6).toFixed(1)}M` : `${((totalUserCovered - totalMlCovered) / 1e3).toFixed(0)}K`}`} />
            <StatReadout label="REGIONS" value={`${regionData.length}`} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* MountainSilhouette — unmet need distribution */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            UNMET NEED DENSITY
          </div>
          <InteractiveChartWrapper label="Unmet Need Density" explanation="Terrain profile of unmet humanitarian need across regions. Peaks represent areas where response fell short. The secondary profile shows historical coverage for comparison.">
          <div style={{ marginBottom: 2 }}>
            <MountainSilhouette
              data={unmetNeedSeries.length > 1 ? unmetNeedSeries : [0, 100]}
              width={W}
              height={48}
              seed={seed + 40}
              color="rgba(255,160,60,0.12)"
              secondaryData={realCoverageSeries.length > 1 ? realCoverageSeries : [0, 50]}
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* ThinVerticalBars — budget distribution */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            BUDGET ALLOCATION
          </div>
          <InteractiveChartWrapper label="Budget Allocation" explanation="Your budget distribution across regions. Compare bar heights against the coverage and gap data — some high-budget regions may show diminishing returns while low-budget regions might benefit more from additional funding.">
          <div style={{ marginBottom: 2 }}>
            <ThinVerticalBars
              data={budgetSeries.length > 1 ? budgetSeries : [0, 100]}
              width={W}
              height={60}
              seed={seed + 50}
              labels={regionData.map((r: any) => r.region)}
              unit="Budget ($)"
            />
          </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* PerspectiveGrid — coverage depth */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            COVERAGE STRATA
          </div>
          <InteractiveChartWrapper label="Coverage Strata" explanation="A 3D depth view of your coverage performance across regions. Front bars show current achievement while receding layers suggest coverage stability over the response window.">
          <div style={{ marginBottom: 2 }}>
            <PerspectiveGrid
              data={userCoverageSeries.length > 1 ? userCoverageSeries : [0, 50]}
              width={W}
              height={60}
              seed={seed + 60}
              rows={5}
            />
          </div>
          </InteractiveChartWrapper>
        </div>
        </ScrollRevealSection>
      </div>

      <ScrollDivider delay={400} />

      {/* 2.5D Coverage Comparison Terrain */}
      {regionData.length > 0 && (
        <ScrollRevealSection animation="depth-emerge" staggerDelay={500} sound="settle">
        <div style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 10px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const }}>
              YOUR PLAN vs ML IDEAL — COVERAGE TERRAIN
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(100,180,230,0.6)' }} />
                <span className="text-white/65 font-mono text-xs">Your Plan</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(136,85,170,0.6)' }} />
                <span className="text-white/65 font-mono text-xs">ML Ideal</span>
              </div>
            </div>
          </div>
          <InteractiveChartWrapper label="Coverage Terrain Comparison" explanation="A 2.5D terrain comparing your plan (blue) against the ML ideal (purple). Height represents coverage intensity. Regions where the ML ideal towers over yours suggest opportunities for reallocation.">
          <AffectedAreaHeightMap
            data={regionData.map((r: any) => ({
              region: r.region,
              severity: Math.max(r.userCoverage, r.mlCoverage, 0.1),
              metric: r.userCoverage,
              metricB: r.mlCoverage,
              valueLabel: `${Math.round(r.userCoverage * 100)}%`,
            }))}
            width={600}
            height={200}
            theme="coverage"
          />
          </InteractiveChartWrapper>
        </div>
        </ScrollRevealSection>
      )}

      {/* Anchored insight */}
      <ScrollRevealSection animation="fade-up" staggerDelay={600}>
      <div className="text-center border-t border-white/[0.06] pt-4">
        <div className="text-white/70 font-mono text-sm leading-relaxed max-w-md mx-auto">
          {totalMlCovered > totalRealCovered
            ? `ML-optimal allocation could reach ${(totalMlCovered - totalRealCovered).toLocaleString()} more people than the historical response.`
            : `Historical response reached ${(totalRealCovered - totalMlCovered).toLocaleString()} more people than the ML model predicted as optimal.`
          }
        </div>
      </div>
      </ScrollRevealSection>
    </div>
  )
}
