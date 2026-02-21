import { useStore } from '../state/useStore'
import { 
  FundingVsNeedHeatmap, 
  SeverityVsFundingScatter, 
  RegionalHeatmap 
} from './DataVisualizations'

export default function ComparisonPage() {
  const { 
    selectedHurricane, 
    setSelectedHurricane,
    showComparisonPage,
    setShowComparisonPage,
    comparisonData 
  } = useStore()

  if (!comparisonData || !comparisonData.mlPlan || !comparisonData.realPlan) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-cyan-300 font-orbitron">Loading comparison data...</div>
      </div>
    )
  }

  const { mlPlan, realPlan, userPlan, mismatchAnalysis } = comparisonData

  const handleBackToGame = () => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }

  return (
    <div className="w-screen h-screen bg-black overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-cyan-500/30 p-4 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyan-200 font-orbitron">HurriCare</h1>
            <div className="text-sm text-cyan-300/70 font-exo">
              Comparison Dashboard: {selectedHurricane?.name} ({selectedHurricane?.year})
            </div>
          </div>
          <button
            onClick={handleBackToGame}
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 glow-cyan transition-all font-semibold font-orbitron"
          >
            Back to Game
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-6">
          {/* Ideal Plan Summary */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 p-6 rounded">
            <div className="font-semibold mb-4 text-cyan-200 font-orbitron text-xl">Ideal Plan (ML-Optimized)</div>
            <div className="space-y-3 text-sm font-exo">
              <div className="flex justify-between">
                <span className="text-cyan-300/70">Total Budget:</span>
                <span className="text-cyan-200 font-orbitron text-lg">${mlPlan.total_budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-300/70">People Covered:</span>
                <span className="text-cyan-200 font-orbitron text-lg">
                  {mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-300/70">Avg Coverage:</span>
                <span className="text-cyan-200 font-orbitron text-lg">
                  {(mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length * 100).toFixed(1)}%
                </span>
              </div>
              {mlPlan.objective_scores && (
                <div className="mt-4 pt-4 border-t border-cyan-500/30">
                  <div className="text-xs text-cyan-300/70 mb-3 font-orbitron">UN Values Performance:</div>
                  <div className="space-y-2">
                    {Object.entries(mlPlan.objective_scores).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-cyan-300/70 capitalize">{key.replace('_', ' ')}:</span>
                        <span className="text-cyan-200 font-orbitron">{(Number(value) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-World Plan Summary */}
          <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 p-6 rounded">
            <div className="font-semibold mb-4 text-red-200 font-orbitron text-xl">Real-World Response</div>
            <div className="space-y-3 text-sm font-exo">
              <div className="flex justify-between">
                <span className="text-red-300/70">Total Budget:</span>
                <span className="text-red-200 font-orbitron text-lg">${realPlan.total_budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-300/70">People Covered:</span>
                <span className="text-red-200 font-orbitron text-lg">
                  {realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-300/70">Avg Coverage:</span>
                <span className="text-red-200 font-orbitron text-lg">
                  {(realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gap Analysis */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded">
          <div className="font-semibold mb-4 text-yellow-200 font-orbitron text-xl">Funding Gap Analysis</div>
          <div className="grid grid-cols-3 gap-6 text-sm font-exo">
            <div>
              <div className="text-yellow-300/70 mb-2">Budget Difference:</div>
              <div className="text-2xl font-semibold text-yellow-200 font-orbitron">
                ${(mlPlan.total_budget - realPlan.total_budget).toLocaleString()}
              </div>
              <div className="text-xs text-yellow-300/70 mt-2">
                {((mlPlan.total_budget - realPlan.total_budget) / realPlan.total_budget * 100).toFixed(1)}% {mlPlan.total_budget > realPlan.total_budget ? 'more' : 'less'} than real-world
              </div>
            </div>
            <div>
              <div className="text-yellow-300/70 mb-2">People Coverage Gap:</div>
              <div className="text-2xl font-semibold text-yellow-200 font-orbitron">
                {(mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0) - 
                  realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0)).toLocaleString()}
              </div>
              <div className="text-xs text-yellow-300/70 mt-2">Additional people that could be covered</div>
            </div>
            <div>
              <div className="text-yellow-300/70 mb-2">Coverage Ratio Gap:</div>
              <div className="text-2xl font-semibold text-yellow-200 font-orbitron">
                {(() => {
                  const idealAvg = mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length
                  const realAvg = realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length
                  return ((idealAvg - realAvg) * 100).toFixed(1)
                })()}%
              </div>
              <div className="text-xs text-yellow-300/70 mt-2">Difference in average coverage</div>
            </div>
          </div>
        </div>

        {/* Regional Comparison Table */}
        <div className="bg-black/60 border border-cyan-500/20 p-6 rounded">
          <div className="text-lg font-semibold mb-4 text-cyan-200 font-orbitron">Regional Allocation Comparison</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm font-exo">
              <thead className="bg-black/60 sticky top-0">
                <tr className="border-b border-cyan-500/30">
                  <th className="text-left p-3 text-cyan-300 font-orbitron">Region</th>
                  <th className="text-right p-3 text-cyan-300 font-orbitron">Ideal Budget</th>
                  <th className="text-right p-3 text-cyan-300 font-orbitron">Real Budget</th>
                  <th className="text-right p-3 text-cyan-300 font-orbitron">Gap</th>
                  <th className="text-right p-3 text-cyan-300 font-orbitron">Ideal Coverage</th>
                  <th className="text-right p-3 text-cyan-300 font-orbitron">Real Coverage</th>
                </tr>
              </thead>
              <tbody>
                {realPlan.allocations.map((realAlloc: any) => {
                  const idealAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
                  const gap = idealAlloc ? idealAlloc.budget - realAlloc.budget : -realAlloc.budget
                  const gapPercent = realAlloc.budget > 0 ? (gap / realAlloc.budget) * 100 : 0
                  
                  return (
                    <tr key={realAlloc.region} className="border-b border-cyan-500/10 hover:bg-cyan-500/5">
                      <td className="p-3 text-cyan-200 font-semibold">{realAlloc.region}</td>
                      <td className="p-3 text-right text-cyan-300">
                        ${(idealAlloc?.budget || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-red-300">
                        ${realAlloc.budget.toLocaleString()}
                      </td>
                      <td className={`p-3 text-right font-orbitron ${
                        gap > 0 ? 'text-yellow-400' : gap < 0 ? 'text-green-400' : 'text-cyan-300'
                      }`}>
                        {gap > 0 ? '+' : ''}${gap.toLocaleString()}
                        <div className="text-xs text-cyan-300/70">
                          ({gap > 0 ? '+' : ''}{gapPercent.toFixed(0)}%)
                        </div>
                      </td>
                      <td className="p-3 text-right text-cyan-300">
                        {((idealAlloc?.coverage_estimate?.coverage_ratio || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right text-red-300">
                        {((realAlloc.coverage_estimate?.coverage_ratio || 0) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Visualizations */}
        {userPlan && (
          <div className="space-y-6">
            <div className="text-lg font-semibold text-cyan-200 font-orbitron">Visual Comparisons</div>
            
            <div className="bg-black/60 border border-cyan-500/20 p-6 rounded">
              <FundingVsNeedHeatmap 
                userPlan={userPlan} 
                mlPlan={mlPlan} 
                realPlan={realPlan} 
              />
            </div>
            
            <div className="bg-black/60 border border-cyan-500/20 p-6 rounded">
              <SeverityVsFundingScatter 
                userPlan={userPlan} 
                mlPlan={mlPlan} 
                realPlan={realPlan} 
              />
            </div>
            
            <div className="bg-black/60 border border-cyan-500/20 p-6 rounded">
              <RegionalHeatmap 
                userPlan={userPlan} 
                mlPlan={mlPlan} 
                realPlan={realPlan} 
              />
            </div>
          </div>
        )}

        {/* Mismatch Analysis */}
        {mismatchAnalysis && (
          <div className="bg-purple-500/10 border border-purple-500/30 p-6 rounded">
            <div className="font-semibold mb-4 text-purple-200 font-orbitron text-xl">Key Insights</div>
            {mismatchAnalysis.narrative && (
              <div className="text-sm text-purple-100 font-exo mb-6 whitespace-pre-line leading-relaxed">
                {mismatchAnalysis.narrative}
              </div>
            )}
            {mismatchAnalysis.overlooked_regions && mismatchAnalysis.overlooked_regions.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-3 text-purple-300 font-orbitron">Most Underfunded Regions:</div>
                <div className="grid grid-cols-2 gap-4">
                  {mismatchAnalysis.overlooked_regions.slice(0, 6).map((region: any, i: number) => (
                    <div key={i} className="bg-red-500/10 border border-red-500/30 p-4 rounded">
                      <div className="font-semibold text-red-200 mb-2">{region.region}</div>
                      <div className="text-xs text-red-300/70 space-y-1">
                        <div>Gap: {Math.abs((region.coverage_gap || 0) * 100).toFixed(0)}%</div>
                        <div>Missing: ${(region.ideal_budget - region.actual_budget).toLocaleString()}</div>
                        {region.unmet_need > 0 && (
                          <div>Unmet Need: {Math.round(region.unmet_need).toLocaleString()} people</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
