import { useStore } from '../state/useStore'
import ComparisonHeatmaps from './ComparisonHeatmaps'
import { 
  FundingVsNeedHeatmap, 
  CoverageGapChart, 
  RegionalHeatmap, 
  OutcomeRadarChart,
  SeverityVsFundingScatter 
} from './DataVisualizations'

export default function ComparisonPage() {
  const { 
    selectedHurricane, 
    setSelectedHurricane, 
    setShowComparisonPage,
    narrativePopup,
    setNarrativePopup
  } = useStore()
  
  // Get plans from localStorage or state - for now we'll need to pass them as props
  // For MVP, we'll store them in the store or pass via context
  // For now, let's get them from a ref or state that persists
  
  // This is a placeholder - in a real implementation, you'd get these from the store or props
  const userPlan = null
  const mlPlan = null
  const realPlan = null
  const mismatchAnalysis = null
  
  const handleBack = () => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }
  
  if (!userPlan || !mlPlan || !realPlan) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-300 font-orbitron">Loading comparison data...</div>
      </div>
    )
  }
  
  return (
    <div className="w-screen h-screen bg-black overflow-y-auto">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-cyan-500/30 p-4 flex justify-between items-center">
        <h3 className="text-3xl font-bold text-cyan-200 font-orbitron">Comparison Dashboard</h3>
        <button
          onClick={handleBack}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold font-orbitron glow-cyan transition-all flex items-center gap-2"
        >
          <span>🔄</span>
          <span>Back to Hurricane Selector</span>
        </button>
      </div>
      
      <div className="w-full p-6 space-y-6">
        <div className="bg-black/80 p-6 rounded-lg border-2 border-cyan-500/50 glow-cyan">
          {/* Narrative Summary */}
          {mismatchAnalysis?.narrative && (
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 p-4 rounded mb-4 text-sm text-yellow-100 font-exo glow-yellow">
              <div className="font-semibold mb-2 text-yellow-200 font-orbitron">Key Insights</div>
              <p>{mismatchAnalysis.narrative}</p>
            </div>
          )}

          {/* Metrics Comparison */}
          <div className="mb-6">
            <div className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Outcome Comparison</div>
            <div className="grid grid-cols-3 gap-4">
              {/* User Plan Metrics */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded">
                <div className="font-semibold mb-3 text-cyan-300 font-orbitron">Your Plan</div>
                <div className="space-y-2 text-xs font-exo">
                  <div>
                    <div className="text-cyan-300/70">People Covered:</div>
                    <div className="text-cyan-200 font-orbitron">
                      {userPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-cyan-300/70">Total Budget:</div>
                    <div className="text-cyan-200 font-orbitron">
                      ${userPlan.total_budget.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-cyan-300/70">Avg Coverage:</div>
                    <div className="text-cyan-200 font-orbitron">
                      {(userPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / userPlan.allocations.length * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* ML Ideal Plan Metrics */}
              <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded">
                <div className="font-semibold mb-3 text-purple-300 font-orbitron">ML Ideal Plan</div>
                <div className="space-y-2 text-xs font-exo">
                  <div>
                    <div className="text-purple-300/70">People Covered:</div>
                    <div className="text-purple-200 font-orbitron">
                      {mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-purple-300/70">Total Budget:</div>
                    <div className="text-purple-200 font-orbitron">
                      ${mlPlan.total_budget.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-purple-300/70">Avg Coverage:</div>
                    <div className="text-purple-200 font-orbitron">
                      {(mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length * 100).toFixed(1)}%
                    </div>
                  </div>
                  {mlPlan.objective_scores && (
                    <div>
                      <div className="text-purple-300/70">Humanity Score:</div>
                      <div className="text-purple-200 font-orbitron">
                        {((mlPlan.objective_scores.humanity || 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Real-World Plan Metrics */}
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded">
                <div className="font-semibold mb-3 text-red-300 font-orbitron">Real-World</div>
                <div className="space-y-2 text-xs font-exo">
                  <div>
                    <div className="text-red-300/70">People Covered:</div>
                    <div className="text-red-200 font-orbitron">
                      {realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-red-300/70">Total Budget:</div>
                    <div className="text-red-200 font-orbitron">
                      ${realPlan.total_budget.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-red-300/70">Avg Coverage:</div>
                    <div className="text-red-200 font-orbitron">
                      {(realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mismatch Metrics */}
          {mismatchAnalysis && (
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Mismatch Metrics</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded">
                  <div className="text-xs text-yellow-300/70 font-exo mb-1">Coverage Gap</div>
                  <div className="text-lg font-semibold text-yellow-300 font-orbitron">
                    {mismatchAnalysis.comparison?.differences?.coverage_diff ? 
                      (Math.abs(mismatchAnalysis.comparison.differences.coverage_diff) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded">
                  <div className="text-xs text-orange-300/70 font-exo mb-1">Equity Deviation</div>
                  <div className="text-lg font-semibold text-orange-300 font-orbitron">
                    {(mismatchAnalysis.equity_deviation * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded">
                  <div className="text-xs text-red-300/70 font-exo mb-1">Efficiency Loss</div>
                  <div className="text-lg font-semibold text-red-300 font-orbitron">
                    {(mismatchAnalysis.efficiency_loss * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Heatmaps */}
          <div className="mb-6 h-[600px]">
            <ComparisonHeatmaps 
              userPlan={userPlan}
              mlPlan={mlPlan}
              realPlan={realPlan}
              selectedHurricane={selectedHurricane}
            />
          </div>
          
          {/* Other Data Visualizations */}
          <div className="space-y-4 mb-6">
            <CoverageGapChart 
              userPlan={userPlan} 
              mlPlan={mlPlan} 
              realPlan={realPlan} 
            />
            
            <OutcomeRadarChart 
              userPlan={userPlan} 
              mlPlan={mlPlan} 
              realPlan={realPlan}
              mismatchAnalysis={mismatchAnalysis}
            />
            
            <SeverityVsFundingScatter 
              userPlan={userPlan} 
              mlPlan={mlPlan} 
              realPlan={realPlan} 
            />
          </div>

          {/* Regional Comparison Table */}
          <div className="mb-6">
            <div className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Regional Allocation Comparison</div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs font-exo">
                <thead className="bg-black/60 sticky top-0">
                  <tr className="border-b border-cyan-500/30">
                    <th className="text-left p-2 text-cyan-300 font-orbitron">Region</th>
                    <th className="text-right p-2 text-cyan-300 font-orbitron">Your Plan</th>
                    <th className="text-right p-2 text-cyan-300 font-orbitron">ML Ideal</th>
                    <th className="text-right p-2 text-cyan-300 font-orbitron">Real-World</th>
                    <th className="text-right p-2 text-cyan-300 font-orbitron">Gap (Ideal vs Real)</th>
                  </tr>
                </thead>
                <tbody>
                  {realPlan.allocations.map((realAlloc: any) => {
                    const userAlloc = userPlan.allocations.find((a: any) => a.region === realAlloc.region)
                    const mlAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
                    const gap = mlAlloc ? mlAlloc.budget - realAlloc.budget : 0
                    const gapPercent = realAlloc.budget > 0 ? (gap / realAlloc.budget) * 100 : 0
                    
                    return (
                      <tr key={realAlloc.region} className="border-b border-cyan-500/10 hover:bg-cyan-500/5">
                        <td className="p-2 text-cyan-200">{realAlloc.region}</td>
                        <td className="p-2 text-right text-cyan-300">
                          ${(userAlloc?.budget || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-right text-purple-300">
                          ${(mlAlloc?.budget || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-right text-red-300">
                          ${realAlloc.budget.toLocaleString()}
                        </td>
                        <td className={`p-2 text-right font-orbitron ${
                          gap > 0 ? 'text-red-400' : gap < 0 ? 'text-green-400' : 'text-cyan-300'
                        }`}>
                          {gap > 0 ? '↓' : gap < 0 ? '↑' : '='} {Math.abs(gapPercent).toFixed(0)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Most Overlooked Regions */}
          {mismatchAnalysis?.overlooked_regions && mismatchAnalysis.overlooked_regions.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 text-red-300 font-orbitron">Most Underfunded Regions</div>
              <div className="space-y-2">
                {mismatchAnalysis.overlooked_regions.slice(0, 5).map((region: any, i: number) => {
                  const gap = region.ideal_budget - region.actual_budget
                  const gapPercent = region.coverage_gap * 100
                  
                  return (
                    <div key={i} className="bg-red-500/10 border border-red-500/30 p-3 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-red-200 font-exo font-semibold">{region.region}</span>
                        <div className="text-xs text-red-300 font-orbitron">
                          Gap: {Math.abs(gapPercent).toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-xs text-red-300/70 font-exo mt-1">
                        Real: ${region.actual_budget.toLocaleString()} • 
                        Ideal: ${region.ideal_budget.toLocaleString()} • 
                        Missing: ${gap.toLocaleString()}
                      </div>
                      {region.unmet_need > 0 && (
                        <div className="text-xs text-red-400/80 font-exo mt-1">
                          Additional Unmet Need: {Math.round(region.unmet_need).toLocaleString()} people
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Download Report Button */}
          <button
            onClick={() => {
              const report = {
                hurricane: selectedHurricane?.name,
                user_plan: userPlan,
                ml_ideal_plan: mlPlan,
                real_world_plan: realPlan,
                mismatch_analysis: mismatchAnalysis,
                generated_at: new Date().toISOString()
              }
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `hurricare_comparison_${selectedHurricane?.id}_${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 px-4 rounded hover:from-cyan-700 hover:to-blue-700 glow-cyan transition-all font-semibold font-orbitron"
          >
            📥 Download Comparison Report (JSON)
          </button>
        </div>
      </div>
    </div>
  )
}
