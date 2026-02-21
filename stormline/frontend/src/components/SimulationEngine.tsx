import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'
import { 
  FundingVsNeedHeatmap, 
  CoverageGapChart, 
  RegionalHeatmap, 
  OutcomeRadarChart,
  SeverityVsFundingScatter 
} from './DataVisualizations'
import NarrativePopup from './NarrativePopup'

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

interface SimulationEngineProps {
  onStartSimulation?: () => void
}

export default function SimulationEngine({ onStartSimulation }: SimulationEngineProps = {}) {
  const { selectedHurricane, coverage, projects, setLastSimulationScore, setLeaderboardOpen, cinematicCompleted, setCinematicCompleted, isCinematicPlaying, setCinematicPlaying, setSelectedHurricane, setShowComparisonPage, setComparisonData } = useStore()
  const [stage, setStage] = useState<1 | 2 | 3 | 'comparison'>(1)
  // Cluster-based allocations per region: { region: { cluster: budget } }
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

  // Get regions from coverage data (like AllocationPanel)
  const regions = useMemo(() => {
    if (!selectedHurricane) return []
    return coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => c.admin1)
      .filter((v, i, a) => a.indexOf(v) === i)
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

  // Get cluster budgets per region (current allocation per cluster per region)
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
          // Calculate from coverage if API fails
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
      
      // Calculate total allocated across all regions and clusters
      const currentTotal = Object.values(prev).reduce((sum, regionAllocs) => {
        return sum + Object.values(regionAllocs).reduce((s, v) => s + (v || 0), 0)
      }, 0)
      
      const currentClusterValue = prev[region]?.[cluster] || 0
      const newTotal = currentTotal - currentClusterValue + value
      
      // Prevent exceeding total budget
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

  const validateUserPlan = async () => {
    if (!selectedHurricane) return
    
    setLoading(true)
    setValidation(null) // Clear previous validation
    
    try {
      // Sum cluster allocations per region
      const completeAllocations: Record<string, number> = {}
      regions.forEach(region => {
        const regionTotal = Object.values(clusterAllocations[region] || {}).reduce((sum, v) => sum + (v || 0), 0)
        completeAllocations[region] = regionTotal
      })
      
      const res = await axios.post(`${API_BASE}/simulation/stage1/user-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: completeAllocations,
        total_budget: totalBudget,
        response_window_hours: responseWindow
      })
      
      setUserPlan(res.data)
      setValidation(null) // Clear validation on success
      
      // Run allocation simulation to show results
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
      
      // Show narrative pop-up about user plan completion
      setNarrativePopup({
        title: 'Your Response Plan Complete',
        message: `You've allocated $${getTotalAllocated().toLocaleString()} across ${regions.length} affected regions. Your plan prioritizes specific humanitarian clusters in each region. Now let's see how an AI-optimized plan would allocate the same resources based on UN humanitarian principles.`,
        type: 'success'
      })
      
      setStage(2)
      // Auto-generate ML plan when moving to stage 2
      setTimeout(() => {
        generateMLPlan()
      }, 500)
    } catch (error: any) {
      console.error('Error creating user plan:', error)
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
          errors: ['Failed to create plan. Please try again.'],
          warnings: []
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const generateMLPlan = async () => {
    if (!selectedHurricane) return
    
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/simulation/stage2/ml-ideal-plan`, {
        hurricane_id: selectedHurricane.id,
        allocations: {}, // Empty - not used for ML plan
        total_budget: totalBudget,
        response_window_hours: responseWindow
      })
      
      setMlPlan(res.data)
      
      // Show narrative pop-up about ML plan
      setNarrativePopup({
        title: 'AI-Optimized Response Plan Generated',
        message: `The AI has analyzed the crisis using United Nations humanitarian principles: • Humanity: Prioritizing life-saving interventions • Neutrality: Allocating without bias • Impartiality: Based on need alone • Equity: Fair distribution across regions • Sustainability: Long-term recovery focus. Compare your plan with this optimized allocation.`,
        type: 'info'
      })
      
      // Stay on Stage 2 to show the ML plan
    } catch (error: any) {
      console.error('Error generating ML plan:', error)
      if (error.response) {
        console.error('Response data:', error.response.data)
      }
      setValidation({
        valid: false,
        errors: ['Failed to generate ML plan. Please try again.'],
        warnings: []
      })
    } finally {
      setLoading(false)
    }
  }

  const proceedToRealWorld = async () => {
    if (!selectedHurricane || !mlPlan) return
    
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/simulation/stage3/real-world/${selectedHurricane.id}`)
      setRealPlan(res.data)
      
      // Generate mismatch analysis (compare ML ideal vs real-world)
      if (mlPlan && res.data) {
        try {
          const mismatchRes = await axios.post(`${API_BASE}/simulation/mismatch-analysis`, {
            ideal_plan: mlPlan,
            real_plan: res.data
          })
          setMismatchAnalysis(mismatchRes.data)
        } catch (error) {
          console.error('Error generating mismatch analysis:', error)
        }
      }
      
      // Show narrative pop-up about real-world response
      setNarrativePopup({
        title: 'Historical Response Revealed',
        message: `This is how ${selectedHurricane.name} was actually handled in ${selectedHurricane.year}. Real-world humanitarian response faces constraints you might not see: political pressures, logistics bottlenecks, security challenges, and competing priorities. Compare your plan, the AI's ideal plan, and what actually happened.`,
        type: 'warning'
      })
      
      setStage(3)
    } catch (error) {
      console.error('Error loading real-world plan:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedHurricane) {
    return (
      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 glow-cyan">
        <p className="text-cyan-300/80 font-exo">Please select a hurricane to begin simulation</p>
      </div>
    )
  }
  
  // Show "Start Simulation" button if hurricane is selected but cinematic hasn't played
  if (selectedHurricane && !cinematicCompleted && !isCinematicPlaying) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-8 glow-cyan text-center space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-glow-cyan font-orbitron mb-2">
              {selectedHurricane.name} ({selectedHurricane.year})
            </h2>
            <p className="text-sm text-cyan-400/80 mb-1">
              Category {selectedHurricane.max_category} • {selectedHurricane.affected_countries.join(', ')}
            </p>
            <p className="text-sm text-cyan-300/70">
              {selectedHurricane.estimated_population_affected.toLocaleString()} people affected
            </p>
          </div>
          <button
            onClick={() => {
              if (onStartSimulation) {
                onStartSimulation()
              }
            }}
            className="px-8 py-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-orbitron text-lg transition glow-cyan"
          >
            Start Simulation
          </button>
          <p className="text-xs text-cyan-400/60 mt-2">
            A brief cinematic will play showing the hurricane's progression
          </p>
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
      
      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 h-full flex flex-col glow-cyan overflow-auto">
      {/* Stage Indicator */}
      <div className="mb-6 flex items-center justify-between border-b border-cyan-500/30 pb-4">
        <div>
          <h2 className="text-xl font-bold text-glow-cyan font-orbitron mb-2">Simulation Engine</h2>
          <div className="flex gap-2">
            <div className={`px-3 py-1 rounded text-xs font-orbitron ${
              (typeof stage === 'number' && stage >= 1) || stage === 'comparison' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-gray-700 text-gray-400'
            }`}>
              Stage 1: User Plan
            </div>
            <div className={`px-3 py-1 rounded text-xs font-orbitron ${
              (typeof stage === 'number' && stage >= 2) || stage === 'comparison' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-gray-700 text-gray-400'
            }`}>
              Stage 2: ML Ideal
            </div>
            <div className={`px-3 py-1 rounded text-xs font-orbitron ${
              (typeof stage === 'number' && stage >= 3) || stage === 'comparison' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-gray-700 text-gray-400'
            }`}>
              Stage 3: Real-World
            </div>
            <div className={`px-3 py-1 rounded text-xs font-orbitron ${
              stage === 'comparison' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-gray-700 text-gray-400'
            }`}>
              Comparison
            </div>
          </div>
        </div>
      </div>

      {/* Stage 1: User Plan */}
      {stage === 1 && (
        <div className="flex-1 space-y-4">
          <div className="bg-black/60 p-4 rounded border border-cyan-500/20">
            <h3 className="text-lg font-semibold mb-4 text-cyan-200 font-orbitron">Design Your Response Plan</h3>
            
            <div className="space-y-4 mb-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-cyan-200 font-exo">Total Budget (Actual Funding)</label>
                  <span className="text-lg font-semibold text-cyan-300 font-orbitron">
                    ${totalBudget.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-cyan-300/70 font-exo">Allocated:</span>
                  <span className="text-cyan-300 font-orbitron">
                    ${getTotalAllocated().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-cyan-300/70 font-exo">Remaining:</span>
                  <span className={`font-orbitron ${getRemainingBudget() < 0 ? 'text-red-400' : 'text-cyan-300'}`}>
                    ${getRemainingBudget().toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-200 font-exo">Response Window (hours)</label>
                <input
                  type="number"
                  value={responseWindow}
                  onChange={(e) => setResponseWindow(Number(e.target.value))}
                  className="w-full border border-cyan-500/30 rounded px-3 py-2 bg-black/60 text-cyan-200 focus:border-cyan-400 focus:glow-cyan font-exo"
                />
              </div>
            </div>

            {/* Cluster Allocation Per Region */}
            {regions.length === 0 ? (
              <div className="text-center py-8 text-cyan-300/70 font-exo">
                <div>No regions found. Please select a hurricane.</div>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {regions.map(region => {
                  const cov = currentCoverage[region]
                  const regionClusterTotal = getRegionClusterTotal(region)
                  const remainingForRegion = getRemainingForRegion(region)
                  
                  return (
                    <div key={region} className="bg-black/50 p-4 rounded border border-cyan-500/30">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-cyan-500/20">
                        <div>
                          <div className="font-semibold text-cyan-200 font-exo text-lg">{region}</div>
                          {cov && (
                            <div className="text-xs text-cyan-300/70 font-exo mt-1">
                              Severity: {cov.severity_index.toFixed(2)} • 
                              People in Need: {cov.people_in_need.toLocaleString()} • 
                              Current Total: ${cov.pooled_fund_budget.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-cyan-300 font-orbitron">
                          Region Total: ${regionClusterTotal.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {CLUSTERS.map(cluster => {
                          const currentAlloc = clusterAllocations[region]?.[cluster] || 0
                          const currentBudget = clusterBudgetsByRegion[region]?.[cluster] || 0
                          const maxForCluster = Math.max(0, currentAlloc + remainingForRegion)
                          
                          return (
                            <div key={cluster} className="bg-black/40 p-3 rounded border border-cyan-500/20">
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <div className="font-medium text-cyan-200 font-exo">{cluster}</div>
                                  {currentBudget > 0 && (
                                    <div className="text-xs text-cyan-300/70 font-exo">
                                      Current: ${currentBudget.toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-cyan-300 font-orbitron">
                                  ${currentAlloc.toLocaleString()}
                                </div>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max={maxForCluster}
                                step={Math.max(1000, Math.floor(maxForCluster / 100))}
                                value={currentAlloc}
                                onChange={(e) => handleClusterAllocationChange(region, cluster, Number(e.target.value))}
                                className="w-full accent-cyan-500"
                              />
                              <div className="flex justify-between text-xs text-cyan-400/60 mt-1 font-exo">
                                <span>$0</span>
                                <span>${maxForCluster.toLocaleString()}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {validation && (
              <div className="mt-4 space-y-2">
                {validation.errors.length > 0 && (
                  <div className="bg-red-500/20 border border-red-500/50 p-3 rounded text-sm text-red-300 font-exo">
                    <div className="font-semibold mb-1">Errors:</div>
                    <ul className="list-disc list-inside">
                      {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="bg-yellow-500/20 border border-yellow-500/50 p-3 rounded text-sm text-yellow-300 font-exo">
                    <div className="font-semibold mb-1">Warnings:</div>
                    <ul className="list-disc list-inside">
                      {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={validateUserPlan}
              disabled={loading}
              className="w-full mt-4 bg-cyan-600 text-white py-2 px-4 rounded hover:bg-cyan-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron"
            >
              {loading ? 'Validating & Simulating...' : 'Validate Plan & Proceed to Stage 2'}
            </button>

            {simulationResult && (
              <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded space-y-3 glow-cyan backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-glow-cyan font-orbitron">Budget Simulation Results</h3>
                  <button
                    onClick={() => setLeaderboardOpen(true)}
                    className="px-3 py-1.5 rounded bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-200 text-xs font-semibold font-orbitron border border-yellow-500/50"
                  >
                    Submit to Leaderboard
                  </button>
                </div>
                
                {/* Overall Impact Score */}
                <div className="pb-2 border-b border-cyan-500/30">
                  <div className="text-lg font-bold text-glow-cyan font-orbitron">
                    Impact Score: {simulationResult.impact_score?.toFixed(0) || 'N/A'}
                  </div>
                </div>
                
                {/* Hard Priorities (Non-negotiable) */}
                {simulationResult.hard_priorities && (
                  <div className="pb-2 border-b border-cyan-500/30">
                    <div className="font-semibold text-red-400 mb-1 glow font-orbitron">Hard Priorities (Non-negotiable):</div>
                    <div className="text-xs space-y-1 pl-2 text-cyan-200 font-exo">
                      <div>
                        <span className="font-medium text-cyan-300">Lives Saved:</span> {Math.round(simulationResult.hard_priorities.lives_saved || 0).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-cyan-300">Suffering Reduced:</span> {Math.round(simulationResult.hard_priorities.suffering_reduced || 0).toLocaleString()} people
                      </div>
                      <div>
                        <span className="font-medium text-cyan-300">Vulnerable Protected:</span> {Math.round(simulationResult.hard_priorities.vulnerable_protected || 0).toLocaleString()} people
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Soft Priorities (Trade-offs) */}
                {simulationResult.soft_priorities && (
                  <div className="pb-2 border-b border-cyan-500/30">
                    <div className="font-semibold text-orange-400 mb-1 glow font-orbitron">Soft Priorities (Trade-offs):</div>
                    <div className="text-xs space-y-1 pl-2 text-cyan-200 font-exo">
                      <div>
                        <span className="font-medium text-cyan-300">Economic Loss Reduction:</span> ${Math.round(simulationResult.soft_priorities.economic_loss_reduction || 0).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-cyan-300">Resource Efficiency:</span> {simulationResult.soft_priorities.resource_efficiency?.toFixed(2) || 0}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Constraints (Penalties) */}
                {simulationResult.constraints && (
                  <div className="pb-2 border-b border-cyan-500/30">
                    <div className="font-semibold text-yellow-400 mb-1 glow font-orbitron">Constraints (Penalties):</div>
                    <div className="text-xs space-y-1 pl-2 text-cyan-200 font-exo">
                      <div>
                        <span className="font-medium text-cyan-300">Logistics Penalty:</span> {(simulationResult.constraints.logistics_penalty * 100 || 0).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium text-cyan-300">Access/Security Penalty:</span> {(simulationResult.constraints.access_penalty * 100 || 0).toFixed(1)}%
                      </div>
                      <div className="font-semibold text-cyan-200">
                        <span className="font-medium">Total Constraint Impact:</span> {(simulationResult.constraints.total_penalty * 100 || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Critical Metrics */}
                <div className="pb-2 border-b border-cyan-500/30">
                  <div className="font-semibold text-cyan-300 mb-1 font-orbitron">Critical Metrics:</div>
                  <div className="text-xs space-y-1 pl-2 text-cyan-200 font-exo">
                    <div>
                      <span className="font-medium text-cyan-300">Unmet Need:</span> {Math.round(simulationResult.unmet_need || 0).toLocaleString()} people
                    </div>
                  </div>
                </div>
                
                {/* Comparison */}
                {simulationResult.comparison && (
                  <div>
                    <div className="font-semibold mb-1 text-cyan-200 font-orbitron">Comparison to Current Allocation:</div>
                    <div className="text-xs space-y-1 pl-2 text-cyan-200 font-exo">
                      <div>
                        Current: {Math.round(simulationResult.comparison.current_lives_covered || 0).toLocaleString()} lives saved
                      </div>
                      <div>
                        Your Plan: {Math.round(simulationResult.comparison.simulated_lives_covered || 0).toLocaleString()} lives saved
                      </div>
                      <div className={`font-semibold ${
                        simulationResult.comparison.improvement > 0 ? 'text-green-400 glow-green' : 'text-red-400 glow'
                      }`}>
                        Improvement: {Math.round(simulationResult.comparison.improvement || 0).toLocaleString()} lives
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 2: ML Ideal Plan */}
      {stage === 2 && (
        <div className="flex-1 space-y-4">
          <div className="bg-black/60 p-4 rounded border border-cyan-500/20">
            <h3 className="text-lg font-semibold mb-4 text-cyan-200 font-orbitron">ML-Generated Ideal Plan</h3>
            
            {loading && !mlPlan ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
                <div className="text-cyan-300 font-exo">Generating optimal allocation...</div>
              </div>
            ) : mlPlan ? (
              <div className="space-y-4">
                {mlPlan.objective_scores && (
                  <div>
                    <div className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">UN Values Performance</div>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(mlPlan.objective_scores).map(([key, value]) => {
                        const score = (value as number) * 100
                        const width = Math.min(100, score)
                        return (
                          <div key={key} className="bg-black/40 p-3 rounded border border-cyan-500/20">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-xs text-cyan-300/70 font-exo capitalize">{key.replace('_', ' ')}</div>
                              <div className="text-lg font-semibold text-cyan-300 font-orbitron">{score.toFixed(1)}%</div>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500 glow-cyan"
                                style={{ width: `${width}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Ideal Allocation by Region</div>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {mlPlan.allocations
                      .sort((a, b) => b.budget - a.budget)
                      .map(alloc => {
                        const budgetPercent = (alloc.budget / mlPlan.total_budget) * 100
                        const coveragePercent = alloc.coverage_estimate.coverage_ratio * 100
                        const peopleCovered = alloc.coverage_estimate.people_covered || 0
                        const unmetNeed = alloc.coverage_estimate.unmet_need || 0
                        return (
                          <div key={alloc.region} className="bg-black/40 p-3 rounded border border-cyan-500/20">
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <span className="text-cyan-200 font-exo font-semibold">{alloc.region}</span>
                                <div className="text-xs text-cyan-300/70 font-exo mt-1">
                                  People Covered: {peopleCovered.toLocaleString()} • 
                                  Unmet Need: {unmetNeed.toLocaleString()}
                                </div>
                              </div>
                              <span className="text-cyan-300 font-orbitron">${alloc.budget.toLocaleString()}</span>
                            </div>
                            
                            {/* Budget allocation bar */}
                            <div className="mb-2">
                              <div className="flex justify-between text-xs text-cyan-300/70 mb-1 font-exo">
                                <span>Budget: {budgetPercent.toFixed(1)}%</span>
                                <span>Coverage: {coveragePercent.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 glow-cyan"
                                  style={{ width: `${budgetPercent}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Coverage visualization */}
                            <div className="flex items-center gap-2 text-xs text-cyan-300/70 font-exo">
                              <div className="flex-1">
                                <span className="text-green-400">✓</span> {alloc.coverage_estimate.people_covered.toLocaleString()} people covered
                              </div>
                              <div className="flex-1">
                                <span className="text-red-400">✗</span> {alloc.coverage_estimate.unmet_need.toLocaleString()} unmet need
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Visual comparison with user plan */}
                {userPlan && (
                  <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                    <div className="text-sm font-semibold mb-2 text-purple-300 font-orbitron">Your Plan vs Ideal</div>
                    <div className="space-y-2 text-xs font-exo">
                      {mlPlan.allocations.map(mlAlloc => {
                        const userAlloc = userPlan.allocations.find(a => a.region === mlAlloc.region)
                        const diff = mlAlloc.budget - (userAlloc?.budget || 0)
                        const diffPercent = userAlloc ? ((diff / userAlloc.budget) * 100) : 100
                        return (
                          <div key={mlAlloc.region} className="flex items-center justify-between">
                            <span className="text-cyan-200">{mlAlloc.region}:</span>
                            <div className="flex items-center gap-2">
                              <span className={diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-cyan-300'}>
                                {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(diffPercent).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={proceedToRealWorld}
                  disabled={loading}
                  className="w-full mt-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 px-4 rounded hover:from-cyan-700 hover:to-blue-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron text-lg"
                >
                  {loading ? 'Loading Real-World Data...' : 'Proceed to Stage 3: Real-World Response'}
                </button>
              </div>
            ) : (
              <button
                onClick={generateMLPlan}
                disabled={loading}
                className="w-full bg-cyan-600 text-white py-2 px-4 rounded hover:bg-cyan-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron"
              >
                {loading ? 'Generating...' : 'Generate ML-Optimized Ideal Plan'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stage 3: Real-World Response */}
      {stage === 3 && realPlan && (
        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="bg-black/60 p-4 rounded border border-cyan-500/20">
            <h3 className="text-lg font-semibold mb-4 text-cyan-200 font-orbitron">Real-World Historical Response</h3>
            
            <div className="space-y-4">
              <div className="text-sm text-cyan-300/80 font-exo">
                Total Budget: ${realPlan.total_budget.toLocaleString()}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {realPlan.allocations.map(alloc => (
                  <div key={alloc.region} className="bg-black/40 p-2 rounded border border-cyan-500/20 text-sm">
                    <div className="flex justify-between">
                      <span className="text-cyan-200 font-exo">{alloc.region}</span>
                      <span className="text-cyan-300 font-orbitron">${alloc.budget.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-cyan-300/70 font-exo">
                      Coverage: {(alloc.coverage_estimate.coverage_ratio * 100).toFixed(1)}% • 
                      Covered: {alloc.coverage_estimate.people_covered.toLocaleString()} people
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Visualizations for Real-World */}
              {userPlan && mlPlan && (
                <div className="space-y-4 mt-6">
                  <FundingVsNeedHeatmap 
                    userPlan={userPlan} 
                    mlPlan={mlPlan} 
                    realPlan={realPlan} 
                  />
                  
                  <SeverityVsFundingScatter 
                    userPlan={userPlan} 
                    mlPlan={mlPlan} 
                    realPlan={realPlan} 
                  />
                  
                  <RegionalHeatmap 
                    userPlan={userPlan} 
                    mlPlan={mlPlan} 
                    realPlan={realPlan} 
                  />
                </div>
              )}

              <button
                onClick={() => {
                  if (userPlan && mlPlan && realPlan) {
                    setComparisonData({
                      userPlan,
                      mlPlan,
                      realPlan,
                      mismatchAnalysis
                    })
                    setShowComparisonPage(true)
                  }
                }}
                disabled={!mismatchAnalysis}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 disabled:text-gray-400 glow-purple transition-all font-semibold font-orbitron text-lg"
              >
                {mismatchAnalysis ? 'View Full Comparison Dashboard' : 'Generating Analysis...'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}
