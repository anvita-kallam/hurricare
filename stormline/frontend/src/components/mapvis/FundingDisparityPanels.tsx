/**
 * FundingDisparityPanels — Intelligence overlay panels for Funding Disparity mode.
 *
 * Architecture:
 *   Globe = visualization layer (untouched)
 *   Panels = intelligence layer (this file)
 *
 * Panels appear left and right of the globe when a country is selected.
 * All charts are custom SVG, matching the reference image exactly.
 */

import { useMemo } from 'react'
import { getCountryFundingDetail, type CountryFundingDetail } from '../../data/fundingDisparityDetails'
import {
  MiniLineChart,
  MiniAreaChart,
  MiniDotTimeline,
  MiniHistogram,
  MiniSparkline,
  StatWithSparkline,
  TrendIndicator,
} from './charts/ChartPrimitives'

// ─── Left Panel ──────────────────────────────────────────────────────────

function LeftPanel({ data }: { data: CountryFundingDetail }) {
  const yearLabels = ['\'13', '\'16', '\'19', '\'22', '\'24']

  return (
    <div className="fdp-panel fdp-panel-left">
      {/* Header */}
      <div className="fdp-panel-header">
        <div className="fdp-country-name">{data.name}</div>
        <div
          className="fdp-disparity-badge"
          style={{
            color:
              data.disparityLevel === 'Well-Funded' ? 'rgba(120,220,120,0.8)' :
              data.disparityLevel === 'Moderate' ? 'rgba(255,220,100,0.8)' :
              data.disparityLevel === 'Under-Resourced' ? 'rgba(255,160,60,0.8)' :
              'rgba(255,100,80,0.8)',
          }}
        >
          {data.disparityLevel.toUpperCase()}
        </div>
      </div>

      <div className="fdp-divider" />

      {/* Section: Funding Overview */}
      <div className="fdp-section-label">FUNDING OVERVIEW</div>
      <div className="fdp-stat-grid">
        <StatWithSparkline
          label="PREPAREDNESS SCORE"
          value={`${data.preparednessScore}`}
          unit="%"
          sparkData={data.preparednessTimeSeries}
        />
        <StatWithSparkline
          label="RESILIENCE INDEX"
          value={data.resilienceIndex.toFixed(2)}
          sparkData={data.fundingTimeSeries.map((v) => v / (data.fundingPerCapita || 1))}
        />
        <StatWithSparkline
          label="FUNDING PER CAPITA"
          value={`$${data.fundingPerCapita}`}
          sparkData={data.fundingTimeSeries}
        />
        <StatWithSparkline
          label="GDP (B)"
          value={`$${data.gdpBillions}`}
          unit="B"
        />
      </div>

      <div className="fdp-divider" />

      {/* Section: Preparedness vs Funding Trend */}
      <div className="fdp-section-label">
        PREPAREDNESS VS FUNDING TREND
        <TrendIndicator trend={data.fundingTrend} />
      </div>
      <div className="fdp-chart-container">
        <MiniLineChart
          series={[data.preparednessTimeSeries, data.fundingTimeSeries.map(v => v / (data.fundingPerCapita || 1) * 50 + 30)]}
          width={280}
          height={80}
          colors={['rgba(255,255,255,0.6)', 'rgba(255,180,60,0.5)']}
          labels={yearLabels}
        />
        <div className="fdp-chart-legend">
          <span className="fdp-legend-item">
            <span className="fdp-legend-line" style={{ background: 'rgba(255,255,255,0.6)' }} />
            Preparedness
          </span>
          <span className="fdp-legend-item">
            <span className="fdp-legend-line" style={{ background: 'rgba(255,180,60,0.5)' }} />
            Funding idx
          </span>
        </div>
      </div>

      <div className="fdp-divider" />

      {/* Section: Risk Exposure */}
      <div className="fdp-section-label">
        RISK EXPOSURE
        <TrendIndicator trend={data.riskTrend} />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline
          label="EXPOSURE INDEX"
          value={data.riskExposure.toFixed(2)}
          sparkData={data.riskTimeSeries}
          alert={data.riskExposure > 0.6}
        />
        <StatWithSparkline
          label="POPULATION"
          value={`${data.populationMillions}M`}
        />
      </div>
      <div className="fdp-chart-container">
        <MiniAreaChart
          data={data.riskTimeSeries}
          width={280}
          height={56}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.6)' : 'rgba(255,255,255,0.4)'}
          fillOpacity={0.1}
        />
      </div>

      <div className="fdp-divider" />

      {/* Section: Funding Distribution */}
      <div className="fdp-section-label">FUNDING DISTRIBUTION</div>
      <div className="fdp-chart-container">
        <MiniHistogram
          data={data.fundingDistribution}
          width={280}
          height={44}
          color="rgba(255,255,255,0.4)"
        />
      </div>
    </div>
  )
}

// ─── Right Panel ─────────────────────────────────────────────────────────

