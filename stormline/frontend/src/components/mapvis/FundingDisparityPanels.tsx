/**
 * FundingDisparityPanels — Intelligence signal overlay for Funding Disparity mode.
 *
 * Architecture:
 *   Globe = visualization layer (untouched)
 *   Panels = intelligence signal layer (this file)
 *
 * Every chart is a multi-layer signal visualization.
 * Density > readability. Shape > explanation.
 * Panels are windows into data — not the dataset.
 */

import { useMemo } from 'react'
import { getCountryFundingDetail, type CountryFundingDetail } from '../../data/fundingDisparityDetails'
import {
  SignalLineChart,
  SignalAreaChart,
  SignalHistogram,
  SignalDotTimeline,
  ParticleField,
  NoiseBand,
  StatWithSparkline,
  TrendIndicator,
} from './charts/ChartPrimitives'

const CW = 280 // chart width

// ─── Left Panel ──────────────────────────────────────────────────────────

function LeftPanel({ data }: { data: CountryFundingDetail }) {
  const seed = useMemo(() => {
    let h = 0
    for (let i = 0; i < data.name.length; i++) h = ((h << 5) - h + data.name.charCodeAt(i)) | 0
    return Math.abs(h)
  }, [data.name])

  // Derived signals
  const fundingNorm = data.fundingTimeSeries.map(v => v / (data.fundingPerCapita || 1) * 50 + 30)
  const resilienceSignal = data.preparednessTimeSeries.map((v, i) =>
    v * 0.6 + fundingNorm[i] * 0.4 + ((i % 3 === 0) ? -2 : 1.5)
  )

  return (
    <div className="fdp-panel fdp-panel-left">
      {/* Header */}
      <div className="fdp-panel-header">
        <div className="fdp-country-name">{data.name}</div>
        <div className="fdp-disparity-badge" style={{
          color: data.disparityLevel === 'Well-Funded' ? 'rgba(120,220,120,0.7)' :
                 data.disparityLevel === 'Moderate' ? 'rgba(255,220,100,0.7)' :
                 data.disparityLevel === 'Under-Resourced' ? 'rgba(255,160,60,0.7)' :
                 'rgba(255,100,80,0.7)',
        }}>
          {data.disparityLevel.toUpperCase()}
        </div>
      </div>

      <div className="fdp-divider" />

      {/* Funding Overview — stat grid */}
      <div className="fdp-section-label">FUNDING OVERVIEW</div>
      <div className="fdp-stat-grid">
        <StatWithSparkline label="PREP. SCORE" value={`${data.preparednessScore}`} unit="%"
          sparkData={data.preparednessTimeSeries} seed={seed + 1} />
        <StatWithSparkline label="RESILIENCE" value={data.resilienceIndex.toFixed(2)}
          sparkData={resilienceSignal} seed={seed + 2} />
        <StatWithSparkline label="$/CAPITA" value={`${data.fundingPerCapita}`}
          sparkData={data.fundingTimeSeries} seed={seed + 3} />
        <StatWithSparkline label="GDP" value={`${data.gdpBillions}B`} seed={seed + 4} />
      </div>

      <div className="fdp-divider" />

      {/* Preparedness vs Funding — multi-signal line chart */}
      <div className="fdp-section-label">
        PREPAREDNESS / FUNDING SIGNAL
        <TrendIndicator trend={data.fundingTrend} />
      </div>
      <div className="fdp-chart-container">
        <SignalLineChart
          series={[data.preparednessTimeSeries, fundingNorm, resilienceSignal]}
          width={CW} height={90}
          colors={['rgba(255,255,255,0.55)', 'rgba(255,180,60,0.4)', 'rgba(255,255,255,0.15)']}
          seed={seed + 10}
        />
      </div>

      <div className="fdp-divider" />

      {/* Risk Exposure — particle field */}
      <div className="fdp-section-label">
        RISK EXPOSURE FIELD
        <TrendIndicator trend={data.riskTrend} />
      </div>
      <div className="fdp-chart-container">
        <ParticleField
          data={data.riskTimeSeries}
          width={CW} height={70}
          seed={seed + 20}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.55)' : 'rgba(255,255,255,0.4)'}
          particleCount={140}
          showSecondary={data.preparednessTimeSeries.map(v => v * 0.8)}
        />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline label="EXPOSURE" value={data.riskExposure.toFixed(2)}
          sparkData={data.riskTimeSeries} alert={data.riskExposure > 0.6} seed={seed + 21} />
        <StatWithSparkline label="POP." value={`${data.populationMillions}M`} seed={seed + 22} />
      </div>

      <div className="fdp-divider" />

      {/* Funding Distribution — signal histogram with secondary */}
      <div className="fdp-section-label">FUNDING DISTRIBUTION</div>
      <div className="fdp-chart-container">
        <SignalHistogram
          data={data.fundingDistribution}
          width={CW} height={48}
          color="rgba(255,255,255,0.4)"
          seed={seed + 30}
          secondaryData={data.riskDistribution}
        />
      </div>

      <div className="fdp-divider" />

      {/* Noise band — preparedness signal density */}
      <div className="fdp-section-label">PREPAREDNESS SIGNAL</div>
      <div className="fdp-chart-container">
        <NoiseBand
          data={data.preparednessTimeSeries}
          width={CW} height={20}
          color="rgba(255,255,255,0.3)"
          seed={seed + 40}
        />
      </div>

      <div className="fdp-divider" />

      {/* Historical Area Chart — funding trend with noise */}
      <div className="fdp-section-label">HISTORICAL FUNDING TREND</div>
      <div className="fdp-chart-container">
        <SignalAreaChart
          data={data.fundingTimeSeries}
          width={CW} height={56}
          color="rgba(255,255,255,0.4)"
          seed={seed + 50}
        />
      </div>

      {/* Underfunding stats */}
      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-stat-grid fdp-stat-grid-2">
            <StatWithSparkline label="CUMULATIVE GAP" value={`$${data.cumulativeUnderfunding}B`}
              alert seed={seed + 55} />
            <StatWithSparkline label="YRS UNDERFUNDED" value={`${data.yearsUnderfunded}`}
              alert seed={seed + 56} />
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

  // Derived: modeled need as time series
  const modeledNeedSeries = data.aidReceivedTimeSeries.map((_, i) =>
    data.modeledNeedPerCapita * (0.85 + (i / 12) * 0.3)
  )
  // Gap signal
  const gapSignal = data.aidReceivedTimeSeries.map((v, i) => {
    const need = modeledNeedSeries[i]
    return Math.max(0, ((need - v) / (need || 1)) * 100)
  })

  return (
    <div className="fdp-panel fdp-panel-right">
      {/* Aid Allocation — stat grid */}
      <div className="fdp-section-label">AID ALLOCATION</div>
      <div className="fdp-stat-grid">
        <StatWithSparkline label="AID/CAP" value={`$${data.aidPerCapita}`}
          sparkData={data.aidReceivedTimeSeries} alert={data.aidGapPercent > 50} seed={seed + 1} />
        <StatWithSparkline label="NEED/CAP" value={`$${data.modeledNeedPerCapita}`}
          sparkData={modeledNeedSeries} seed={seed + 2} />
        <StatWithSparkline label="GAP" value={`${data.aidGapPercent}%`}
          sparkData={gapSignal} sparkColor="rgba(255,160,60,0.4)"
          alert={data.aidGapPercent > 40} seed={seed + 3} />
        <StatWithSparkline label="DELAY" value={`${data.responseDelayDays}d`}
          alert={data.responseDelayDays > 7} seed={seed + 4} />
      </div>

      <div className="fdp-divider" />

      {/* Aid vs Need — signal line chart */}
      <div className="fdp-section-label">AID RECEIVED / MODELED NEED</div>
      <div className="fdp-chart-container">
        <SignalLineChart
          series={[data.aidReceivedTimeSeries, modeledNeedSeries, gapSignal.map(v => v * 0.5)]}
          width={CW} height={85}
          colors={['rgba(255,255,255,0.55)', 'rgba(255,100,80,0.4)', 'rgba(255,180,60,0.15)']}
          seed={seed + 10}
        />
      </div>

      <div className="fdp-divider" />

      {/* Aid Gap Particle Field */}
      <div className="fdp-section-label">AID DISPERSION FIELD</div>
      <div className="fdp-chart-container">
        <ParticleField
          data={gapSignal}
          width={CW} height={65}
          seed={seed + 20}
          color={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.5)' : 'rgba(255,255,255,0.4)'}
          particleCount={130}
          showSecondary={data.aidReceivedTimeSeries}
        />
      </div>

      <div className="fdp-divider" />

      {/* Response Metrics */}
      <div className="fdp-section-label">RESPONSE METRICS</div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline label="RESPONSE" value={`${data.avgResponseTimeHours}h`}
          alert={data.avgResponseTimeHours > 72} seed={seed + 30} />
        <StatWithSparkline label="INFRA." value={`${data.infrastructureIndex}`}
          seed={seed + 31} />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline label="HEALTH" value={`${data.healthcareCapacity}`}
          seed={seed + 32} />
        <StatWithSparkline label="EARLY WARN." value={`${data.earlyWarningCoverage}%`}
          seed={seed + 33} />
      </div>

      <div className="fdp-divider" />

      {/* Response noise band */}
      <div className="fdp-section-label">RESPONSE SIGNAL</div>
      <div className="fdp-chart-container">
        <NoiseBand
          data={data.aidReceivedTimeSeries}
          width={CW} height={18}
          color={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.3)' : 'rgba(255,255,255,0.25)'}
          seed={seed + 35}
        />
      </div>

      <div className="fdp-divider" />

      {/* Disaster Event Timeline */}
      <div className="fdp-section-label">EVENT TIMELINE</div>
      <div className="fdp-chart-container">
        <SignalDotTimeline
          events={data.majorEvents}
          width={CW} height={44}
          seed={seed + 40}
        />
      </div>

      <div className="fdp-divider" />

      {/* Risk Distribution */}
      <div className="fdp-section-label">RISK DISTRIBUTION</div>
      <div className="fdp-chart-container">
        <SignalHistogram
          data={data.riskDistribution}
          width={CW} height={46}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.45)' : 'rgba(255,255,255,0.35)'}
          seed={seed + 50}
          secondaryData={data.fundingDistribution}
        />
      </div>

      {/* Historical Underfunding area */}
      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-section-label">UNDERFUNDING SIGNAL</div>
          <div className="fdp-chart-container">
            <SignalAreaChart
              data={gapSignal}
              width={CW} height={44}
              color="rgba(255,160,60,0.45)"
              seed={seed + 60}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Panel Container ────────────────────────────────────────────────

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
