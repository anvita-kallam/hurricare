import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../state/useStore'
import axios from 'axios'
import { playSliderStretch } from '../audio/SoundEngine'

const API_BASE = 'http://localhost:8000'

export default function AllocationPanel() {
  const { selectedHurricane, coverage } = useStore()
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [simulationResult, setSimulationResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const regions = useMemo(() => {
    if (!selectedHurricane) return []
    return coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => c.admin1)
      .filter((v, i, a) => a.indexOf(v) === i)
  }, [selectedHurricane, coverage])
  
  useEffect(() => {
    if (regions.length > 0) {
      const initial: Record<string, number> = {}
      regions.forEach(region => {
        const cov = coverage.find(c => c.admin1 === region && c.hurricane_id === selectedHurricane?.id)
        // Start with 10% of estimated need budget as default
        initial[region] = cov ? Math.round(cov.estimated_need_budget * 0.1) : 0
      })
      setAllocations(initial)
    }
  }, [regions, coverage, selectedHurricane])
  
  const handleAllocationChange = (region: string, value: number) => {
    setAllocations(prev => ({
      ...prev,
      [region]: Math.max(0, value)
    }))
  }
  
  const runSimulation = async () => {
    if (!selectedHurricane) return
    
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/simulate_allocation`, {
        hurricane_id: selectedHurricane.id,
        allocations
      })
      setSimulationResult(response.data)
    } catch (error) {
      console.error('Simulation error:', error)
    } finally {
      setLoading(false)
    }
  }
  
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
  
  if (!selectedHurricane) {
    return (
      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 glow-cyan">
        <h2 className="text-xl font-bold mb-4 text-glow-cyan font-orbitron">Allocation Simulator</h2>
        <p className="text-cyan-300/80 font-exo">Select a hurricane to begin simulation</p>
      </div>
    )
  }
  
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 h-full flex flex-col glow-cyan">
      <h2 className="text-xl font-bold mb-4 text-glow-cyan font-orbitron">Allocation Simulator</h2>
      <div className="text-sm text-cyan-300/80 mb-4 font-exo">
        Adjust budget allocations per region and simulate impact
      </div>
      
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {regions.map(region => {
          const cov = currentCoverage[region]
          const currentBudget = allocations[region] || 0
          const maxBudget = cov ? cov.estimated_need_budget * 1.5 : 10000000
          
          return (
            <div key={region} className="border border-cyan-500/30 rounded p-3 bg-black/40 backdrop-blur-sm glow-cyan">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-semibold text-cyan-200">{region}</div>
                  {cov && (
                    <div className="text-xs text-cyan-300/70">
                      Current: ${cov.pooled_fund_budget.toLocaleString()} • 
                      Need: ${cov.estimated_need_budget.toLocaleString()} • 
                      Coverage: {(cov.coverage_ratio * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-cyan-200">
                  ${currentBudget.toLocaleString()}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={maxBudget}
                step={maxBudget / 100}
                value={currentBudget}
                onChange={(e) => {
                  handleAllocationChange(region, parseFloat(e.target.value))
                  playSliderStretch()
                }}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-cyan-400/60 mt-1">
                <span>$0</span>
                <span>${maxBudget.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
      
      <button
        onClick={runSimulation}
        disabled={loading}
        className="w-full bg-cyan-600 text-white py-2 px-4 rounded hover:bg-cyan-700 disabled:bg-gray-600 disabled:text-gray-400 glow-cyan transition-all font-semibold font-orbitron"
      >
        {loading ? 'Running Simulation...' : 'Run Simulation'}
      </button>
      
      {simulationResult && (
        <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded space-y-3 glow-cyan backdrop-blur-sm">
          <h3 className="font-semibold mb-2 text-glow-cyan font-orbitron">Simulation Results</h3>
          
          {/* Overall Impact Score */}
          <div className="pb-2 border-b border-cyan-500/30">
            <div className="text-lg font-bold text-glow-cyan">
              Impact Score: {simulationResult.impact_score.toFixed(0).toLocaleString()}
            </div>
          </div>
          
          {/* Hard Priorities (Non-negotiable) */}
          {simulationResult.hard_priorities && (
            <div className="pb-2 border-b border-cyan-500/30">
              <div className="font-semibold text-red-400 mb-1 glow">Hard Priorities (Non-negotiable):</div>
              <div className="text-xs space-y-1 pl-2 text-cyan-200">
                <div>
                  <span className="font-medium text-cyan-300">Lives Saved:</span> {Math.round(simulationResult.hard_priorities.lives_saved).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium text-cyan-300">Suffering Reduced:</span> {Math.round(simulationResult.hard_priorities.suffering_reduced).toLocaleString()} people
                </div>
                <div>
                  <span className="font-medium text-cyan-300">Vulnerable Protected:</span> {Math.round(simulationResult.hard_priorities.vulnerable_protected).toLocaleString()} people
                </div>
              </div>
            </div>
          )}
          
          {/* Soft Priorities (Trade-offs) */}
          {simulationResult.soft_priorities && (
            <div className="pb-2 border-b border-cyan-500/30">
              <div className="font-semibold text-orange-400 mb-1 glow">Soft Priorities (Trade-offs):</div>
              <div className="text-xs space-y-1 pl-2 text-cyan-200">
                <div>
                  <span className="font-medium text-cyan-300">Economic Loss Reduction:</span> ${Math.round(simulationResult.soft_priorities.economic_loss_reduction).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium text-cyan-300">Resource Efficiency:</span> {simulationResult.soft_priorities.resource_efficiency.toFixed(2)}
                </div>
              </div>
            </div>
          )}
          
          {/* Constraints */}
          {simulationResult.constraints && (
            <div className="pb-2 border-b border-cyan-500/30">
              <div className="font-semibold text-yellow-400 mb-1 glow">Constraints (Penalties):</div>
              <div className="text-xs space-y-1 pl-2 text-cyan-200">
                <div>
                  <span className="font-medium text-cyan-300">Logistics Penalty:</span> {(simulationResult.constraints.logistics_penalty * 100).toFixed(1)}%
                </div>
                <div>
                  <span className="font-medium text-cyan-300">Access/Security Penalty:</span> {(simulationResult.constraints.access_penalty * 100).toFixed(1)}%
                </div>
                <div className="font-semibold text-cyan-200">
                  <span className="font-medium">Total Constraint Impact:</span> {(simulationResult.constraints.total_penalty * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
          
          {/* Unmet Need */}
          <div className="pb-2 border-b border-cyan-500/30">
            <div className="font-semibold text-cyan-300 mb-1">Critical Metrics:</div>
            <div className="text-xs space-y-1 pl-2 text-cyan-200">
              <div>
                <span className="font-medium text-cyan-300">Unmet Need:</span> {Math.round(simulationResult.unmet_need).toLocaleString()} people
              </div>
            </div>
          </div>
          
          {/* Comparison */}
          {simulationResult.comparison && (
            <div>
              <div className="font-semibold mb-1 text-cyan-200">Comparison to Current Allocation:</div>
              <div className="text-xs space-y-1 pl-2 text-cyan-200">
                <div>
                  Current: {Math.round(simulationResult.comparison.current_lives_covered).toLocaleString()} lives saved
                </div>
                <div>
                  Simulated: {Math.round(simulationResult.comparison.simulated_lives_covered).toLocaleString()} lives saved
                </div>
                <div className={`font-semibold ${
                  simulationResult.comparison.improvement > 0 ? 'text-green-400 glow-green' : 'text-red-400 glow'
                }`}>
                  Improvement: {Math.round(simulationResult.comparison.improvement).toLocaleString()} lives
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
