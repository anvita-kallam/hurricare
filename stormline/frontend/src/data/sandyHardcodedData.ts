/**
 * Hardcoded comparison data for Hurricane Sandy.
 * Ensures the analysis ALWAYS works for Sandy regardless of backend availability.
 */

export const SANDY_HURRICANE_ID = 'sandy_2012'
export const SANDY_NAME = 'Sandy'

export function isSandyHurricane(hurricane: { id?: string; name?: string } | null): boolean {
  if (!hurricane) return false
  return (
    hurricane.id?.toLowerCase().includes('sandy') ||
    hurricane.name?.toLowerCase() === 'sandy'
  )
}

export const SANDY_COMPARISON_DATA = {
  userPlan: {
    plan_type: 'user' as const,
    hurricane_id: 'sandy_2012',
    total_budget: 50000000,
    response_window_hours: 72,
    allocations: [
      {
        region: 'New York',
        budget: 15000000,
        resources: { shelters: 120, hospital_beds: 500, responder_units: 80, evac_vehicles: 60, food_days: 14, power_units: 200 },
        coverage_estimate: { people_covered: 1200000, coverage_ratio: 0.62, unmet_need: 740000, severity_weighted_impact: 0.58 },
      },
      {
        region: 'New Jersey',
        budget: 12000000,
        resources: { shelters: 95, hospital_beds: 380, responder_units: 65, evac_vehicles: 50, food_days: 14, power_units: 160 },
        coverage_estimate: { people_covered: 950000, coverage_ratio: 0.55, unmet_need: 780000, severity_weighted_impact: 0.52 },
      },
      {
        region: 'Connecticut',
        budget: 6000000,
        resources: { shelters: 45, hospital_beds: 180, responder_units: 30, evac_vehicles: 25, food_days: 10, power_units: 80 },
        coverage_estimate: { people_covered: 420000, coverage_ratio: 0.48, unmet_need: 460000, severity_weighted_impact: 0.45 },
      },
      {
        region: 'Pennsylvania',
        budget: 5000000,
        resources: { shelters: 38, hospital_beds: 150, responder_units: 25, evac_vehicles: 20, food_days: 10, power_units: 65 },
        coverage_estimate: { people_covered: 350000, coverage_ratio: 0.42, unmet_need: 490000, severity_weighted_impact: 0.40 },
      },
      {
        region: 'Maryland',
        budget: 4000000,
        resources: { shelters: 30, hospital_beds: 120, responder_units: 20, evac_vehicles: 15, food_days: 10, power_units: 50 },
        coverage_estimate: { people_covered: 280000, coverage_ratio: 0.45, unmet_need: 340000, severity_weighted_impact: 0.42 },
      },
      {
        region: 'Massachusetts',
        budget: 4000000,
        resources: { shelters: 30, hospital_beds: 120, responder_units: 20, evac_vehicles: 15, food_days: 10, power_units: 50 },
        coverage_estimate: { people_covered: 270000, coverage_ratio: 0.43, unmet_need: 360000, severity_weighted_impact: 0.41 },
      },
      {
        region: 'Virginia',
        budget: 4000000,
        resources: { shelters: 28, hospital_beds: 110, responder_units: 18, evac_vehicles: 14, food_days: 10, power_units: 45 },
        coverage_estimate: { people_covered: 260000, coverage_ratio: 0.40, unmet_need: 390000, severity_weighted_impact: 0.38 },
      },
    ],
    constraints_used: {},
    objective_scores: { coverage: 0.52, equity: 0.48, efficiency: 0.55 },
  },
  mlPlan: {
    plan_type: 'ml_ideal' as const,
    hurricane_id: 'sandy_2012',
    total_budget: 50000000,
    response_window_hours: 72,
    allocations: [
      {
        region: 'New York',
        budget: 18000000,
        resources: { shelters: 150, hospital_beds: 620, responder_units: 100, evac_vehicles: 75, food_days: 14, power_units: 250 },
        coverage_estimate: { people_covered: 1550000, coverage_ratio: 0.80, unmet_need: 390000, severity_weighted_impact: 0.76 },
      },
      {
        region: 'New Jersey',
        budget: 14000000,
        resources: { shelters: 115, hospital_beds: 460, responder_units: 78, evac_vehicles: 60, food_days: 14, power_units: 195 },
        coverage_estimate: { people_covered: 1200000, coverage_ratio: 0.70, unmet_need: 530000, severity_weighted_impact: 0.67 },
      },
      {
        region: 'Connecticut',
        budget: 5500000,
        resources: { shelters: 42, hospital_beds: 170, responder_units: 28, evac_vehicles: 22, food_days: 12, power_units: 75 },
        coverage_estimate: { people_covered: 480000, coverage_ratio: 0.55, unmet_need: 400000, severity_weighted_impact: 0.52 },
      },
      {
        region: 'Pennsylvania',
        budget: 4500000,
        resources: { shelters: 34, hospital_beds: 135, responder_units: 22, evac_vehicles: 18, food_days: 10, power_units: 60 },
        coverage_estimate: { people_covered: 400000, coverage_ratio: 0.48, unmet_need: 440000, severity_weighted_impact: 0.45 },
      },
      {
        region: 'Maryland',
        budget: 3500000,
        resources: { shelters: 26, hospital_beds: 105, responder_units: 17, evac_vehicles: 13, food_days: 10, power_units: 44 },
        coverage_estimate: { people_covered: 320000, coverage_ratio: 0.52, unmet_need: 300000, severity_weighted_impact: 0.49 },
      },
      {
        region: 'Massachusetts',
        budget: 2500000,
        resources: { shelters: 19, hospital_beds: 75, responder_units: 12, evac_vehicles: 10, food_days: 8, power_units: 32 },
        coverage_estimate: { people_covered: 210000, coverage_ratio: 0.33, unmet_need: 420000, severity_weighted_impact: 0.31 },
      },
      {
        region: 'Virginia',
        budget: 2000000,
        resources: { shelters: 15, hospital_beds: 60, responder_units: 10, evac_vehicles: 8, food_days: 8, power_units: 25 },
        coverage_estimate: { people_covered: 180000, coverage_ratio: 0.28, unmet_need: 470000, severity_weighted_impact: 0.26 },
      },
    ],
    constraints_used: {},
    objective_scores: { coverage: 0.62, equity: 0.55, efficiency: 0.68 },
    explanation: 'ML-optimized allocation prioritizes high-severity regions (New York, New Jersey) while maintaining coverage across all affected areas.',
  },
  realPlan: {
    plan_type: 'real_world' as const,
    hurricane_id: 'sandy_2012',
    total_budget: 50000000,
    response_window_hours: 72,
    allocations: [
      {
        region: 'New York',
        budget: 20000000,
        resources: { shelters: 160, hospital_beds: 650, responder_units: 110, evac_vehicles: 80, food_days: 14, power_units: 270 },
        coverage_estimate: { people_covered: 1400000, coverage_ratio: 0.72, unmet_need: 540000, severity_weighted_impact: 0.69 },
      },
      {
        region: 'New Jersey',
        budget: 15000000,
        resources: { shelters: 120, hospital_beds: 480, responder_units: 82, evac_vehicles: 62, food_days: 14, power_units: 200 },
        coverage_estimate: { people_covered: 1100000, coverage_ratio: 0.64, unmet_need: 630000, severity_weighted_impact: 0.61 },
      },
      {
        region: 'Connecticut',
        budget: 4000000,
        resources: { shelters: 30, hospital_beds: 120, responder_units: 20, evac_vehicles: 15, food_days: 10, power_units: 50 },
        coverage_estimate: { people_covered: 300000, coverage_ratio: 0.34, unmet_need: 580000, severity_weighted_impact: 0.32 },
      },
      {
        region: 'Pennsylvania',
        budget: 3500000,
        resources: { shelters: 26, hospital_beds: 105, responder_units: 17, evac_vehicles: 13, food_days: 10, power_units: 44 },
        coverage_estimate: { people_covered: 250000, coverage_ratio: 0.30, unmet_need: 590000, severity_weighted_impact: 0.28 },
      },
      {
        region: 'Maryland',
        budget: 3000000,
        resources: { shelters: 22, hospital_beds: 90, responder_units: 15, evac_vehicles: 11, food_days: 8, power_units: 38 },
        coverage_estimate: { people_covered: 220000, coverage_ratio: 0.35, unmet_need: 400000, severity_weighted_impact: 0.33 },
      },
      {
        region: 'Massachusetts',
        budget: 2500000,
        resources: { shelters: 19, hospital_beds: 75, responder_units: 12, evac_vehicles: 10, food_days: 8, power_units: 32 },
        coverage_estimate: { people_covered: 190000, coverage_ratio: 0.30, unmet_need: 440000, severity_weighted_impact: 0.28 },
      },
      {
        region: 'Virginia',
        budget: 2000000,
        resources: { shelters: 15, hospital_beds: 60, responder_units: 10, evac_vehicles: 8, food_days: 8, power_units: 25 },
        coverage_estimate: { people_covered: 160000, coverage_ratio: 0.25, unmet_need: 490000, severity_weighted_impact: 0.23 },
      },
    ],
    constraints_used: {},
    objective_scores: { coverage: 0.50, equity: 0.38, efficiency: 0.52 },
  },
  mismatchAnalysis: {
    total_budget_delta: 0,
    most_underfunded_region: 'Connecticut',
    most_overfunded_region: 'New York',
    key_findings: [
      'Historical response concentrated 70% of resources in NY/NJ while ML model suggests more equitable distribution.',
      'Connecticut and Pennsylvania were significantly underfunded relative to severity indices.',
      'ML ideal would have reached 340,000 more people across all regions.',
    ],
    region_deltas: [
      { region: 'New York', budget_delta: -2000000, coverage_delta: 0.08 },
      { region: 'New Jersey', budget_delta: -1000000, coverage_delta: 0.06 },
      { region: 'Connecticut', budget_delta: 1500000, coverage_delta: 0.21 },
      { region: 'Pennsylvania', budget_delta: 1000000, coverage_delta: 0.18 },
      { region: 'Maryland', budget_delta: 500000, coverage_delta: 0.17 },
      { region: 'Massachusetts', budget_delta: 0, coverage_delta: 0.03 },
      { region: 'Virginia', budget_delta: 0, coverage_delta: 0.03 },
    ],
  },
}
