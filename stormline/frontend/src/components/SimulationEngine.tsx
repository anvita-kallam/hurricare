import { useState, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'

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

interface AffectedRegion {
  admin1: string
  severity_index: number
  people_in_need: number
}

export default function SimulationEngine() {
  const { selectedHurricane } = useStore()
  const [stage, setStage] = useState<1 | 2 | 3 | 'comparison'>(1)
  const [regions, setRegions] = useState<AffectedRegion[]>([])
  const [userAllocations, setUserAllocations] = useState<Record<string, number>>({})
  const [totalBudget, setTotalBudget] = useState(50000000)
  const [responseWindow, setResponseWindow] = useState(72)
  const [userPlan, setUserPlan] = useState<SimulationPlan | null>(null)
  const [mlPlan, setMlPlan] = useState<SimulationPlan | null>(null)
  const [realPlan, setRealPlan] = useState<SimulationPlan | null>(null)
  const [mismatchAnalysis, setMismatchAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<{valid: boolean, errors: string[], warnings: string[]} | null>(null)
  const [simulationResult, setSimulationResult] = useState<any>(null)

  useEffect(() => {
    if (selectedHurricane) {
      loadRegions()
    }
  }, [selectedHurricane])

  const loadRegions = async () => {
    if (!selectedHurricane) return
    
    try {
      const [regionsRes, budgetRes] = await Promise.all([
        axios.get(`${API_BASE}/simulation/regions/${selectedHurricane.id}`),
        axios.get(`${API_BASE}/simulation/total-budget/${selectedHurricane.id}`)
      ])
      
      setRegions(regionsRes.data.regions)
      setTotalBudget(budgetRes.data.total_budget)
      
      // Initialize allocations to zero
      const initial: Record<string, number> = {}
      regionsRes.data.regions.forEach((r: AffectedRegion) => {
        initial[r.admin1] = 0
      })
      setUserAllocations(initial)
    } catch (error) {
      console.error('Error loading regions:', error)
    }
  }

  const handleAllocationChange = (region: string, value: number) => {
    setUserAllocations(prev => {
      const newAllocations = { ...prev }
      const currentTotal = Object.values(prev).reduce((sum, v) => sum + (v || 0), 0)
      const currentRegionValue = prev[region] || 0
      const newTotal = currentTotal - currentRegionValue + value
      
      // Prevent exceeding total budget
      if (newTotal > totalBudget) {
        // Allow up to the remaining budget
        const remaining = totalBudget - (currentTotal - currentRegionValue)
        newAllocations[region] = Math.max(0, Math.min(value, remaining))
      } else {
        newAllocations[region] = Math.max(0, value)
      }
      
      return newAllocations
    })
  }
  
  const getRemainingBudget = () => {
    const allocated = Object.values(userAllocations).reduce((sum, v) => sum + (v || 0), 0)
    return totalBudget - allocated
  }

  const validateUserPlan = async () => {
    if (!selectedHurricane) return
    
    setLoading(true)
    setValidation(null) // Clear previous validation
    
    try {
      // Ensure all regions have allocations (even if 0)
      const completeAllocations: Record<string, number> = {}
      regions.forEach(region => {
        completeAllocations[region.admin1] = userAllocations[region.admin1] || 0
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
      } catch (error) {
        console.error('Error running simulation:', error)
      }
      
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
        allocations: {}, // Not used for ML plan
        total_budget: totalBudget,
        response_window_hours: responseWindow
      })
      
      setMlPlan(res.data)
      setStage(3)
    } catch (error) {
      console.error('Error generating ML plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRealWorldPlan = async () => {
    if (!selectedHurricane) return
    
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/simulation/stage3/real-world/${selectedHurricane.id}`)
      setRealPlan(res.data)
      
      // Generate mismatch analysis
      if (mlPlan) {
        const mismatchRes = await axios.post(`${API_BASE}/simulation/mismatch-analysis`, {
          ideal_plan: mlPlan,
          real_plan: res.data
        })
        setMismatchAnalysis(mismatchRes.data)
      }
      
      setStage('comparison')
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

  return (
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
                    ${Object.values(userAllocations).reduce((sum, v) => sum + (v || 0), 0).toLocaleString()}
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

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {regions.map(region => (
                <div key={region.admin1} className="bg-black/40 p-3 rounded border border-cyan-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="font-semibold text-cyan-200 font-exo">{region.admin1}</div>
                      <div className="text-xs text-cyan-300/70 font-exo">
                        Severity: {region.severity_index.toFixed(2)} • Need: {region.people_in_need.toLocaleString()} people
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-cyan-300 font-orbitron">
                      ${(userAllocations[region.admin1] || 0).toLocaleString()}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, (userAllocations[region.admin1] || 0) + getRemainingBudget())}
                    step={10000}
                    value={userAllocations[region.admin1] || 0}
                    onChange={(e) => handleAllocationChange(region.admin1, Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              ))}
            </div>

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
                <h3 className="font-semibold mb-2 text-glow-cyan font-orbitron">Budget Simulation Results</h3>
                
                {/* Overall Impact Score */}
                <div className="pb-2 border-b border-cyan-500/30">
                  <div className="text-lg font-bold text-glow-cyan font-orbitron">
                    Impact Score: {simulationResult.impact_score?.toFixed(0) || 'N/A'}
                  </div>
                </div>
                
                {/* Key Metrics */}
                <div className="space-y-2 text-sm font-exo">
                  <div className="flex justify-between">
                    <span className="text-cyan-200">Lives Covered:</span>
                    <span className="text-cyan-300 font-orbitron">{simulationResult.lives_covered?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-200">Vulnerability Reduction:</span>
                    <span className="text-cyan-300 font-orbitron">{simulationResult.vulnerability_reduction?.toFixed(2) || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-200">Unmet Need:</span>
                    <span className="text-cyan-300 font-orbitron">{simulationResult.unmet_need?.toLocaleString() || 0}</span>
                  </div>
                  
                  {/* Comparison */}
                  {simulationResult.comparison && (
                    <div className="mt-3 pt-3 border-t border-cyan-500/30">
                      <div className="text-xs text-cyan-300/70 mb-2 font-exo">Comparison to Current Allocation:</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-200">Current:</span>
                          <span className="text-cyan-300">{simulationResult.comparison.current_lives_covered?.toLocaleString() || 0} lives</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-200">Your Plan:</span>
                          <span className="text-cyan-300">{simulationResult.comparison.simulated_lives_covered?.toLocaleString() || 0} lives</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyan-200 font-semibold">Improvement:</span>
                          <span className={`font-orbitron font-semibold ${simulationResult.comparison.improvement > 0 ? 'text-green-400 glow-green' : 'text-red-400'}`}>
                            {simulationResult.comparison.improvement > 0 ? '+' : ''}{simulationResult.comparison.improvement?.toFixed(0) || 0} lives
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                {mlPlan.explanation && (
                  <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 p-4 rounded text-sm text-cyan-100 font-exo glow-cyan">
                    <div className="font-semibold mb-2 text-cyan-200 font-orbitron">✨ AI Optimization Summary</div>
                    {mlPlan.explanation}
                  </div>
                )}
                
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
                        return (
                          <div key={alloc.region} className="bg-black/40 p-3 rounded border border-cyan-500/20">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-cyan-200 font-exo font-semibold">{alloc.region}</span>
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
                    <div className="text-sm font-semibold mb-2 text-purple-300 font-orbitron">📊 Your Plan vs Ideal</div>
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
                  onClick={loadRealWorldPlan}
                  disabled={loading}
                  className="w-full mt-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 px-4 rounded hover:from-cyan-700 hover:to-blue-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron text-lg"
                >
                  {loading ? 'Loading Real-World Data...' : '→ Reveal Real-World Response'}
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

      {/* Stage 3 & Comparison */}
      {(stage === 3 || stage === 'comparison') && realPlan && (
        <div className="flex-1 space-y-4">
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

              {mismatchAnalysis && (
                <div className="mt-4 space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded text-sm text-yellow-200 font-exo">
                    <div className="font-semibold mb-2 font-orbitron">Mismatch Analysis</div>
                    <p>{mismatchAnalysis.narrative}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 p-2 rounded border border-cyan-500/20">
                      <div className="text-xs text-cyan-300/70 font-exo">Equity Deviation</div>
                      <div className="text-lg font-semibold text-cyan-300 font-orbitron">
                        {(mismatchAnalysis.equity_deviation * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-cyan-500/20">
                      <div className="text-xs text-cyan-300/70 font-exo">Efficiency Loss</div>
                      <div className="text-lg font-semibold text-cyan-300 font-orbitron">
                        {(mismatchAnalysis.efficiency_loss * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {mismatchAnalysis.overlooked_regions.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded">
                      <div className="font-semibold text-red-300 mb-2 font-orbitron">Most Overlooked Regions</div>
                      <div className="space-y-1 text-sm font-exo">
                        {mismatchAnalysis.overlooked_regions.slice(0, 5).map((r: any, i: number) => (
                          <div key={i} className="text-red-200">
                            {r.region}: {(r.coverage_gap * 100).toFixed(0)}% underfunded
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
