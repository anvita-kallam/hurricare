import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'
import NarrativePopup from './NarrativePopup'
import LocalizedAffectedMap from './LocalizedAffectedMap'

const API_BASE = 'http://localhost:8000'

interface NativeResources {
  shelters: number
  hospital_beds: number
  responder_units: number
  evac_vehicles: number
  food_days: number
  power_units: number
}

interface CoverageEstimate {
  people_covered: number
  coverage_ratio: number
  unmet_need: number
  severity_weighted_impact: number
}

interface RegionAllocation {
  region: string
  budget: number
  resources: NativeResources
  coverage_estimate: CoverageEstimate
}

interface SimulationPlan {
  plan_type: 'user' | 'ml_ideal' | 'real_world'
  hurricane_id: string
  total_budget: number
  response_window_hours: number
  allocations: RegionAllocation[]
  constraints_used: Record<string, any>
  objective_scores?: Record<string, number>
  explanation?: string
}

// Standard humanitarian clusters/causes
const CLUSTERS = [
  'Emergency Shelter and NFI',
  'Food Security',
  'Health',
  'Water Sanitation Hygiene',
  'Logistics',
  'Early Recovery'
] as const

// Processing pipeline stages
type PipelineStage = 'idle' | 'validating' | 'ml_generating' | 'real_loading' | 'analyzing' | 'complete'

interface SimulationEngineProps {
  onStartSimulation?: () => void
}