function RightPanel({ data }: { data: CountryFundingDetail }) {
  return (
    <div className="fdp-panel fdp-panel-right">
      {/* Section: Aid Allocation */}
      <div className="fdp-section-label">AID ALLOCATION ANALYSIS</div>
      <div className="fdp-stat-grid">
        <StatWithSparkline
          label="AID PER CAPITA"
          value={`$${data.aidPerCapita}`}
          sparkData={data.aidReceivedTimeSeries}
          alert={data.aidGapPercent > 50}
        />
        <StatWithSparkline
          label="MODELED NEED"
          value={`$${data.modeledNeedPerCapita}`}
          unit="/cap"
        />
        <StatWithSparkline
          label="AID GAP"
          value={`${data.aidGapPercent}`}
          unit="%"
          alert={data.aidGapPercent > 40}
          sparkData={data.aidReceivedTimeSeries.map((v, i) => {
            const need = data.modeledNeedPerCapita
            return Math.max(0, ((need - v) / (need || 1)) * 100)
          })}
          sparkColor="rgba(255,160,60,0.4)"
        />
        <StatWithSparkline
          label="RESPONSE DELAY"
          value={`${data.responseDelayDays}`}
          unit="d"
          alert={data.responseDelayDays > 7}
        />
      </div>

      <div className="fdp-divider" />

      {/* Section: Aid Received vs Modeled Need */}
      <div className="fdp-section-label">AID RECEIVED VS MODELED NEED</div>
      <div className="fdp-chart-container">
        <MiniLineChart
          series={[
            data.aidReceivedTimeSeries,
            data.aidReceivedTimeSeries.map((_, i) =>
              data.modeledNeedPerCapita * (0.85 + (i / 12) * 0.3)
            ),
          ]}
          width={280}
          height={72}
          colors={['rgba(255,255,255,0.6)', 'rgba(255,100,80,0.45)']}
          showDots={false}
          labels={['\'13', '\'16', '\'19', '\'22', '\'24']}
        />
        <div className="fdp-chart-legend">
          <span className="fdp-legend-item">
            <span className="fdp-legend-line" style={{ background: 'rgba(255,255,255,0.6)' }} />
            Received
          </span>
          <span className="fdp-legend-item">
            <span className="fdp-legend-line" style={{ background: 'rgba(255,100,80,0.45)' }} />
            Need
          </span>
        </div>
      </div>

      <div className="fdp-divider" />

      {/* Section: Response Metrics */}
      <div className="fdp-section-label">RESPONSE METRICS</div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline
          label="AVG RESPONSE TIME"
          value={`${data.avgResponseTimeHours}`}
          unit="h"
          alert={data.avgResponseTimeHours > 72}
        />
        <StatWithSparkline
          label="INFRASTRUCTURE"
          value={`${data.infrastructureIndex}`}
          unit="/100"
        />
      </div>
      <div className="fdp-stat-grid fdp-stat-grid-2">
        <StatWithSparkline
          label="HEALTHCARE CAP."
          value={`${data.healthcareCapacity}`}
          unit="/100"
        />
        <StatWithSparkline
          label="EARLY WARNING"
          value={`${data.earlyWarningCoverage}`}
          unit="%"
        />
      </div>

      <div className="fdp-divider" />

      {/* Section: Disaster Event Timeline */}
      <div className="fdp-section-label">DISASTER EVENT TIMELINE</div>
      <div className="fdp-chart-container">
        <MiniDotTimeline
          events={data.majorEvents}
          width={280}
          height={40}
        />
      </div>

      <div className="fdp-divider" />

      {/* Section: Risk Distribution */}
      <div className="fdp-section-label">RISK DISTRIBUTION</div>
      <div className="fdp-chart-container">
        <MiniHistogram
          data={data.riskDistribution}
          width={280}
          height={44}
          color={data.riskExposure > 0.6 ? 'rgba(255,160,60,0.5)' : 'rgba(255,255,255,0.4)'}
        />
      </div>

      {/* Section: Historical Underfunding */}
      {data.yearsUnderfunded > 0 && (
        <>
          <div className="fdp-divider" />
          <div className="fdp-section-label">HISTORICAL UNDERFUNDING</div>
          <div className="fdp-stat-grid fdp-stat-grid-2">
            <div className="fdp-stat">
              <div className="fdp-stat-label">CUMULATIVE GAP</div>
              <div className="fdp-stat-row">
                <span className="fdp-stat-value" style={{ color: 'rgba(255,160,60,0.9)' }}>
                  ${data.cumulativeUnderfunding}B
                </span>
              </div>
            </div>
            <div className="fdp-stat">
              <div className="fdp-stat-label">YEARS UNDERFUNDED</div>
              <div className="fdp-stat-row">
                <span className="fdp-stat-value" style={{ color: 'rgba(255,160,60,0.9)' }}>
                  {data.yearsUnderfunded}
                </span>
              </div>
            </div>
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
