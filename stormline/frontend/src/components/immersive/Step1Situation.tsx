/**
 * Step 1 — Situation / System Framing
 *
 * FDP-style intelligence panels with ChartPrimitives.
 * Purpose: establish spatial severity & context using dense telemetry visuals.
 *
 * Uses ONLY hurricane + coverage data — no comparisonData required.
 */

import { useMemo } from 'react'
import { useStore } from '../../state/useStore'
import TypewriterText, { CountUpText } from '../TypewriterText'
import {
  LargePercentReadout,
  RidgeChart,
  ConcentricRadar,
  ThinVerticalBars,
  PerspectiveGrid,
  SegmentedHorizontalBars,
  MountainSilhouette,
  StatReadout,
} from '../mapvis/charts/ChartPrimitives'
import AffectedAreaHeightMap from '../shared/AffectedAreaHeightMap'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const W = 288

export default function Step1Situation() {
  const { selectedHurricane, coverage, gameTotalBudget } = useStore()

  // Build region data from coverage — no comparisonData needed
  const regionData = useMemo(() => {
    if (!selectedHurricane) return []

    const fromCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => ({
        region: c.admin1,
        severity: Math.min(c.severity_index / 10, 1),
        peopleInNeed: c.people_in_need,
        coverageRatio: c.coverage_ratio,
        pooledFundBudget: c.pooled_fund_budget,
      }))

    if (fromCoverage.length > 0) return fromCoverage

    return (selectedHurricane.affected_countries || []).map((country: string) => ({
      region: country,
      severity: 0.5,
      peopleInNeed: Math.round(selectedHurricane.estimated_population_affected / (selectedHurricane.affected_countries.length || 1)),
      coverageRatio: 0,
      pooledFundBudget: 0,
    }))
  }, [selectedHurricane, coverage])

  // Derived data for chart primitives
  const seed = useMemo(() => {
    if (!selectedHurricane) return 100
    let h = 0
    for (let i = 0; i < selectedHurricane.name.length; i++)
      h = ((h << 5) - h + selectedHurricane.name.charCodeAt(i)) | 0
    return Math.abs(h)
  }, [selectedHurricane])

  // Severity time-series (synthetic from region data for ridge chart)
  const severityTimeSeries = useMemo(() => {
    if (regionData.length === 0) return [Array(12).fill(0.5)]
    return [
      // Severity profile
      regionData.map(r => r.severity * 100),
      // Population need profile (normalized)
      regionData.map(r => {
        const maxNeed = Math.max(...regionData.map(d => d.peopleInNeed), 1)
        return (r.peopleInNeed / maxNeed) * 80
      }),
      // Coverage ratio profile
      regionData.map(r => r.coverageRatio * 100),
    ]
  }, [regionData])

  // Population distribution for thin bars
  const populationDistribution = useMemo(() => {
    return regionData.map(r => r.peopleInNeed)
  }, [regionData])

  // Severity distribution for mountain silhouette
  const severityDistribution = useMemo(() => {
    return regionData.map(r => r.severity * 100)
  }, [regionData])

  // Funding distribution
  const fundingDistribution = useMemo(() => {
    return regionData.map(r => r.pooledFundBudget)
  }, [regionData])

  if (!selectedHurricane) return null

  const totalPeopleInNeed = regionData.reduce((s, r) => s + r.peopleInNeed, 0)
  const avgSeverity = regionData.length > 0
    ? regionData.reduce((s, r) => s + r.severity, 0) / regionData.length
    : 0
  const maxSeverity = regionData.length > 0
    ? Math.max(...regionData.map(r => r.severity))
    : 0
  const avgCoverage = regionData.length > 0
    ? regionData.reduce((s, r) => s + r.coverageRatio, 0) / regionData.length
    : 0

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <TypewriterText
          text="Situation Assessment"
          emphasis="soft"
          delayMs={100}
          className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase"
          as="div"
        />
        <h2 className="text-white/90 font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text={selectedHurricane.name} emphasis="headline" delayMs={400} charIntervalMs={55} />
        </h2>
        <div className="text-white/30 font-mono text-xs">
          <TypewriterText
            text={`${selectedHurricane.year} \u2014 Category ${selectedHurricane.max_category} \u2014 ${selectedHurricane.estimated_population_affected.toLocaleString()} affected`}
            emphasis="normal"
            delayMs={800}
            charIntervalMs={18}
            onComplete={() => {}}
          />
        </div>
      </div>

      {/* FDP-style two-panel layout */}
      <div className="flex gap-4">
        {/* Left Panel — Severity Intelligence */}
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* Header */}
          <div className="mb-1">
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '1rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', lineHeight: 1.1 }}>
              {selectedHurricane.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.16em', marginTop: 2, color: 'rgba(255,255,255,0.4)' }}>
              CATEGORY {selectedHurricane.max_category} — {selectedHurricane.year}
            </div>
          </div>

          <div className="fdp-divider" style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* LargePercentReadout — overall severity score */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            SEVERITY INDEX
          </div>
          <LargePercentReadout
            value={Math.round(avgSeverity * 100)}
            label="AVG SEVERITY"
            subValue={`peak ${(maxSeverity * 10).toFixed(1)}`}
            trend={maxSeverity > 0.7 ? 'up' : maxSeverity > 0.4 ? 'flat' : 'down'}
            alert={avgSeverity > 0.5}
          />

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="REGIONS" value={`${regionData.length}`} />
            <StatReadout label="BUDGET" value={formatBudget(gameTotalBudget)} />
            <StatReadout label="POP" value={`${(totalPeopleInNeed / 1e6).toFixed(1)}M`} alert={totalPeopleInNeed > 1e6} />
            <StatReadout label="CAT" value={`${selectedHurricane.max_category}`} alert={selectedHurricane.max_category >= 4} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* RidgeChart — severity / population / coverage profiles */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY / NEED / COVERAGE
          </div>
          <div style={{ marginBottom: 2 }}>
            <RidgeChart
              series={severityTimeSeries}
              width={W}
              height={90}
              seed={seed + 10}
              colors={[
                'rgba(255,255,255,0.12)',
                'rgba(255,255,255,0.08)',
                'rgba(255,255,255,0.05)',
              ]}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* ThinVerticalBars — population by region */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            POPULATION DENSITY
          </div>
          <div style={{ marginBottom: 2 }}>
            <ThinVerticalBars
              data={populationDistribution}
              width={W}
              height={60}
              seed={seed + 30}
              labels={regionData.map(r => r.region)}
              unit="Population"
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* PerspectiveGrid — severity strata */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY STRATA
          </div>
          <div style={{ marginBottom: 2 }}>
            <PerspectiveGrid
              data={severityDistribution}
              width={W}
              height={60}
              seed={seed + 40}
              rows={5}
            />
          </div>
        </div>

        {/* Right Panel — Impact Assessment */}
        <div className="flex-1 flex flex-col gap-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0.85) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 16px 18px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '12px 12px',
        }}>
          {/* ConcentricRadar — multi-metric overview */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            RISK EXPOSURE
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
            <ConcentricRadar
              values={[
                { label: 'SEV', value: avgSeverity * 100, max: 100 },
                { label: 'POP', value: Math.min((totalPeopleInNeed / 5e6) * 100, 100), max: 100 },
                { label: 'CAT', value: (selectedHurricane.max_category / 5) * 100, max: 100 },
                { label: 'COV', value: avgCoverage * 100, max: 100 },
              ]}
              size={120}
              seed={seed + 20}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* SegmentedHorizontalBars — per-region severity */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            REGIONAL SEVERITY
          </div>
          <div style={{ marginBottom: 2 }}>
            <SegmentedHorizontalBars
              bars={regionData.slice(0, 6).map(r => ({
                label: r.region.toUpperCase(),
                value: Math.round(r.severity * 100),
                max: 100,
              }))}
              width={W}
              height={Math.min(regionData.length, 6) * 16 + 8}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* MountainSilhouette — severity/population distribution */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY DENSITY
          </div>
          <div style={{ marginBottom: 2 }}>
            <MountainSilhouette
              data={severityDistribution}
              width={W}
              height={48}
              seed={seed + 50}
              color={'rgba(255,255,255,0.1)'}
              secondaryData={populationDistribution.map(p => {
                const maxP = Math.max(...populationDistribution, 1)
                return (p / maxP) * Math.max(...severityDistribution, 1)
              })}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

          {/* Response metrics */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            RESPONSE METRICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="AVG COV" value={`${(avgCoverage * 100).toFixed(0)}%`} alert={avgCoverage < 0.5} />
            <StatReadout label="PEAK SEV" value={`${(maxSeverity * 10).toFixed(1)}`} alert={maxSeverity > 0.7} />
            <StatReadout label="COUNTRIES" value={`${selectedHurricane.affected_countries.length}`} />
            <StatReadout label="BUDGET" value={formatBudget(gameTotalBudget)} />
          </div>

          {fundingDistribution.some(f => f > 0) && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

              {/* Funding distribution */}
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                FUNDING ALLOCATION
              </div>
              <div style={{ marginBottom: 2 }}>
                <ThinVerticalBars
                  data={fundingDistribution}
                  width={W}
                  height={60}
                  seed={seed + 60}
                  labels={regionData.map(r => r.region)}
                  unit="Budget ($)"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2.5D Affected Area Height Map */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
        padding: '14px 16px 10px',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
        backgroundSize: '12px 12px',
      }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
          AFFECTED REGIONS — SEVERITY TERRAIN
        </div>
        <AffectedAreaHeightMap
          data={regionData.map(r => ({
            region: r.region,
            severity: r.severity,
            metric: r.coverageRatio,
            valueLabel: r.peopleInNeed >= 1e6 ? `${(r.peopleInNeed / 1e6).toFixed(1)}M` : r.peopleInNeed >= 1e3 ? `${(r.peopleInNeed / 1e3).toFixed(0)}K` : `${r.peopleInNeed}`,
          }))}
          width={600}
          height={200}
          theme="severity"
        />
      </div>

      {/* Affected countries */}
      <div className="text-center">
        <div className="text-white/20 font-mono text-[10px]">
          {selectedHurricane.affected_countries.join(' / ')}
        </div>
      </div>
    </div>
  )
}