export default function SimulationEngine({ onStartSimulation }: SimulationEngineProps = {}) {
  const { selectedHurricane, coverage, projects, setLastSimulationScore, setLeaderboardOpen, cinematicCompleted, setCinematicCompleted, isCinematicPlaying, setCinematicPlaying, setSelectedHurricane, setShowComparisonPage, setComparisonData } = useStore()
  const [clusterAllocations, setClusterAllocations] = useState<Record<string, Record<string, number>>>({})
  const [totalBudget, setTotalBudget] = useState(50000000)
  const [responseWindow, setResponseWindow] = useState(72)
  const [userPlan, setUserPlan] = useState<SimulationPlan | null>(null)
  const [mlPlan, setMlPlan] = useState<SimulationPlan | null>(null)
  const [realPlan, setRealPlan] = useState<SimulationPlan | null>(null)
  const [mismatchAnalysis, setMismatchAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<{valid: boolean, errors: string[], warnings: string[]} | null>(null)
  const [simulationResult, setSimulationResult] = useState<any>(null)
  const [narrativePopup, setNarrativePopup] = useState<{title: string, message: string, type?: 'info' | 'warning' | 'success' | 'story'} | null>(null)
  const [showAffectedMap, setShowAffectedMap] = useState(false)

  // Pipeline tracking
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle')
  const [pipelineProgress, setPipelineProgress] = useState(0)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)

  // Get regions from coverage data, falling back to affected_countries
  const regions = useMemo(() => {
    if (!selectedHurricane) return []
    const fromCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => c.admin1)
      .filter((v, i, a) => a.indexOf(v) === i)
    if (fromCoverage.length > 0) return fromCoverage
    // Fallback: use affected_countries as region names
    return (selectedHurricane.affected_countries || [])
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
  }, [selectedHurricane, coverage])

  // Get current coverage data
  const currentCoverage = useMemo(() => {
    if (!selectedHurricane) return {}
    const result: Record<string, any> = {}
    coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .forEach(c => {
        result[c.admin1] = c
      })
    return result
  }, [selectedHurricane, coverage])

  // Get cluster budgets per region
  const clusterBudgetsByRegion = useMemo(() => {
    if (!selectedHurricane) return {}
    const result: Record<string, Record<string, number>> = {}
    projects
      .filter(p => p.hurricane_id === selectedHurricane.id && p.pooled_fund)
      .forEach(p => {
        if (!result[p.admin1]) {
          result[p.admin1] = {}
        }
        result[p.admin1][p.cluster] = (result[p.admin1][p.cluster] || 0) + p.budget_usd
      })
    return result
  }, [selectedHurricane, projects])

  // Load total budget when hurricane is selected
  useEffect(() => {
    if (selectedHurricane) {
      const loadBudget = async () => {
        try {
          const budgetRes = await axios.get(`${API_BASE}/simulation/total-budget/${selectedHurricane.id}`)
          setTotalBudget(budgetRes.data.total_budget || 50000000)
        } catch (error) {
          console.error('Error loading budget:', error)
          const total = coverage
            .filter(c => c.hurricane_id === selectedHurricane.id)
            .reduce((sum, c) => sum + c.pooled_fund_budget, 0)
          setTotalBudget(total || 50000000)
        }
      }
      loadBudget()
    }
  }, [selectedHurricane, coverage])

  // Show narrative pop-up AFTER cinematic completes (only once)
  const narrativeShownRef = useRef(false)
  useEffect(() => {
    if (selectedHurricane && cinematicCompleted && !isCinematicPlaying && !narrativeShownRef.current) {
      narrativeShownRef.current = true
      setNarrativePopup({
        title: `Hurricane ${selectedHurricane.name} - ${selectedHurricane.year}`,
        message: `You are now the humanitarian response coordinator for ${selectedHurricane.name}, a Category ${selectedHurricane.max_category} storm that affected ${selectedHurricane.affected_countries.join(', ')}. ${selectedHurricane.estimated_population_affected.toLocaleString()} people were impacted. Your mission: allocate limited resources to save lives and reduce suffering. You have a fixed budget based on actual historical funding. Make every dollar count.`,
        type: 'story'
      })
    }
  }, [selectedHurricane, cinematicCompleted, isCinematicPlaying])

  // Reset narrative shown flag when hurricane changes
  useEffect(() => {
    narrativeShownRef.current = false
  }, [selectedHurricane])


  // Initialize cluster allocations per region
  useEffect(() => {
    if (regions.length > 0) {
      const initial: Record<string, Record<string, number>> = {}
      regions.forEach(region => {
        initial[region] = {}
        CLUSTERS.forEach(cluster => {
          initial[region][cluster] = 0
        })
      })
      setClusterAllocations(initial)
    }
  }, [regions])


  const handleClusterAllocationChange = (region: string, cluster: string, value: number) => {
    setClusterAllocations(prev => {
      const newAllocations = { ...prev }
      if (!newAllocations[region]) {
        newAllocations[region] = {}
      }

      const currentTotal = Object.values(prev).reduce((sum, regionAllocs) => {
        return sum + Object.values(regionAllocs).reduce((s, v) => s + (v || 0), 0)
      }, 0)

      const currentClusterValue = prev[region]?.[cluster] || 0
      const newTotal = currentTotal - currentClusterValue + value

      if (newTotal > totalBudget) {
        const remaining = totalBudget - (currentTotal - currentClusterValue)
        newAllocations[region][cluster] = Math.max(0, Math.min(value, remaining))
      } else {
        newAllocations[region][cluster] = Math.max(0, value)
      }

      return newAllocations
    })
  }

  const getRemainingBudget = () => {
    const allocated = Object.values(clusterAllocations).reduce((sum, regionAllocs) => {
      return sum + Object.values(regionAllocs).reduce((s, v) => s + (v || 0), 0)
    }, 0)
    return totalBudget - allocated
  }

  const getTotalAllocated = () => {
    return Object.values(clusterAllocations).reduce((sum, regionAllocs) => {
      return sum + Object.values(regionAllocs).reduce((s, v) => s + (v || 0), 0)
    }, 0)
  }

  const getRegionClusterTotal = (region: string) => {
    return Object.values(clusterAllocations[region] || {}).reduce((sum, v) => sum + (v || 0), 0)
  }

  const getRemainingForRegion = (region: string) => {
    const regionTotal = getRegionClusterTotal(region)
    const otherRegionsTotal = Object.entries(clusterAllocations)
      .filter(([r]) => r !== region)
      .reduce((sum, [, regionAllocs]) => {
        return sum + Object.values(regionAllocs).reduce((s, v) => s + (v || 0), 0)
      }, 0)
    return totalBudget - otherRegionsTotal - regionTotal
  }

  // ─── Automated Pipeline: Submit → Generate ML → Load Real → Analyze → Open CommandCenter ───

  const runFullPipeline = async () => {
    if (!selectedHurricane) return

    setLoading(true)
    setValidation(null)

    try {
      // ─── Step 1: Validate user plan ───
      setPipelineStage('validating')
      setPipelineProgress(10)

      const completeAllocations: Record<string, number> = {}
      regions.forEach(region => {
        const regionTotal = Object.values(clusterAllocations[region] || {}).reduce((sum, v) => sum + (v || 0), 0)
        completeAllocations[region] = regionTotal
      })

      const userRes = await axios.post(`${API_BASE}/simulation/stage1/user-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: completeAllocations,
        total_budget: totalBudget,
        response_window_hours: responseWindow
      })

      const newUserPlan = userRes.data
      setUserPlan(newUserPlan)
      setPipelineProgress(25)

      // Run simulation for score
      try {
        const simRes = await axios.post(`${API_BASE}/simulate_allocation`, {
          hurricane_id: selectedHurricane.id,
          allocations: completeAllocations
        })
        setSimulationResult(simRes.data)
        const score = simRes.data?.impact_score
        if (typeof score === 'number') {
          setLastSimulationScore(score)
        }
      } catch (error) {
        console.error('Error running simulation:', error)
      }

      // ─── Step 2: Generate ML plan ───
      setPipelineStage('ml_generating')
      setPipelineProgress(40)

      const mlRes = await axios.post(`${API_BASE}/simulation/stage2/ml-ideal-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: {},
        total_budget: totalBudget,
        response_window_hours: responseWindow
      })

      const newMlPlan = mlRes.data
      setMlPlan(newMlPlan)
      setPipelineProgress(60)

      // ─── Step 3: Load real-world data ───
      setPipelineStage('real_loading')
      setPipelineProgress(70)

      const realRes = await axios.get(`${API_BASE}/simulation/stage3/real-world/${selectedHurricane.id}`)
      const newRealPlan = realRes.data
      setRealPlan(newRealPlan)
      setPipelineProgress(80)

      // ─── Step 4: Generate mismatch analysis ───
      setPipelineStage('analyzing')
      setPipelineProgress(90)

      let newMismatchAnalysis = null
      try {
        const mismatchRes = await axios.post(`${API_BASE}/simulation/mismatch-analysis`, {
          ideal_plan: newMlPlan,
          real_plan: newRealPlan
        })
        newMismatchAnalysis = mismatchRes.data
        setMismatchAnalysis(newMismatchAnalysis)
      } catch (error) {
        console.error('Error generating mismatch analysis:', error)
      }

      setPipelineStage('complete')
      setPipelineProgress(100)

      // ─── Step 5: Transition to CommandCenter ───
      setTimeout(() => {
        setComparisonData({
          userPlan: newUserPlan,
          mlPlan: newMlPlan,
          realPlan: newRealPlan,
          mismatchAnalysis: newMismatchAnalysis
        })
        setShowComparisonPage(true)
      }, 800)

    } catch (error: any) {
      console.error('Pipeline error:', error)
      setPipelineStage('idle')
      setPipelineProgress(0)

      if (error.response?.status === 400) {
        const detail = error.response.data.detail
        setValidation({
          valid: false,
          errors: detail?.errors || [detail?.message || 'Validation failed'],
          warnings: detail?.warnings || []
        })
      } else {
        setValidation({
          valid: false,
          errors: ['Failed to process plan. Please try again.'],
          warnings: []
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Compute affected regions and impact intensity
  const affectedRegionsData = useMemo(() => {
    if (!selectedHurricane) return { regions: [], intensity: {} }

    const regions = selectedHurricane.affected_countries || []
    const intensity: Record<string, number> = {}

    regions.forEach(region => {
      const regionCoverage = coverage.find(
        c => c.hurricane_id === selectedHurricane.id && c.admin1 === region
      )
      if (regionCoverage) {
        const severityWeight = Math.min((regionCoverage.severity_index || 0.5) / 10, 1)
        const coverageGap = 1 - (regionCoverage.coverage_ratio || 0)
        const unmetWeight = coverageGap * 0.5
        intensity[region] = Math.min(severityWeight + unmetWeight, 1)
      } else {
        intensity[region] = Math.random() * 0.8
      }
    })

    return { regions, intensity }
  }, [selectedHurricane, coverage])

  if (!selectedHurricane) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-white/30 font-rajdhani text-sm tracking-widest uppercase">Select a Hurricane</div>
          <div className="text-white/15 font-mono text-xs">to begin simulation</div>
        </div>
      </div>
    )
  }

  // Show affected map if requested
  if (showAffectedMap) {
    return (
      <LocalizedAffectedMap
        affectedRegions={affectedRegionsData.regions}
        impactIntensity={affectedRegionsData.intensity}
        title={`${selectedHurricane.name} (${selectedHurricane.year}) - Impact Analysis`}
        onClose={() => setShowAffectedMap(false)}
      />
    )
  }

  // Show "Start Simulation" button if hurricane is selected but cinematic hasn't played
  if (selectedHurricane && !cinematicCompleted && !isCinematicPlaying) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white/80 font-rajdhani tracking-wider">
              {selectedHurricane.name}
            </h2>
            <div className="text-white/30 font-mono text-xs">
              {selectedHurricane.year} — Category {selectedHurricane.max_category}
            </div>
            <div className="text-white/20 font-mono text-xs">
              {selectedHurricane.affected_countries.join(', ')}
            </div>
            <div className="text-white/15 font-mono text-[10px] mt-1">
              {selectedHurricane.estimated_population_affected.toLocaleString()} affected
            </div>
          </div>
          <button
            onClick={() => {
              if (onStartSimulation) {
                onStartSimulation()
              }
            }}
            className="px-6 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white/90 font-rajdhani font-semibold text-sm tracking-wider uppercase transition-all border border-white/[0.08] hover:border-white/[0.15]"
          >
            Initialize Simulation
          </button>
          <div className="text-white/15 font-mono text-[9px]">
            cinematic briefing will play
          </div>
        </div>
      </div>
    )
  }

  // ─── Processing State (pipeline running) ───
  if (pipelineStage !== 'idle' && loading) {
    const stageLabels: Record<PipelineStage, string> = {
      idle: '',
      validating: 'Validating your response plan',
      ml_generating: 'Generating ML-optimized allocation',
      real_loading: 'Loading historical response data',
      analyzing: 'Running mismatch analysis',
      complete: 'Analysis complete — entering results',
    }

    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-xs space-y-4 px-4">
          <div className="text-white/40 font-rajdhani text-[10px] tracking-widest uppercase text-center">
            Processing Simulation
          </div>

          {/* Progress bar */}
          <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden sim-progress-bar">
            <div
              className="h-full bg-white/30 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>

          {/* Stage label */}
          <div className="text-white/25 font-mono text-[10px] text-center">
            {stageLabels[pipelineStage]}
          </div>

          {/* Pipeline steps visualization */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {(['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete'] as PipelineStage[]).map((stage, i) => {
              const isActive = pipelineStage === stage
              const isPast = pipelineProgress > (i + 1) * 20
              return (
                <div
                  key={stage}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    isActive ? 'bg-white/50 scale-125' : isPast ? 'bg-white/20' : 'bg-white/[0.06]'
                  }`}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }


  return (
    <>
      {/* Narrative Pop-up */}
      {narrativePopup && (
        <NarrativePopup
          title={narrativePopup.title}
          message={narrativePopup.message}
          type={narrativePopup.type || 'info'}
          onClose={() => setNarrativePopup(null)}
          autoClose={0}
        />
      )}

      <div className="sim-panel rounded p-3 h-full flex flex-col overflow-auto">
        {/* Header */}
        <div className="mb-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/60 font-rajdhani font-semibold text-sm tracking-wider">Response Plan</div>
              <div className="text-white/20 font-mono text-[10px] mt-0.5">
                {selectedHurricane.name} — {regions.length} regions
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/50 font-mono text-xs">${getTotalAllocated().toLocaleString()}</div>
              <div className={`font-mono text-[10px] ${getRemainingBudget() < 0 ? 'text-[#cc5566]' : 'text-white/25'}`}>
                {getRemainingBudget() >= 0 ? `$${getRemainingBudget().toLocaleString()} remaining` : 'Over budget'}
              </div>
            </div>
          </div>

          {/* Budget utilization bar */}
          <div className="mt-2 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((getTotalAllocated() / totalBudget) * 100, 100)}%`,
                backgroundColor: getRemainingBudget() < 0 ? '#cc5566' : 'rgba(255,255,255,0.2)',
              }}
            />
          </div>
        </div>

        {/* Response Window */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-white/25 font-rajdhani text-[10px] tracking-wider uppercase">Window</span>
          <input
            type="number"
            value={responseWindow}
            onChange={(e) => setResponseWindow(Number(e.target.value))}
            className="w-16 border border-white/[0.06] rounded px-2 py-1 bg-black/40 text-white/60 text-xs font-mono focus:border-white/15 focus:outline-none"
          />
          <span className="text-white/15 font-mono text-[9px]">hrs</span>
        </div>

        {/* Cluster Allocation Per Region */}
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {regions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-white/20 font-mono text-xs">No regions found</div>
            </div>
          ) : (
            regions.map(region => {
              const cov = currentCoverage[region]
              const regionClusterTotal = getRegionClusterTotal(region)
              const remainingForRegion = getRemainingForRegion(region)
              const isExpanded = expandedRegion === region

              return (
                <div
                  key={region}
                  className="bg-white/[0.02] rounded border border-white/[0.04] transition-all duration-200 hover:border-white/[0.08]"
                >
                  <button
                    onClick={() => setExpandedRegion(isExpanded ? null : region)}
                    className="w-full text-left p-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: cov?.severity_index
                            ? cov.severity_index > 5 ? '#cc4444' : cov.severity_index > 3 ? '#ccaa44' : '#44aa77'
                            : 'rgba(255,255,255,0.15)',
                        }}
                      />
                      <span className="text-white/60 font-rajdhani text-xs font-semibold tracking-wide">{region}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 font-mono text-[10px]">${regionClusterTotal.toLocaleString()}</span>
                      <span className="text-white/15 text-[10px]">{isExpanded ? '▾' : '▸'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 space-y-2 cc-region-detail">
                      {cov && (
                        <div className="text-white/15 font-mono text-[9px] flex gap-3">
                          <span>Sev: {cov.severity_index.toFixed(1)}</span>
                          <span>Need: {cov.people_in_need.toLocaleString()}</span>
                        </div>
                      )}

                      {CLUSTERS.map(cluster => {
                        const currentAlloc = clusterAllocations[region]?.[cluster] || 0
                        const currentBudget = clusterBudgetsByRegion[region]?.[cluster] || 0
                        const maxForCluster = Math.max(0, currentAlloc + remainingForRegion)

                        return (
                          <div key={cluster} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-white/35 font-rajdhani text-[10px] tracking-wide">{cluster}</span>
                              <span className="text-white/40 font-mono text-[9px]">${currentAlloc.toLocaleString()}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={maxForCluster}
                              step={Math.max(1000, Math.floor(maxForCluster / 100))}
                              value={currentAlloc}
                              onChange={(e) => handleClusterAllocationChange(region, cluster, Number(e.target.value))}
                              className="w-full h-1 appearance-none bg-white/[0.04] rounded-full cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.15) ${maxForCluster > 0 ? (currentAlloc / maxForCluster) * 100 : 0}%, rgba(255,255,255,0.04) ${maxForCluster > 0 ? (currentAlloc / maxForCluster) * 100 : 0}%, rgba(255,255,255,0.04) 100%)`,
                              }}
                            />
                            {currentBudget > 0 && (
                              <div className="text-white/10 font-mono text-[8px]">historical: ${currentBudget.toLocaleString()}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Validation errors */}
        {validation && (
          <div className="mt-3 space-y-1.5">
            {validation.errors.length > 0 && (
              <div className="bg-[#cc5566]/10 border border-[#cc5566]/20 p-2 rounded text-[10px] text-[#cc5566]/80 font-mono">
                {validation.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="bg-[#ccaa44]/10 border border-[#ccaa44]/20 p-2 rounded text-[10px] text-[#ccaa44]/80 font-mono">
                {validation.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Submit Button — runs full pipeline */}
        <button
          onClick={runFullPipeline}
          disabled={loading}
          className="w-full mt-3 py-2.5 text-white/60 hover:text-white/90 font-rajdhani font-semibold text-xs tracking-widest uppercase transition-all border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Run Analysis'}
        </button>

        {/* View impact map */}
        <button
          onClick={() => setShowAffectedMap(true)}
          className="w-full mt-1.5 py-1.5 text-white/25 hover:text-white/40 font-rajdhani text-[10px] tracking-wider uppercase transition-colors"
        >
          View Impact Map
        </button>
      </div>
    </>
  )
}
