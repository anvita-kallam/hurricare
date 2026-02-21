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
  const [, setUserPlan] = useState<SimulationPlan | null>(null)
  const [mlPlan, setMlPlan] = useState<SimulationPlan | null>(null)
  const [realPlan, setRealPlan] = useState<SimulationPlan | null>(null)
  const [mismatchAnalysis, setMismatchAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<{valid: boolean, errors: string[], warnings: string[]} | null>(null)

  useEffect(() => {
    if (selectedHurricane) {
      loadRegions()
    }
  }, [selectedHurricane])

  const loadRegions = async () => {
    if (!selectedHurricane) return
    
    try {
      const res = await axios.get(`${API_BASE}/simulation/regions/${selectedHurricane.id}`)
      setRegions(res.data.regions)
      
      // Initialize allocations to zero
      const initial: Record<string, number> = {}
      res.data.regions.forEach((r: AffectedRegion) => {
        initial[r.admin1] = 0
      })
      setUserAllocations(initial)
    } catch (error) {
      console.error('Error loading regions:', error)
    }
  }

  const handleAllocationChange = (region: string, value: number) => {
    setUserAllocations(prev => ({
      ...prev,
      [region]: Math.max(0, value)
    }))
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
      setStage(2)
      setValidation(null) // Clear validation on success
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
              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-200 font-exo">Total Budget (USD)</label>
                <input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(Number(e.target.value))}
                  className="w-full border border-cyan-500/30 rounded px-3 py-2 bg-black/60 text-cyan-200 focus:border-cyan-400 focus:glow-cyan font-exo"
                />
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
                    max={totalBudget}
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
              {loading ? 'Validating...' : 'Validate & Proceed to Stage 2'}
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: ML Ideal Plan */}
      {stage === 2 && (
        <div className="flex-1 space-y-4">
          <div className="bg-black/60 p-4 rounded border border-cyan-500/20">
            <h3 className="text-lg font-semibold mb-4 text-cyan-200 font-orbitron">ML-Generated Ideal Plan</h3>
            
            {mlPlan ? (
              <div className="space-y-4">
                {mlPlan.explanation && (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded text-sm text-cyan-200 font-exo">
                    {mlPlan.explanation}
                  </div>
                )}
                
                {mlPlan.objective_scores && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(mlPlan.objective_scores).map(([key, value]) => (
                      <div key={key} className="bg-black/40 p-2 rounded border border-cyan-500/20">
                        <div className="text-xs text-cyan-300/70 font-exo capitalize">{key.replace('_', ' ')}</div>
                        <div className="text-lg font-semibold text-cyan-300 font-orbitron">{((value as number) * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {mlPlan.allocations.map(alloc => (
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

                <button
                  onClick={loadRealWorldPlan}
                  disabled={loading}
                  className="w-full mt-4 bg-cyan-600 text-white py-2 px-4 rounded hover:bg-cyan-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron"
                >
                  {loading ? 'Loading...' : 'Proceed to Stage 3: Real-World Response'}
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
