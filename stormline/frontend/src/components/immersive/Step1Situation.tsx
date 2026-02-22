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
import InteractiveChartWrapper from '../shared/InteractiveChartWrapper'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const W = 288

// Starfield background pattern for simulation panels
const STARFIELD_BG = {
  background: '#000',
  backgroundImage: `
    radial-gradient(2px 2px at 20% 30%, white, rgba(255,255,255,0)),
    radial-gradient(2px 2px at 60% 70%, white, rgba(255,255,255,0)),
    radial-gradient(1px 1px at 50% 50%, white, rgba(255,255,255,0)),
    radial-gradient(1px 1px at 80% 10%, white, rgba(255,255,255,0)),
    radial-gradient(2px 2px at 90% 60%, white, rgba(255,255,255,0)),
    radial-gradient(1px 1px at 30% 80%, white, rgba(255,255,255,0)),
    radial-gradient(1.5px 1.5px at 70% 20%, white, rgba(255,255,255,0)),
    radial-gradient(1px 1px at 40% 40%, white, rgba(255,255,255,0)),
    radial-gradient(2px 2px at 10% 90%, white, rgba(255,255,255,0)),
    radial-gradient(1px 1px at 85% 85%, white, rgba(255,255,255,0))
  `,
  backgroundRepeat: 'repeat',
  backgroundSize: '200px 200px',
  backgroundAttachment: 'fixed'
}

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
          className="text-white/85 font-rajdhani text-sm tracking-[0.3em] uppercase"
          as="div"
        />
        <h2 className="text-white font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text={selectedHurricane.name} emphasis="headline" delayMs={400} charIntervalMs={55} />
        </h2>
        <div className="text-white/65 font-mono text-sm">
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
          ...STARFIELD_BG,
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '14px 16px 18px',
        }}>
          {/* Header */}
          <div className="mb-1">
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '1rem', color: 'rgba(255,255,255,1)', letterSpacing: '0.08em', lineHeight: 1.1 }}>
              {selectedHurricane.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', letterSpacing: '0.16em', marginTop: 2, color: maxSeverity > 0.7 ? 'rgba(255,100,80,0.9)' : maxSeverity > 0.4 ? 'rgba(255,220,100,0.9)' : 'rgba(120,220,120,0.9)' }}>
              CATEGORY {selectedHurricane.max_category} — {selectedHurricane.year}
            </div>
          </div>

          <div className="fdp-divider" style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* LargePercentReadout — overall severity score */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            SEVERITY INDEX
          </div>
          <InteractiveChartWrapper label="Severity Index" explanation="The average severity across all affected regions, measured on a 0-10 scale. Higher values indicate more intense humanitarian impact including infrastructure damage, population displacement, and resource scarcity.">
            <LargePercentReadout
              value={Math.round(avgSeverity * 100)}
              label="AVG SEVERITY"
              subValue={`peak ${(maxSeverity * 10).toFixed(1)}`}
              trend={maxSeverity > 0.7 ? 'up' : maxSeverity > 0.4 ? 'flat' : 'down'}
              alert={avgSeverity > 0.5}
            />
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 2 }}>
            <StatReadout label="REGIONS" value={`${regionData.length}`} />
            <StatReadout label="BUDGET" value={formatBudget(gameTotalBudget)} />
            <StatReadout label="POP" value={`${(totalPeopleInNeed / 1e6).toFixed(1)}M`} alert={totalPeopleInNeed > 1e6} />
            <StatReadout label="CAT" value={`${selectedHurricane.max_category}`} alert={selectedHurricane.max_category >= 4} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* RidgeChart — severity / population / coverage profiles */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY / NEED / COVERAGE
          </div>
          <InteractiveChartWrapper label="Severity / Need / Coverage" explanation="Three overlapping profiles showing severity intensity, population need, and existing coverage ratio across affected regions. Where the severity profile towers over coverage, those regions face the largest humanitarian gaps.">
            <div style={{ marginBottom: 2 }}>
              <RidgeChart
                series={severityTimeSeries}
                width={W}
                height={90}
                seed={seed + 10}
                colors={[
                  'rgba(255,100,80,0.12)',
                  'rgba(255,180,60,0.09)',
                  'rgba(100,180,220,0.08)',
                ]}
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* ThinVerticalBars — population by region */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            POPULATION DENSITY
          </div>
          <InteractiveChartWrapper label="Population Density" explanation="Population in need across each affected region. Taller bars highlight regions where the most people require humanitarian assistance. This distribution guides how resources should be prioritized.">
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
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* PerspectiveGrid — severity strata */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY STRATA
          </div>
          <InteractiveChartWrapper label="Severity Strata" explanation="A 3D perspective view of severity levels across regions. The receding grid shows depth stratification — front bars represent current severity while deeper layers show projected escalation patterns.">
            <div style={{ marginBottom: 2 }}>
              <PerspectiveGrid
                data={severityDistribution}
                width={W}
                height={60}
                seed={seed + 40}
                rows={5}
              />
            </div>
          </InteractiveChartWrapper>
        </div>

        {/* Right Panel — Impact Assessment */}
        <div className="flex-1 flex flex-col gap-0" style={{
          ...STARFIELD_BG,
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '14px 16px 18px',
        }}>
          {/* ConcentricRadar — multi-metric overview */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            RISK EXPOSURE
          </div>
          <InteractiveChartWrapper label="Risk Exposure" explanation="Multi-dimensional risk assessment showing severity, population impact, hurricane category, and current coverage. Longer arcs indicate higher exposure in that dimension. When multiple arcs extend far, the overall risk profile is critical.">
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
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* SegmentedHorizontalBars — per-region severity */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            REGIONAL SEVERITY
          </div>
          <InteractiveChartWrapper label="Regional Severity" explanation="Per-region severity breakdown showing which areas are most affected. Amber-highlighted bars exceed the critical threshold and require priority resource allocation.">
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
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* MountainSilhouette — severity/population distribution */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
            SEVERITY DENSITY
          </div>
          <InteractiveChartWrapper label="Severity Density" explanation="Overlapping terrain profiles showing severity distribution (primary) and population density (secondary). Peaks where both profiles align indicate the most critical humanitarian zones.">
            <div style={{ marginBottom: 2 }}>
              <MountainSilhouette
                data={severityDistribution}
                width={W}
                height={48}
                seed={seed + 50}
                color={avgSeverity > 0.5 ? 'rgba(255,100,80,0.12)' : 'rgba(255,255,255,0.1)'}
                secondaryData={populationDistribution.map(p => {
                  const maxP = Math.max(...populationDistribution, 1)
                  return (p / maxP) * Math.max(...severityDistribution, 1)
                })}
              />
            </div>
          </InteractiveChartWrapper>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

          {/* Response metrics */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
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
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0', flexShrink: 0 }} />

              {/* Funding distribution */}
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                FUNDING ALLOCATION
              </div>
              <InteractiveChartWrapper label="Funding Allocation" explanation="Historical pooled fund budget distribution across regions. Compare these allocations against the severity and population data above to identify potential funding mismatches.">
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
              </InteractiveChartWrapper>
            </>
          )}
        </div>
      </div>

      {/* 2.5D Affected Area Height Map */}
      <div style={{
        ...STARFIELD_BG,
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '14px 16px 10px',
      }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
          AFFECTED REGIONS — SEVERITY TERRAIN
        </div>
        <InteractiveChartWrapper label="Affected Regions Terrain" explanation="A 2.5D isometric terrain visualization where height represents severity and color intensity shows coverage ratio. Taller, darker columns indicate severely affected regions with low existing coverage.">
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
        </InteractiveChartWrapper>
      </div>

      {/* Affected countries */}
      <div className="text-center">
        <div className="text-white/85 font-mono text-sm">
          {selectedHurricane.affected_countries.join(' / ')}
        </div>
      </div>
    </div>
  )
}
