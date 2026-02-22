/**
 * FundingDisparityPanels — Partial telemetry readout system.
 *
 * These panels expose fragments of a complex monitoring system.
 * Every visualization is a particle field, density plot, or dispersion view.
 * No charts. No line graphs. No analytics dashboards.
 *
 * "This system knows more than it is showing."
 */

import { useMemo } from 'react'
import { getCountryFundingDetail, type CountryFundingDetail } from '../../data/fundingDisparityDetails'
import {
  DensityField,
  DispersionField,
  EventScatter,
  DensityDistribution,
  SignalDust,
  StratifiedField,
  StatWithField,
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

  const fundingNorm = data.fundingTimeSeries.map(v => v / (data.fundingPerCapita || 1) * 50 + 30)
  const resilienceSignal = data.preparednessTimeSeries.map((v, i) =>
    v * 0.6 + fundingNorm[i] * 0.4
  )

  return (
    <div className="fdp-panel fdp-panel-left">
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

      <div className="fdp-section-label">FUNDING OVERVIEW</div>
      <div className="fdp-stat-grid">
        <StatWithField label="PREP" value={`${data.preparednessScore}`} unit="%"
          fieldData={data.preparednessTimeSeries} seed={seed + 1} />
        <StatWithField label="RESIL" value={data.resilienceIndex.toFixed(2)}
          fieldData={resilienceSignal} seed={seed + 2} />
        <StatWithField label="$/CAP" value={`${data.fundingPerCapita}`}
          fieldData={data.fundingTimeSeries} seed={seed + 3} />
        <StatWithField label="GDP" value={`${data.gdpBillions}B`} seed={seed + 4} />
      </div>

      <div className="fdp-divider" />

      {/* PREPAREDNESS / FUNDING — overlapping density field */}
      <div className="fdp-section-label">
        PREPAREDNESS / FUNDING
        <TrendIndicator trend={data.fundingTrend} />
      </div>
      <div className="fdp-chart-container">
        <DensityField
          signals={[data.preparednessTimeSeries, fundingNorm, resilienceSignal]}
          width={W} height={88}
          colors={['rgba(255,255,255,0.45)', 'rgba(255,180,60,0.35)', 'rgba(255,255,255,0.18)']}
          seed={seed + 10}
          particlesPerSignal={220}
          dispersion={0.14}
          showGuide
        />
      </div>

      <div className="fdp-divider" />

      {/* RISK EXPOSURE — dispersion field */}
      <div className="fdp-section-label">
        RISK EXPOSURE
        <TrendIndicator trend={data.riskTrend} />
      </div>
      <div className="fdp-chart-container">
        <DispersionField
          data={data.riskTimeSeries}
          width={W} height={72}
          seed={seed + 20}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.45)' : 'rgba(255,255,255,0.35)'}
          count={300}
          layers={4}
          secondaryData={data.preparednessTimeSeries.map(v => v * 0.8)}
        />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithField label="EXPOSURE" value={data.riskExposure.toFixed(2)}
          fieldData={data.riskTimeSeries} alert={data.riskExposure > 0.6} seed={seed + 21} />
        <StatWithField label="POP" value={`${data.populationMillions}M`} seed={seed + 22} />
      </div>

      <div className="fdp-divider" />

      {/* FUNDING DISTRIBUTION — density distribution */}
      <div className="fdp-section-label">ALLOCATION DENSITY</div>
      <div className="fdp-chart-container">
        <DensityDistribution
          data={data.fundingDistribution}
          width={W} height={52}
          color="rgba(255,255,255,0.35)"
          seed={seed + 30}
          secondaryData={data.riskDistribution}
          count={240}
        />
      </div>

      <div className="fdp-divider" />

      {/* PREPAREDNESS SIGNAL DUST */}
      <div className="fdp-section-label">READINESS SIGNAL</div>
      <div className="fdp-chart-container">
        <SignalDust
          data={data.preparednessTimeSeries}
          width={W} height={24}
          color="rgba(255,255,255,0.25)"
          seed={seed + 40}
          count={120}
        />
      </div>

      <div className="fdp-divider" />

      {/* HISTORICAL FUNDING — stratified field */}
      <div className="fdp-section-label">FUNDING STRATA</div>
      <div className="fdp-chart-container">
        <StratifiedField
          bands={[
            { data: data.fundingTimeSeries, color: 'rgba(255,255,255,0.35)', yOffset: 0.3 },
            { data: data.riskTimeSeries, color: 'rgba(255,160,60,0.3)', yOffset: 0.6 },
            { data: resilienceSignal, color: 'rgba(255,255,255,0.2)', yOffset: 0.8 },
          ]}
          width={W} height={56}
          seed={seed + 50}
          countPerBand={90}
        />
      </div>

      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-stat-grid fdp-stat-grid-2">
            <StatWithField label="CUM. GAP" value={`$${data.cumulativeUnderfunding}B`}
              alert seed={seed + 55} />
            <StatWithField label="YRS" value={`${data.yearsUnderfunded}`}
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

  const modeledNeedSeries = data.aidReceivedTimeSeries.map((_, i) =>
    data.modeledNeedPerCapita * (0.85 + (i / 12) * 0.3)
  )
  const gapSignal = data.aidReceivedTimeSeries.map((v, i) => {
    const need = modeledNeedSeries[i]
    return Math.max(0, ((need - v) / (need || 1)) * 100)
  })

  return (
    <div className="fdp-panel fdp-panel-right">
      <div className="fdp-section-label">AID ALLOCATION</div>
      <div className="fdp-stat-grid">
        <StatWithField label="AID" value={`$${data.aidPerCapita}`}
          fieldData={data.aidReceivedTimeSeries} alert={data.aidGapPercent > 50} seed={seed + 1} />
        <StatWithField label="NEED" value={`$${data.modeledNeedPerCapita}`}
          fieldData={modeledNeedSeries} seed={seed + 2} />
        <StatWithField label="GAP" value={`${data.aidGapPercent}%`}
          fieldData={gapSignal} alert={data.aidGapPercent > 40} seed={seed + 3} />
        <StatWithField label="DELAY" value={`${data.responseDelayDays}d`}
          alert={data.responseDelayDays > 7} seed={seed + 4} />
      </div>

      <div className="fdp-divider" />

      {/* AID / NEED — overlapping density field */}
      <div className="fdp-section-label">AID / NEED TELEMETRY</div>
      <div className="fdp-chart-container">
        <DensityField
          signals={[data.aidReceivedTimeSeries, modeledNeedSeries, gapSignal.map(v => v * 0.5)]}
          width={W} height={85}
          colors={['rgba(255,255,255,0.45)', 'rgba(255,100,80,0.35)', 'rgba(255,180,60,0.15)']}
          seed={seed + 10}
          particlesPerSignal={200}
          dispersion={0.16}
          showGuide
        />
      </div>

      <div className="fdp-divider" />

      {/* GAP DISPERSION — pure particle dispersion */}
      <div className="fdp-section-label">GAP DISPERSION</div>
      <div className="fdp-chart-container">
        <DispersionField
          data={gapSignal}
          width={W} height={68}
          seed={seed + 20}
          color={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.45)' : 'rgba(255,255,255,0.35)'}
          count={320}
          layers={4}
          secondaryData={data.aidReceivedTimeSeries}
        />
      </div>

      <div className="fdp-divider" />

      {/* RESPONSE METRICS */}
      <div className="fdp-section-label">RESPONSE</div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithField label="TIME" value={`${data.avgResponseTimeHours}h`}
          alert={data.avgResponseTimeHours > 72} seed={seed + 30} />
        <StatWithField label="INFRA" value={`${data.infrastructureIndex}`}
          seed={seed + 31} />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithField label="HEALTH" value={`${data.healthcareCapacity}`}
          seed={seed + 32} />
        <StatWithField label="WARN" value={`${data.earlyWarningCoverage}%`}
          seed={seed + 33} />
      </div>

      <div className="fdp-divider" />

      {/* RESPONSE SIGNAL DUST */}
      <div className="fdp-section-label">RESPONSE DUST</div>
      <div className="fdp-chart-container">
        <SignalDust
          data={data.aidReceivedTimeSeries}
          width={W} height={22}
          color={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.25)' : 'rgba(255,255,255,0.2)'}
          seed={seed + 35}
          count={130}
        />
      </div>

      <div className="fdp-divider" />

      {/* EVENT SCATTER — events as density clusters */}
      <div className="fdp-section-label">EVENT FIELD</div>
      <div className="fdp-chart-container">
        <EventScatter
          events={data.majorEvents}
          width={W} height={52}
          seed={seed + 40}
        />
      </div>

      <div className="fdp-divider" />

      {/* RISK DENSITY DISTRIBUTION */}
      <div className="fdp-section-label">RISK DENSITY</div>
      <div className="fdp-chart-container">
        <DensityDistribution
          data={data.riskDistribution}
          width={W} height={48}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.4)' : 'rgba(255,255,255,0.3)'}
          seed={seed + 50}
          secondaryData={data.fundingDistribution}
          count={220}
        />
      </div>

      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-section-label">UNDERFUNDING</div>
          <div className="fdp-chart-container">
            <DispersionField
              data={gapSignal}
              width={W} height={40}
              seed={seed + 60}
              color="rgba(255,160,60,0.4)"
              count={180}
              layers={3}
            />
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
