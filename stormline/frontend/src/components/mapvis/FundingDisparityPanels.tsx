/**
 * FundingDisparityPanels — Intelligence-style data panels.
 *
 * Each visualization slot uses a unique archetype (no repeats):
 *
 * LEFT PANEL:
 *  - LargePercentReadout (7) → preparedness score
 *  - RidgeChart (2) → preparedness / funding / risk ridges
 *  - ConcentricRadar (4) → multi-metric radar
 *  - ThinVerticalBars (5) → funding distribution bins
 *  - PerspectiveGrid (6) → funding time series depth
 *  - SegmentedHorizontalBars (8) → infrastructure metrics
 *
 * RIGHT PANEL:
 *  - CircularGauge (9) → aid gap percentage
 *  - TriangularAreaFill (1) → aid vs modeled need
 *  - FanBurst (3) → gap dispersion rays
 *  - MountainSilhouette (10) → risk distribution
 *  - DotBarStrip (11) → major disaster events
 */

import { useMemo } from 'react'
import { getCountryFundingDetail, type CountryFundingDetail } from '../../data/fundingDisparityDetails'
import {
  LargePercentReadout,
  RidgeChart,
  ConcentricRadar,
  ThinVerticalBars,
  PerspectiveGrid,
  SegmentedHorizontalBars,
  CircularGauge,
  TriangularAreaFill,
  FanBurst,
  MountainSilhouette,
  DotBarStrip,
  StatReadout,
  TrendIndicator,
} from './charts/ChartPrimitives'

const W = 288

// ─── Left Panel ──────────────────────────────────────────────────────────

function LeftPanel({ data }: { data: CountryFundingDetail }) {
  const seed = useMemo(() => {
    let h = 0
    for (let i = 0; i < data.name.length; i++) h = ((h << 5) - h + data.name.charCodeAt(i)) | 0
    return Math.abs(h)
  }, [data.name])

  const trendDir = data.fundingTrend === 'improving' ? 'up' as const :
    data.fundingTrend === 'declining' ? 'down' as const : 'flat' as const

  return (
    <div className="fdp-panel fdp-panel-left">
      {/* Header */}
      <div className="fdp-panel-header">
        <div className="fdp-country-name">{data.name}</div>
        <div className="fdp-disparity-badge" style={{
          color: data.disparityLevel === 'Well-Funded' ? 'rgba(120,220,120,0.6)' :
                 data.disparityLevel === 'Moderate' ? 'rgba(255,220,100,0.6)' :
                 data.disparityLevel === 'Under-Resourced' ? 'rgba(255,160,60,0.6)' :
                 'rgba(255,100,80,0.6)',
        }}>
          {data.disparityLevel.toUpperCase()}
        </div>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 7: Large Percent Readout — preparedness */}
      <div className="fdp-section-label">
        PREPAREDNESS INDEX
        <TrendIndicator trend={data.fundingTrend} />
      </div>
      <LargePercentReadout
        value={data.preparednessScore}
        label="READINESS"
        subValue={`$${data.fundingPerCapita}/cap`}
        trend={trendDir}
        alert={data.preparednessScore < 40}
      />

      <div className="fdp-divider" />

      {/* Overview stats */}
      <div className="fdp-stat-grid">
        <StatReadout label="RESIL" value={data.resilienceIndex.toFixed(2)} />
        <StatReadout label="$/CAP" value={`${data.fundingPerCapita}`} />
        <StatReadout label="GDP" value={`${data.gdpBillions}B`} />
        <StatReadout label="POP" value={`${data.populationMillions}M`} />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 2: Ridge Chart — preparedness / funding / risk */}
      <div className="fdp-section-label">
        PREPAREDNESS / FUNDING / RISK
        <TrendIndicator trend={data.riskTrend} />
      </div>
      <div className="fdp-chart-container">
        <RidgeChart
          series={[
            data.preparednessTimeSeries,
            data.fundingTimeSeries,
            data.riskTimeSeries,
          ]}
          width={W}
          height={90}
          seed={seed + 10}
          colors={[
            'rgba(255,255,255,0.12)',
            'rgba(255,180,60,0.09)',
            'rgba(255,255,255,0.06)',
          ]}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 4: Concentric Radar — multi-metric */}
      <div className="fdp-section-label">RISK EXPOSURE</div>
      <div className="fdp-chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
        <ConcentricRadar
          values={[
            { label: 'RISK', value: data.riskExposure * 100, max: 100 },
            { label: 'RESIL', value: data.resilienceIndex * 100, max: 100 },
            { label: 'PREP', value: data.preparednessScore, max: 100 },
            { label: 'WARN', value: data.earlyWarningCoverage, max: 100 },
          ]}
          size={100}
          seed={seed + 20}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 5: Thin Vertical Bars — funding distribution */}
      <div className="fdp-section-label">ALLOCATION DENSITY</div>
      <div className="fdp-chart-container">
        <ThinVerticalBars
          data={data.fundingDistribution}
          width={W}
          height={48}
          seed={seed + 30}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 6: Perspective Grid — funding timeline depth */}
      <div className="fdp-section-label">FUNDING STRATA</div>
      <div className="fdp-chart-container">
        <PerspectiveGrid
          data={data.fundingTimeSeries}
          width={W}
          height={60}
          seed={seed + 40}
          rows={5}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 8: Segmented Horizontal Bars — infrastructure metrics */}
      <div className="fdp-section-label">INFRASTRUCTURE</div>
      <div className="fdp-chart-container">
        <SegmentedHorizontalBars
          bars={[
            { label: 'INFRA', value: data.infrastructureIndex, max: 100 },
            { label: 'HEALTH', value: data.healthcareCapacity, max: 100 },
            { label: 'WARN', value: data.earlyWarningCoverage, max: 100 },
          ]}
          width={W}
          height={42}
        />
      </div>

      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-stat-grid fdp-stat-grid-2">
            <StatReadout label="CUM. GAP" value={`$${data.cumulativeUnderfunding}B`} alert />
            <StatReadout label="YRS" value={`${data.yearsUnderfunded}`} alert />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Right Panel ─────────────────────────────────────────────────────────

