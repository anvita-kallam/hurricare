/**
 * Detailed funding disparity data generator.
 * Produces deterministic, realistic data for each country based on its disparity index.
 * All numbers are seeded from country name hash + disparity value — no randomness.
 */

import { getFundingDisparity } from './fundingDisparity'

// Deterministic hash from string
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// Seeded pseudo-random (deterministic)
function seeded(seed: number, offset: number = 0): number {
  const x = Math.sin(seed + offset * 2654435761) * 10000
  return x - Math.floor(x)
}

// Generate time series data (12 points = 12 years, 2013-2024)
function generateTimeSeries(
  seed: number,
  baseValue: number,
  volatility: number,
  trend: number,
  points: number = 12
): number[] {
  const result: number[] = []
  let val = baseValue
  for (let i = 0; i < points; i++) {
    const noise = (seeded(seed, i) - 0.5) * volatility
    val = val + trend + noise
    result.push(Math.max(0, val))
  }
  return result
}

// GDP data approximations (billions USD) keyed by rough disparity ranges
function estimateGDP(disparity: number, seed: number): number {
  if (disparity < 0.15) return 800 + seeded(seed, 10) * 15000
  if (disparity < 0.3) return 200 + seeded(seed, 10) * 2000
  if (disparity < 0.5) return 50 + seeded(seed, 10) * 500
  if (disparity < 0.7) return 10 + seeded(seed, 10) * 100
  return 2 + seeded(seed, 10) * 30
}

function estimatePopulation(disparity: number, seed: number): number {
  const base = 5 + seeded(seed, 20) * 200
  return Math.round(base * 1_000_000)
}

export interface CountryFundingDetail {
  name: string
  disparity: number
  disparityLevel: 'Well-Funded' | 'Moderate' | 'Under-Resourced' | 'Severely Under-Resourced'

  // Overview stats
  gdpBillions: number
  populationMillions: number
  preparednessScore: number
  resilienceIndex: number
  fundingPerCapita: number
  riskExposure: number

  // Time series (12 years: 2013-2024)
  preparednessTimeSeries: number[]
  fundingTimeSeries: number[]
  riskTimeSeries: number[]
  aidReceivedTimeSeries: number[]

  // Aid allocation
  aidPerCapita: number
  modeledNeedPerCapita: number
  aidGapPercent: number
  responseDelayDays: number

  // Response metrics
  avgResponseTimeHours: number
  infrastructureIndex: number
  healthcareCapacity: number
  earlyWarningCoverage: number

  // Distribution data (10 bins)
  fundingDistribution: number[]
  riskDistribution: number[]

  // Dot timeline (major events, up to 8)
  majorEvents: { year: number; severity: number }[]

  // Trend indicators
  fundingTrend: 'improving' | 'stable' | 'declining'
  riskTrend: 'improving' | 'stable' | 'worsening'

  // Historical underfunding
  cumulativeUnderfunding: number // billions USD
  yearsUnderfunded: number
}

