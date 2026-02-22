/**
 * Step 5 — Summary Insight
 *
 * FDP-style intelligence panels with ChartPrimitives.
 * Shows the delta between ML ideal and historical as dense telemetry.
 * Extremely concise. End of flow.
 */

import { useMemo } from 'react'
import { useStore } from '../../state/useStore'
import TypewriterText from '../TypewriterText'
import {
  LargePercentReadout,
  CircularGauge,
  TriangularAreaFill,
  RidgeChart,
  FanBurst,
  MountainSilhouette,
  ThinVerticalBars,
  SegmentedHorizontalBars,
  StatReadout,
} from '../mapvis/charts/ChartPrimitives'
import AffectedAreaHeightMap from '../shared/AffectedAreaHeightMap'
import InteractiveChartWrapper from '../shared/InteractiveChartWrapper'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const W = 288

export default function Step5Summary() {
  const { comparisonData, coverage, selectedHurricane } = useStore()

  const seed = useMemo(() => {
    if (!comparisonData?.realPlan) return 500
    const regions = comparisonData.realPlan.allocations.map((a: any) => a.region).join('')
    let h = 0
    for (let i = 0; i < regions.length; i++)
      h = ((h << 5) - h + regions.charCodeAt(i)) | 0
    return Math.abs(h) + 5000
  }, [comparisonData])

  const deltaData = useMemo(() => {
    if (!comparisonData?.realPlan || !comparisonData?.mlPlan) return []
    return comparisonData.realPlan.allocations.map((ra: any) => {
      const ma = comparisonData.mlPlan.allocations.find((a: any) => a.region === ra.region)
      const covData = coverage.find(
        (c) => c.hurricane_id === selectedHurricane?.id && c.admin1 === ra.region
      )
      const mlBudget = ma?.budget || 0
      const realBudget = ra.budget || 0
      const mlCoverage = ma?.coverage_estimate?.coverage_ratio || 0
      const realCoverage = ra.coverage_estimate?.coverage_ratio || 0

      return {
        region: ra.region,
        delta: mlBudget - realBudget,
        severity: covData?.severity_index ? Math.min(covData.severity_index / 10, 1) : 0.5,
        coverageGap: mlCoverage - realCoverage,
        mlBudget,
        realBudget,
        mlCoverage,
        realCoverage,
      }
    })
  }, [comparisonData, coverage, selectedHurricane])

  const totalMlCovered = comparisonData?.mlPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0
  const totalRealCovered = comparisonData?.realPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0
  const totalUserCovered = comparisonData?.userPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0

  const coverageDelta = totalMlCovered - totalRealCovered
  const userVsMl = totalUserCovered - totalMlCovered

  const mostUnderfunded = [...deltaData].sort((a, b) => b.delta - a.delta)[0]

  // Derived series for charts
  const mlBudgetSeries = deltaData.map(d => d.mlBudget)
  const realBudgetSeries = deltaData.map(d => d.realBudget)
  const deltaSeries = deltaData.map(d => Math.abs(d.delta))
  const severitySeries = deltaData.map(d => d.severity * 100)
  const coverageGapSeries = deltaData.map(d => Math.max(0, d.coverageGap * 100))
  const mlCovSeries = deltaData.map(d => d.mlCoverage * 100)
  const realCovSeries = deltaData.map(d => d.realCoverage * 100)

  // Loading state if data isn't ready
  if (!comparisonData) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <div className="text-white/60 font-rajdhani text-sm tracking-[0.3em] uppercase">
            Loading Summary
          </div>
          <div className="text-white/60 font-mono text-sm mt-2">
            Waiting for analysis data...
          </div>
        </div>
      </div>
    )
  }

  const underfundedCount = deltaData.filter(d => d.delta > 0).length
  const overfundedCount = deltaData.filter(d => d.delta < 0).length
  const avgGapPct = deltaData.length > 0
    ? Math.abs(deltaData.reduce((s, d) => s + d.coverageGap, 0) / deltaData.length * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <TypewriterText text="Delta Insights" emphasis="soft" delayMs={100} className="text-white/60 font-rajdhani text-sm tracking-[0.3em] uppercase" as="div" />
        <h2 className="text-white/95 font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text="What Could Have Changed" emphasis="headline" delayMs={300} charIntervalMs={35} />
        </h2>
      </div>

      {/* Key delta insight — one line */}
      <div className="text-center">
        <div className="text-white/70 font-mono text-sm leading-relaxed">
          {coverageDelta > 0
            ? `${coverageDelta.toLocaleString()} additional people reachable with ideal allocation`
            : `Historical response covered ${Math.abs(coverageDelta).toLocaleString()} more than ML ideal`
          }
        </div>
      </div>

      {/* FDP-style two-panel layout */}
      <div className="flex gap-4">
        {/* Left Panel — Budget Delta Intelligence */}
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* Coverage Delta */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            COVERAGE DELTA
          </div>
          <InteractiveChartWrapper label="Coverage Delta" explanation="The average gap between ML-optimized allocation and historical response across all regions. A higher percentage means more people could have been reached with better resource distribution.">
            <LargePercentReadout
              value={Math.round(avgGapPct)}
              label="AVG GAP"
              subValue={`${underfundedCount} underfunded`}
              trend={coverageDelta > 0 ? 'up' : coverageDelta < 0 ? 'down' : 'flat'}
              alert={avgGapPct > 15}
            />
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="UNDER" value={`${underfundedCount}`} alert={underfundedCount > 0} />
            <StatReadout label="OVER" value={`${overfundedCount}`} />
            <StatReadout label="DELTA" value={coverageDelta > 0 ? `+${(coverageDelta / 1e3).toFixed(0)}K` : `${(coverageDelta / 1e3).toFixed(0)}K`} alert={Math.abs(coverageDelta) > 10000} />
            <StatReadout label="YOU VS ML" value={userVsMl > 0 ? `+${(userVsMl / 1e3).toFixed(0)}K` : `${(userVsMl / 1e3).toFixed(0)}K`} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* TriangularAreaFill — ML vs Real budget */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            ML / HISTORICAL DIVERGENCE
          </div>
          <InteractiveChartWrapper label="ML / Historical Divergence" explanation="The filled area between ML-optimal and historical budget curves reveals where funding priorities diverged most. Wider gaps represent the largest opportunities for improved humanitarian outcomes through better allocation.">
            <div style={{ marginBottom: 2 }}>
              <TriangularAreaFill
                dataA={mlBudgetSeries.length > 1 ? mlBudgetSeries : [0, 100]}
                dataB={realBudgetSeries.length > 1 ? realBudgetSeries : [0, 100]}
                width={W}
                height={80}
                seed={seed + 10}
                accentColor="rgba(255,160,60,0.5)"
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* RidgeChart — ML vs real coverage */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            COVERAGE PROFILES
          </div>
          <InteractiveChartWrapper label="Coverage Profiles" explanation="Layered coverage profiles comparing ML-ideal and historical approaches. Where the ML profile exceeds historical, data-driven allocation would have reached more people. The gap pattern reveals systematic biases in traditional response.">
            <div style={{ marginBottom: 2 }}>
              <RidgeChart
                series={[
                  mlCovSeries.length > 1 ? mlCovSeries : [0],
                  realCovSeries.length > 1 ? realCovSeries : [0],
                ]}
                width={W}
                height={70}
                seed={seed + 20}
                colors={['rgba(136,85,170,0.12)', 'rgba(170,68,68,0.08)']}
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* ThinVerticalBars — delta magnitudes */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            DELTA MAGNITUDE
          </div>
          <InteractiveChartWrapper label="Delta Magnitude" explanation="The absolute budget difference between ML-optimal and historical allocation for each region. Taller bars indicate where the largest reallocation would have the most impact on coverage.">
            <div style={{ marginBottom: 2 }}>
              <ThinVerticalBars
                data={deltaSeries.length > 1 ? deltaSeries : [0, 100]}
                width={W}
                height={60}
                seed={seed + 30}
                labels={deltaData.map(d => d.region)}
                unit="Budget Gap ($)"
              />
            </div>
          </InteractiveChartWrapper>
        </div>

        {/* Right Panel — Gap Analysis */}
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* Gap gauge */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            PERFORMANCE
          </div>
          <InteractiveChartWrapper label="Performance" explanation="Overall gap gauge showing how far actual response deviated from optimal. The companion metrics show total people reached under each strategy — ML ideal, historical, and your plan.">
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 2 }}>
              <CircularGauge
                value={Math.round(avgGapPct)}
                max={100}
                label="GAP"
                size={72}
                alert={avgGapPct > 20}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                <StatReadout label="ML REACH" value={totalMlCovered > 1e6 ? `${(totalMlCovered / 1e6).toFixed(1)}M` : `${(totalMlCovered / 1e3).toFixed(0)}K`} />
                <StatReadout label="REAL REACH" value={totalRealCovered > 1e6 ? `${(totalRealCovered / 1e6).toFixed(1)}M` : `${(totalRealCovered / 1e3).toFixed(0)}K`} alert={totalRealCovered < totalMlCovered} />
                <StatReadout label="YOUR REACH" value={totalUserCovered > 1e6 ? `${(totalUserCovered / 1e6).toFixed(1)}M` : `${(totalUserCovered / 1e3).toFixed(0)}K`} />
              </div>
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* FanBurst — gap dispersion */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            GAP DISPERSION
          </div>
          <InteractiveChartWrapper label="Gap Dispersion" explanation="Radiating lines visualize how coverage gaps fan out across regions. Concentrated patterns suggest a few regions drive most of the gap, while dispersed patterns indicate broad systemic challenges.">
            <div style={{ marginBottom: 2 }}>
              <FanBurst
                values={coverageGapSeries.length > 1 ? coverageGapSeries : [0, 50]}
                width={W}
                height={64}
                seed={seed + 40}
                accentColor="rgba(255,160,60,0.4)"
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* MountainSilhouette — severity vs gap */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY / GAP DENSITY
          </div>
          <InteractiveChartWrapper label="Severity / Gap Density" explanation="Overlapping terrain showing severity distribution and coverage gaps. Peaks where both align represent the most critical humanitarian failures — high-severity regions with the largest response gaps.">
            <div style={{ marginBottom: 2 }}>
              <MountainSilhouette
                data={severitySeries.length > 1 ? severitySeries : [0, 50]}
                width={W}
                height={48}
                seed={seed + 50}
                color="rgba(255,160,60,0.12)"
                secondaryData={coverageGapSeries.length > 1 ? coverageGapSeries : [0, 25]}
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* Biggest gap region bars */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            REGIONAL GAPS
          </div>
          <InteractiveChartWrapper label="Regional Gaps" explanation="Per-region coverage gap sorted by magnitude. These are the regions where reallocation would have the largest positive impact on humanitarian outcomes.">
            <div style={{ marginBottom: 2 }}>
              <SegmentedHorizontalBars
                bars={[...deltaData]
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                  .slice(0, 5)
                  .map(d => ({
                    label: d.region.toUpperCase(),
                    value: Math.round(Math.abs(d.coverageGap) * 100),
                    max: 100,
                  }))}
                width={W}
                height={Math.min(deltaData.length, 5) * 16 + 8}
              />
            </div>
          </InteractiveChartWrapper>

          {mostUnderfunded && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                <StatReadout label="TOP GAP" value={mostUnderfunded.region} alert />
                <StatReadout label="AMOUNT" value={formatBudget(Math.abs(mostUnderfunded.delta))} alert />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2.5D Delta Gap Terrain */}
      {deltaData.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.85) 0%, rgba(0,0,4,0.9) 50%, rgba(0,0,3,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 10px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' as const }}>
              COVERAGE GAP TERRAIN — ML IDEAL vs HISTORICAL
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(255,160,60,0.6)' }} />
                <span className="text-white/65 font-mono text-xs">Gap</span>
              </div>
            </div>
          </div>
          <InteractiveChartWrapper label="Coverage Gap Terrain" explanation="A 2.5D isometric view of coverage gaps across regions. Height represents severity, color intensity shows the gap between ML-ideal and historical response. Tall, bright columns are the highest-priority targets for improved allocation.">
            <AffectedAreaHeightMap
              data={deltaData.map(d => ({
                region: d.region,
                severity: d.severity,
                metric: Math.abs(d.coverageGap),
                valueLabel: `${d.coverageGap > 0 ? '+' : ''}${Math.round(d.coverageGap * 100)}%`,
              }))}
              width={600}
              height={200}
              theme="delta"
            />
          </InteractiveChartWrapper>
        </div>
      )}

      {/* Concise insights */}
      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
        {mostUnderfunded && (
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#cc5566] mt-1.5 shrink-0" />
            <div>
              <div className="text-white/70 font-rajdhani text-sm tracking-wider uppercase">Largest Gap</div>
              <div className="text-white/75 font-mono text-sm">
                {mostUnderfunded.region}: {mostUnderfunded.delta > 0 ? 'underfunded' : 'overfunded'} by {formatBudget(Math.abs(mostUnderfunded.delta))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4488aa] mt-1.5 shrink-0" />
          <div>
            <div className="text-white/70 font-rajdhani text-sm tracking-wider uppercase">Your Performance</div>
            <div className="text-white/75 font-mono text-sm">
              {userVsMl > 0
                ? `You covered ${userVsMl.toLocaleString()} more people than the ML ideal`
                : userVsMl < 0
                  ? `ML ideal would cover ${Math.abs(userVsMl).toLocaleString()} more people`
                  : 'Matched ML ideal coverage'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
