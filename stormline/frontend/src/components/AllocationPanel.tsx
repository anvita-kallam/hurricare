import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../state/useStore'
import axios from 'axios'

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
        initial[region] = cov ? cov.pooled_fund_budget : 0
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
      <div className="bg-white rounded-lg shadow-lg p-4">
        <h2 className="text-xl font-bold mb-4">Allocation Simulator</h2>
        <p className="text-gray-500">Select a hurricane to begin simulation</p>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Allocation Simulator</h2>
      <div className="text-sm text-gray-600 mb-4">
        Adjust budget allocations per region and simulate impact
      </div>
      
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {regions.map(region => {
          const cov = currentCoverage[region]
          const currentBudget = allocations[region] || 0
          const maxBudget = cov ? cov.estimated_need_budget * 1.5 : 10000000
          
          return (
            <div key={region} className="border rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-semibold">{region}</div>
                  {cov && (
                    <div className="text-xs text-gray-600">
                      Current: ${cov.pooled_fund_budget.toLocaleString()} • 
                      Need: ${cov.estimated_need_budget.toLocaleString()} • 
                      Coverage: {(cov.coverage_ratio * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium">
                  ${currentBudget.toLocaleString()}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={maxBudget}
                step={maxBudget / 100}
                value={currentBudget}
                onChange={(e) => handleAllocationChange(region, parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
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
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Running Simulation...' : 'Run Simulation'}
      </button>
      
      {simulationResult && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Simulation Results</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">Impact Score:</span> {simulationResult.impact_score.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Lives Covered:</span> {Math.round(simulationResult.lives_covered).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Vulnerability Reduction:</span> {(simulationResult.vulnerability_reduction * 100).toFixed(2)}%
            </div>
            <div>
              <span className="font-medium">Unmet Need:</span> {Math.round(simulationResult.unmet_need).toLocaleString()}
            </div>
            {simulationResult.comparison && (
              <div className="mt-2 pt-2 border-t">
                <div className="font-medium">Comparison to Current Allocation:</div>
                <div className="text-xs">
                  Current: {Math.round(simulationResult.comparison.current_lives_covered).toLocaleString()} lives
                </div>
                <div className="text-xs">
                  Simulated: {Math.round(simulationResult.comparison.simulated_lives_covered).toLocaleString()} lives
                </div>
                <div className={`text-xs font-semibold ${
                  simulationResult.comparison.improvement > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Improvement: {Math.round(simulationResult.comparison.improvement).toLocaleString()} lives
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
