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
import InteractiveChartWrapper from '../shared/InteractiveChartWrapper'
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
      <InteractiveChartWrapper
        label="Preparedness Index"
        explanation={`The preparedness index stands at ${data.preparednessScore}% with $${data.fundingPerCapita} in funding per capita. ${data.preparednessScore < 40 ? 'This critically low score signals severe gaps in disaster readiness — infrastructure, early warning, and response systems are significantly underdeveloped.' : data.preparednessScore < 70 ? 'Moderate preparedness indicates partial coverage, but meaningful gaps remain in infrastructure and response capability.' : 'Strong preparedness reflects well-developed systems for disaster detection, response, and recovery.'} Resilience index sits at ${data.resilienceIndex.toFixed(2)}, ${data.fundingTrend === 'improving' ? 'with an improving funding trend.' : data.fundingTrend === 'declining' ? 'compounded by a declining funding trend.' : 'with stable funding levels.'}`}
      >
        <LargePercentReadout
          value={data.preparednessScore}
          label="READINESS"
          subValue={`$${data.fundingPerCapita}/cap`}
          trend={trendDir}
          alert={data.preparednessScore < 40}
        />
      </InteractiveChartWrapper>

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
        <InteractiveChartWrapper
          label="Preparedness / Funding / Risk"
          explanation={`These layered ridges trace preparedness, funding, and risk over time. ${data.riskTrend === 'worsening' ? 'Risk exposure is trending upward, which ' : data.riskTrend === 'improving' ? 'Risk exposure is declining, which ' : 'Risk levels remain relatively stable, which '}${data.fundingTrend === 'improving' ? 'is being met with increasing funding allocation.' : data.fundingTrend === 'declining' ? 'is concerning given declining funding levels.' : 'aligns with current steady funding patterns.'} Divergence between the risk and preparedness ridges indicates where vulnerability is growing faster than capacity.`}
        >
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
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 4: Concentric Radar — multi-metric */}
      <div className="fdp-section-label">RISK EXPOSURE</div>
      <div className="fdp-chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
        <InteractiveChartWrapper
          label="Risk Exposure"
          explanation={`Risk exposure is at ${(data.riskExposure * 100).toFixed(0)}%, resilience at ${(data.resilienceIndex * 100).toFixed(0)}%, preparedness at ${data.preparednessScore}%, and early warning coverage at ${data.earlyWarningCoverage}%. ${data.riskExposure > 0.6 && data.preparednessScore < 50 ? 'The combination of high risk and low preparedness creates a critical vulnerability profile.' : data.riskExposure > 0.4 ? 'Elevated risk exposure warrants continued investment in resilience infrastructure.' : 'Relatively contained risk levels provide a foundation for sustainable preparedness growth.'}`}
        >
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
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 5: Thin Vertical Bars — funding distribution */}
      <div className="fdp-section-label">ALLOCATION DENSITY</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Allocation Density"
          explanation={`This distribution shows how funding allocation is spread across different bands. ${data.disparityLevel === 'Severely Under-Resourced' || data.disparityLevel === 'Under-Resourced' ? 'The concentration pattern suggests resources are not being distributed proportionally to need — key bands are significantly underfunded.' : data.disparityLevel === 'Moderate' ? 'Allocation shows moderate spread with some clustering, indicating partial but incomplete coverage of funding needs.' : 'Distribution appears relatively balanced, reflecting proportional resource allocation across sectors.'}`}
        >
          <ThinVerticalBars
            data={data.fundingDistribution}
            width={W}
            height={48}
            seed={seed + 30}
          />
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 6: Perspective Grid — funding timeline depth */}
      <div className="fdp-section-label">FUNDING STRATA</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Funding Strata"
          explanation={`The perspective grid reveals funding patterns over time with depth. ${data.fundingTrend === 'declining' ? 'A declining pattern from front to back rows indicates funding has been tapering off in recent periods.' : data.fundingTrend === 'improving' ? 'Rising bars in the front rows show funding has been increasing in recent periods.' : 'Relatively consistent bar heights suggest stable funding flows over time.'} Each row represents a time window, with the front showing the most recent allocation levels.`}
        >
          <PerspectiveGrid
            data={data.fundingTimeSeries}
            width={W}
            height={60}
            seed={seed + 40}
            rows={5}
          />
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 8: Segmented Horizontal Bars — infrastructure metrics */}
      <div className="fdp-section-label">INFRASTRUCTURE</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Infrastructure"
          explanation={`Infrastructure scores ${data.infrastructureIndex}/100, healthcare capacity ${data.healthcareCapacity}/100, and early warning coverage ${data.earlyWarningCoverage}%. ${data.infrastructureIndex < 40 || data.healthcareCapacity < 40 ? 'Critically low scores in core capacity metrics indicate systemic weakness that compounds disaster impact.' : data.infrastructureIndex < 70 ? 'Moderate infrastructure capacity leaves gaps that could amplify disaster consequences.' : 'Solid infrastructure and healthcare capacity provide a strong foundation for disaster resilience.'}`}
        >
          <SegmentedHorizontalBars
            bars={[
              { label: 'INFRA', value: data.infrastructureIndex, max: 100 },
              { label: 'HEALTH', value: data.healthcareCapacity, max: 100 },
              { label: 'WARN', value: data.earlyWarningCoverage, max: 100 },
            ]}
            width={W}
            height={42}
          />
        </InteractiveChartWrapper>
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
        <InteractiveChartWrapper
          label="Aid Gap"
          explanation={`The aid gap stands at ${data.aidGapPercent}% — ${data.aidGapPercent > 50 ? 'a severe shortfall where more than half of modeled need goes unmet.' : data.aidGapPercent > 25 ? 'a significant gap indicating substantial unmet humanitarian need.' : 'a contained gap, though any shortfall impacts vulnerable populations.'} Current aid is $${data.aidPerCapita}/capita against a modeled need of $${data.modeledNeedPerCapita}/capita, with an average response delay of ${data.responseDelayDays} days.`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 1: Triangular Area Fill — aid received vs modeled need */}
      <div className="fdp-section-label">AID / NEED DIVERGENCE</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Aid / Need Divergence"
          explanation={`The shaded area between aid received and modeled need reveals the cumulative divergence over time. ${data.aidGapPercent > 50 ? 'A wide and growing gap indicates chronic underfunding — the country consistently receives far less than what disaster models project is needed.' : data.aidGapPercent > 25 ? 'Moderate divergence suggests aid flows are trailing behind actual need, especially during peak disaster periods.' : 'Relatively narrow divergence shows aid allocation is tracking close to modeled need.'} The crosshair marks the point of maximum gap.`}
        >
          <TriangularAreaFill
            dataA={data.aidReceivedTimeSeries}
            dataB={modeledNeedSeries}
            width={W}
            height={80}
            seed={seed + 10}
            accentColor={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.6)' : 'rgba(255,180,60,0.4)'}
          />
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 3: Fan Burst — gap dispersion */}
      <div className="fdp-section-label">GAP DISPERSION</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Gap Dispersion"
          explanation={`These radiating lines map the aid gap across different time periods. ${data.aidGapPercent > 50 ? 'Multiple highlighted rays indicate the gap exceeded critical thresholds repeatedly — a pattern of persistent, systemic underfunding.' : data.aidGapPercent > 25 ? 'Several highlighted periods show where the gap spiked beyond sustainable levels.' : 'Most periods remain below critical gap thresholds, suggesting relatively consistent aid coverage.'} Lines extending further from the center represent larger percentage gaps.`}
        >
          <FanBurst
            values={gapSignal}
            width={W}
            height={64}
            seed={seed + 20}
            accentColor={data.aidGapPercent > 50 ? 'rgba(255,160,60,0.4)' : 'rgba(255,180,60,0.3)'}
          />
        </InteractiveChartWrapper>
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
        <InteractiveChartWrapper
          label="Risk Density"
          explanation={`The silhouette maps risk concentration across categories${data.riskExposure > 0.6 ? ', with pronounced peaks indicating severe risk clustering in specific areas' : ', showing a relatively distributed risk profile'}. The faint secondary overlay shows funding distribution — ${data.aidGapPercent > 40 ? 'notable misalignment between the two curves reveals where resources are not matching actual risk levels.' : 'reasonable alignment suggests funding is broadly tracking risk patterns.'}`}
        >
          <MountainSilhouette
            data={data.riskDistribution}
            width={W}
            height={48}
            seed={seed + 30}
            color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.12)' : 'rgba(255,255,255,0.1)'}
            secondaryData={data.fundingDistribution}
          />
        </InteractiveChartWrapper>
      </div>

      <div className="fdp-divider" />

      {/* ARCHETYPE 11: Dot-Bar Strip — major events */}
      <div className="fdp-section-label">EVENT TIMELINE</div>
      <div className="fdp-chart-container">
        <InteractiveChartWrapper
          label="Event Timeline"
          explanation={`This timeline charts major disaster events from 2013 to 2024, with bar height reflecting severity. ${data.majorEvents.length > 5 ? `With ${data.majorEvents.length} recorded events, this country faces frequent disaster exposure that compounds long-term vulnerability.` : data.majorEvents.length > 2 ? `${data.majorEvents.length} significant events over this period indicate recurring but not constant disaster exposure.` : 'Relatively few major events recorded, though each event\'s impact must be assessed in context of overall preparedness.'}`}
        >
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
        </InteractiveChartWrapper>
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