export function getCountryFundingDetail(countryName: string): CountryFundingDetail {
  const disparity = getFundingDisparity(countryName)
  const seed = hashStr(countryName)
  const inv = 1 - disparity

  const disparityLevel: CountryFundingDetail['disparityLevel'] =
    disparity < 0.25 ? 'Well-Funded' :
    disparity < 0.5 ? 'Moderate' :
    disparity < 0.75 ? 'Under-Resourced' :
    'Severely Under-Resourced'

  const gdpBillions = Math.round(estimateGDP(disparity, seed) * 10) / 10
  const pop = estimatePopulation(disparity, seed)
  const populationMillions = Math.round(pop / 1_000_000 * 10) / 10

  const preparednessScore = Math.round(inv * 85 + seeded(seed, 1) * 15)
  const resilienceIndex = Math.round((inv * 0.78 + seeded(seed, 2) * 0.22) * 100) / 100
  const fundingPerCapita = Math.round(inv * 420 + seeded(seed, 3) * 80)
  const riskExposure = Math.round((disparity * 0.7 + seeded(seed, 4) * 0.3) * 100) / 100

  // Time series generation
  const preparednessTimeSeries = generateTimeSeries(
    seed + 100, preparednessScore - 10, 5, inv * 0.8 - disparity * 0.3
  )
  const fundingTimeSeries = generateTimeSeries(
    seed + 200, fundingPerCapita * 0.7, fundingPerCapita * 0.12, inv * 5 - disparity * 2
  )
  const riskTimeSeries = generateTimeSeries(
    seed + 300, riskExposure * 80, 8, disparity * 0.5 - inv * 0.2
  )
  const aidReceivedTimeSeries = generateTimeSeries(
    seed + 400, disparity > 0.4 ? 20 + disparity * 60 : 5, 8, disparity * 0.3
  )

  // Aid allocation
  const aidPerCapita = disparity > 0.3
    ? Math.round((15 + seeded(seed, 5) * 50) * disparity)
    : Math.round(2 + seeded(seed, 5) * 8)
  const modeledNeedPerCapita = Math.round(aidPerCapita / (inv * 0.6 + 0.1))
  const aidGapPercent = Math.round(Math.max(0, (1 - aidPerCapita / modeledNeedPerCapita) * 100))
  const responseDelayDays = Math.round(disparity * 14 + seeded(seed, 6) * 5)

  // Response metrics
  const avgResponseTimeHours = Math.round((disparity * 168 + seeded(seed, 7) * 48))
  const infrastructureIndex = Math.round(inv * 90 + seeded(seed, 8) * 10)
  const healthcareCapacity = Math.round(inv * 85 + seeded(seed, 9) * 15)
  const earlyWarningCoverage = Math.round(inv * 88 + seeded(seed, 11) * 12)

  // Distribution data (10 bins)
  const fundingDistribution = Array.from({ length: 10 }, (_, i) => {
    const center = inv * 7
    const dist = Math.abs(i - center)
    return Math.max(0, 1 - dist * 0.2 + seeded(seed, 30 + i) * 0.3)
  })

  const riskDistribution = Array.from({ length: 10 }, (_, i) => {
    const center = disparity * 8
    const dist = Math.abs(i - center)
    return Math.max(0, 1 - dist * 0.18 + seeded(seed, 40 + i) * 0.25)
  })

  // Major events
  const numEvents = Math.min(8, 2 + Math.floor(disparity * 6 + seeded(seed, 50)))
  const majorEvents: { year: number; severity: number }[] = []
  for (let i = 0; i < numEvents; i++) {
    majorEvents.push({
      year: 2013 + Math.floor(seeded(seed, 60 + i) * 11),
      severity: 0.3 + seeded(seed, 70 + i) * 0.7
    })
  }
  majorEvents.sort((a, b) => a.year - b.year)

  // Trends
  const fundingSlope = fundingTimeSeries[11] - fundingTimeSeries[0]
  const fundingTrend: CountryFundingDetail['fundingTrend'] =
    fundingSlope > fundingTimeSeries[0] * 0.1 ? 'improving' :
    fundingSlope < -fundingTimeSeries[0] * 0.1 ? 'declining' : 'stable'

  const riskSlope = riskTimeSeries[11] - riskTimeSeries[0]
  const riskTrend: CountryFundingDetail['riskTrend'] =
    riskSlope < -5 ? 'improving' :
    riskSlope > 5 ? 'worsening' : 'stable'

  // Historical underfunding
  const cumulativeUnderfunding = Math.round(disparity * gdpBillions * 0.02 * 10 * 100) / 100
  const yearsUnderfunded = disparity > 0.3 ? Math.round(5 + disparity * 15) : 0

  return {
    name: countryName,
    disparity,
    disparityLevel,
    gdpBillions,
    populationMillions,
    preparednessScore,
    resilienceIndex,
    fundingPerCapita,
    riskExposure,
    preparednessTimeSeries,
    fundingTimeSeries,
    riskTimeSeries,
    aidReceivedTimeSeries,
    aidPerCapita,
    modeledNeedPerCapita,
    aidGapPercent,
    responseDelayDays,
    avgResponseTimeHours,
    infrastructureIndex,
    healthcareCapacity,
    earlyWarningCoverage,
    fundingDistribution,
    riskDistribution,
    majorEvents,
    fundingTrend,
    riskTrend,
    cumulativeUnderfunding,
    yearsUnderfunded,
  }
}