function RightPanel({ data }: { data: CountryFundingDetail }) {
  const seed = useMemo(() => {
    let h = 0
    for (let i = 0; i < data.name.length; i++) h = ((h << 5) - h + data.name.charCodeAt(i)) | 0
    return Math.abs(h) + 5000
  }, [data.name])

  const modeledNeedSeries = data.aidReceivedTimeSeries.map((_, i) =>
    data.modeledNeedPerCapita * (0.85 + (i / 12) * 0.3)
  )

  const gapSignal = data.aidReceivedTimeSeries.map((v, i) => {
    const need = modeledNeedSeries[i]
    return Math.max(0, ((need - v) / (need || 1)) * 100)
  })

  return (
    <div className="fdp-panel fdp-panel-right">
      {/* ARCHETYPE 9: Circular Gauge — aid gap */}
      <div className="fdp-section-label">AID GAP</div>
      <div className="fdp-chart-container" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CircularGauge
          value={data.aidGapPercent}
          max={100}
          label="GAP"
          size={72}
          alert={data.aidGapPercent > 50}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatReadout label="AID/CAP" value={`$${data.aidPerCapita}`}
            alert={data.aidGapPercent > 50} />
          <StatReadout label="NEED/CAP" value={`$${data.modeledNeedPerCapita}`} />
          <StatReadout label="DELAY" value={`${data.responseDelayDays}d`}
            alert={data.responseDelayDays > 7} />
        </div>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 1: Triangular Area Fill — aid received vs modeled need */}
      <div className="fdp-section-label">AID / NEED DIVERGENCE</div>
      <div className="fdp-chart-container">
        <TriangularAreaFill
          dataA={data.aidReceivedTimeSeries}
          dataB={modeledNeedSeries}
          width={W}
          height={80}
          seed={seed + 10}
          accentColor={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.6)' : 'rgba(255,180,60,0.4)'}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 3: Fan Burst — gap dispersion */}
      <div className="fdp-section-label">GAP DISPERSION</div>
      <div className="fdp-chart-container">
        <FanBurst
          values={gapSignal}
          width={W}
          height={64}
          seed={seed + 20}
          accentColor={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.4)' : 'rgba(255,180,60,0.3)'}
        />
      </div>

      <div className="fdp-divider" />

      {/* Response metrics */}
      <div className="fdp-section-label">RESPONSE</div>
      <div className="fdp-stat-grid">
        <StatReadout label="TIME" value={`${data.avgResponseTimeHours}h`}
          alert={data.avgResponseTimeHours > 72} />
        <StatReadout label="INFRA" value={`${data.infrastructureIndex}`} />
        <StatReadout label="HEALTH" value={`${data.healthcareCapacity}`} />
        <StatReadout label="WARN" value={`${data.earlyWarningCoverage}%`} />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 10: Mountain Silhouette — risk distribution */}
      <div className="fdp-section-label">RISK DENSITY</div>
      <div className="fdp-chart-container">
        <MountainSilhouette
          data={data.riskDistribution}
          width={W}
          height={48}
          seed={seed + 30}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.12)' : 'rgba(255,255,255,0.1)'}
          secondaryData={data.fundingDistribution}
        />
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 11: Dot-Bar Strip — major events */}
      <div className="fdp-section-label">EVENT TIMELINE</div>
      <div className="fdp-chart-container">
        <DotBarStrip
          events={data.majorEvents.map(ev => ({
            position: ev.year - 2013,
            magnitude: ev.severity,
          }))}
          width={W}
          height={36}
          seed={seed + 40}
          span={11}
        />
      </div>

      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-section-label">UNDERFUNDING</div>
          <div className="fdp-stat-grid fdp-stat-grid-2">
            <StatReadout label="CUM. GAP" value={`$${data.cumulativeUnderfunding}B`} alert />
            <StatReadout label="YRS" value={`${data.yearsUnderfunded}`} alert />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────

interface FundingDisparityPanelsProps {
  selectedCountry: string | null
}

export default function FundingDisparityPanels({ selectedCountry }: FundingDisparityPanelsProps) {
  const data = useMemo(
    () => (selectedCountry ? getCountryFundingDetail(selectedCountry) : null),
    [selectedCountry]
  )
  if (!data) return null
  return (
    <div className="fdp-container">
      <LeftPanel data={data} />
      <RightPanel data={data} />
    </div>
  )
}
