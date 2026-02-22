import { useState, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'
import {
  FundingVsNeedHeatmap,
  SeverityVsFundingScatter,
  RegionalHeatmap
} from './DataVisualizations'

const API_BASE = 'http://localhost:8000'

export default function ComparisonPage() {
  const {
    selectedHurricane,
    setSelectedHurricane,
    showComparisonPage,
    setShowComparisonPage,
    comparisonData
  } = useStore()

  const [apiKey, setApiKey] = useState<string>(() => {
    // Load from localStorage
    return localStorage.getItem('gemini_api_key') || ''
  })
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey)
  const [geminiInsights, setGeminiInsights] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  if (!comparisonData || !comparisonData.mlPlan || !comparisonData.realPlan) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-white/50 font-rajdhani">Loading comparison data...</div>
      </div>
    )
  }

  const { mlPlan, realPlan, userPlan, mismatchAnalysis } = comparisonData

  const handleBackToGame = () => {
    setShowComparisonPage(false)
    setSelectedHurricane(null)
  }

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim())
      setShowApiKeyInput(false)
    }
  }

  const handleGenerateInsights = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your Gemini API key first')
      setShowApiKeyInput(true)
      return
    }

    if (!comparisonData || !comparisonData.mlPlan || !comparisonData.realPlan) {
      alert('Comparison data is missing')
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await axios.post(`${API_BASE}/simulation/generate-insights`, {
        api_key: apiKey.trim(),
        hurricane_name: selectedHurricane?.name || 'Unknown',
        hurricane_year: selectedHurricane?.year || 'Unknown',
        ml_plan: comparisonData.mlPlan,
        real_plan: comparisonData.realPlan,
        user_plan: comparisonData.userPlan,
        mismatch_analysis: comparisonData.mismatchAnalysis
      })

      if (response.data.error) {
        setGenerationError(response.data.error)
      } else {
        setGeminiInsights(response.data.insights)
      }
    } catch (error: any) {
      console.error('Error generating insights:', error)
      setGenerationError(error.response?.data?.error || error.message || 'Failed to generate insights')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="w-screen h-screen bg-black overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-white/[0.06] p-4 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white/80 font-rajdhani">HurriCare</h1>
            <div className="text-sm text-white/50 font-rajdhani">
              Comparison Dashboard: {selectedHurricane?.name} ({selectedHurricane?.year})
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* API Key Input */}
            {showApiKeyInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Gemini API Key"
                  className="px-3 py-2 bg-black/60 border border-white/[0.1] rounded-sm text-white/90 text-sm font-mono focus:outline-none focus:border-white/[0.2]"
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveApiKey()}
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-2 bg-white/[0.1] text-white rounded-sm hover:bg-white/[0.15] text-sm font-rajdhani"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="px-3 py-2 text-white/50 hover:text-white/90 text-sm font-rajdhani border border-white/[0.06] rounded-sm hover:border-white/[0.1]"
              >
                {apiKey ? 'Change API Key' : 'Enter API Key'}
              </button>
            )}
            <button
              onClick={handleBackToGame}
              className="px-4 py-2 bg-white/[0.1] text-white rounded-sm hover:bg-white/[0.15] transition-all font-semibold font-rajdhani"
            >
              Back to Game
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Executive Summary for UN Representatives */}
        <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
          <h2 className="text-2xl font-bold text-white/80 font-rajdhani mb-4">Executive Summary for Crisis Intervention Planning</h2>
          <div className="text-white/90 font-rajdhani leading-relaxed space-y-3">
            <p>
              This comparison dashboard analyzes three distinct response scenarios for {selectedHurricane?.name} ({selectedHurricane?.year}):
              the ideal response plan optimized using United Nations humanitarian principles, the actual historical response that occurred,
              and your own allocation decisions. Understanding these differences is critical for improving future crisis intervention strategies.
            </p>
            <p>
              <strong className="text-white/80">Key Takeaway:</strong> The gaps between ideal and real-world responses reveal systemic
              challenges in humanitarian funding allocation. These insights can inform policy decisions, funding mechanisms, and operational
              protocols to ensure more equitable and effective crisis response in future emergencies.
            </p>
            <p>
              Each section below provides detailed analysis with actionable recommendations for UN representatives and humanitarian
              coordination teams. Use these insights to advocate for evidence-based resource allocation and to strengthen coordination
              mechanisms between pooled funds, implementing partners, and affected communities.
            </p>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-6">
          {/* Ideal Plan Summary */}
          <div className="bg-white/[0.03] border border-white/[0.06] p-6 rounded-sm">
            <div className="font-semibold mb-4 text-white/80 font-rajdhani text-xl">Ideal Plan (ML-Optimized)</div>
            <div className="text-xs text-white/50 mb-4 font-rajdhani leading-relaxed">
              This plan represents an optimal allocation strategy based on UN humanitarian principles (Humanity, Neutrality, Impartiality, Equity, Sustainability).
              It prioritizes reaching the most vulnerable populations while ensuring equitable distribution across all affected regions.
              <strong className="text-white/80"> For UN representatives:</strong> This serves as a benchmark for what is theoretically achievable
              with perfect information and unlimited coordination. Use this as a target for advocacy and to identify where systemic improvements
              could close the gap between ideal and actual response.
            </div>
            <div className="space-y-3 text-sm font-rajdhani">
              <div className="flex justify-between">
                <span className="text-white/50">Total Budget:</span>
                <span className="text-white/80 font-mono">${mlPlan.total_budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">People Covered:</span>
                <span className="text-white/80 font-mono">
                  {mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Avg Coverage:</span>
                <span className="text-white/80 font-mono">
                  {(mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length * 100).toFixed(1)}%
                </span>
              </div>
              {mlPlan.objective_scores && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="text-xs text-white/50 mb-3 font-rajdhani">UN Values Performance:</div>
                  <div className="space-y-2">
                    {Object.entries(mlPlan.objective_scores).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-white/50 capitalize">{key.replace('_', ' ')}:</span>
                        <span className="text-white/80 font-mono">{(Number(value) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-World Plan Summary */}
          <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
            <div className="font-semibold mb-4 text-white/60 font-rajdhani text-xl">Real-World Response</div>
            <div className="text-xs text-white/40 mb-4 font-rajdhani leading-relaxed">
              This reflects the actual historical response that occurred during {selectedHurricane?.name}. Real-world responses are constrained
              by political factors, funding availability, logistical challenges, security concerns, and coordination delays.
              <strong className="text-white/60"> For UN representatives:</strong> Understanding these constraints is essential for realistic planning.
              The differences between ideal and real-world responses highlight where advocacy, policy reform, or operational improvements could
              have the greatest impact. This is not a critique of past efforts, but rather a learning opportunity to strengthen future responses.
            </div>
            <div className="space-y-3 text-sm font-rajdhani">
              <div className="flex justify-between">
                <span className="text-white/40">Total Budget:</span>
                <span className="text-white/60 font-mono">${realPlan.total_budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">People Covered:</span>
                <span className="text-white/60 font-mono">
                  {realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Avg Coverage:</span>
                <span className="text-white/60 font-mono">
                  {(realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gap Analysis */}
        <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
          <div className="font-semibold mb-4 text-white/70 font-rajdhani text-xl">Funding Gap Analysis</div>
          <div className="text-sm text-white/70 mb-6 font-rajdhani leading-relaxed">
            <p className="mb-3">
              <strong className="text-white/70">Understanding Funding Gaps:</strong> The metrics below quantify the difference between
              what an ideal response would require and what was actually available. These gaps represent missed opportunities to save lives,
              reduce suffering, and protect vulnerable populations.
            </p>
            <p>
              <strong className="text-white/70">For Crisis Intervention Planning:</strong> Large gaps indicate regions or sectors where
              advocacy for additional funding could have the highest impact. When preparing for future crises, prioritize pre-positioning
              resources in areas that historically show the largest gaps. Additionally, these gaps can inform discussions with donor countries
              and pooled fund mechanisms about the true cost of effective humanitarian response.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm font-rajdhani">
            <div>
              <div className="text-white/45 mb-2">Budget Difference:</div>
              <div className="text-2xl font-semibold text-white/70 font-mono">
                ${(mlPlan.total_budget - realPlan.total_budget).toLocaleString()}
              </div>
              <div className="text-xs text-white/45 mt-2 mb-3">
                {((mlPlan.total_budget - realPlan.total_budget) / realPlan.total_budget * 100).toFixed(1)}% {mlPlan.total_budget > realPlan.total_budget ? 'more' : 'less'} than real-world
              </div>
              <div className="text-xs text-white/70 font-rajdhani leading-relaxed">
                <strong>Interpretation:</strong> This represents the additional funding that would have been needed to achieve ideal coverage.
                A positive gap suggests the real-world response was underfunded relative to need. For UN coordination, this metric helps
                quantify funding requests and demonstrates the return on investment of additional resources.
              </div>
            </div>
            <div>
              <div className="text-white/45 mb-2">People Coverage Gap:</div>
              <div className="text-2xl font-semibold text-white/70 font-mono">
                {(mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0) -
                  realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0)).toLocaleString()}
              </div>
              <div className="text-xs text-white/45 mt-2 mb-3">Additional people that could be covered</div>
              <div className="text-xs text-white/70 font-rajdhani leading-relaxed">
                <strong>Interpretation:</strong> This is the human cost of the funding gap—the number of individuals who could have received
                assistance with ideal resource allocation. For humanitarian advocacy, this metric translates abstract budget numbers into
                concrete human impact, making it a powerful tool for donor engagement and public awareness campaigns.
              </div>
            </div>
            <div>
              <div className="text-white/45 mb-2">Coverage Ratio Gap:</div>
              <div className="text-2xl font-semibold text-white/70 font-mono">
                {(() => {
                  const idealAvg = mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length
                  const realAvg = realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length
                  return ((idealAvg - realAvg) * 100).toFixed(1)
                })()}%
              </div>
              <div className="text-xs text-white/45 mt-2 mb-3">Difference in average coverage</div>
              <div className="text-xs text-white/70 font-rajdhani leading-relaxed">
                <strong>Interpretation:</strong> This percentage shows how much more of the affected population could have been reached.
                A higher gap indicates systemic under-coverage. For operational planning, this metric helps identify where coordination
                mechanisms or resource mobilization strategies need strengthening to improve reach and effectiveness.
              </div>
            </div>
          </div>
        </div>

        {/* Regional Comparison Table */}
        <div className="bg-black/60 border border-white/[0.04] p-6 rounded-sm">
          <div className="font-semibold mb-4 text-white/80 font-rajdhani">Regional Allocation Comparison</div>
          <div className="text-sm text-white/80 mb-6 font-rajdhani leading-relaxed">
            <p className="mb-3">
              <strong className="text-white/90">Regional Disparities Analysis:</strong> This table reveals how funding was distributed
              across different administrative regions. Significant variations between ideal and real-world allocations indicate where
              geographic equity was compromised, often due to accessibility challenges, political considerations, or coordination gaps.
            </p>
            <p>
              <strong className="text-white/90">For UN Coordination:</strong> Regions with large negative gaps (underfunded) should be
              prioritized in future response planning. Consider pre-positioning resources, strengthening local partnerships, and developing
              alternative access routes. Regions with positive gaps may indicate over-allocation—analyze whether this was due to media
              attention, political pressure, or legitimate need assessment differences. Use this data to advocate for needs-based rather
              than visibility-based funding decisions.
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm font-rajdhani">
              <thead className="bg-black/60 sticky top-0">
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-3 text-white/50 font-rajdhani">Region</th>
                  <th className="text-right p-3 text-white/50 font-rajdhani">Ideal Budget</th>
                  <th className="text-right p-3 text-white/50 font-rajdhani">Real Budget</th>
                  <th className="text-right p-3 text-white/50 font-rajdhani">Gap</th>
                  <th className="text-right p-3 text-white/50 font-rajdhani">Ideal Coverage</th>
                  <th className="text-right p-3 text-white/50 font-rajdhani">Real Coverage</th>
                </tr>
              </thead>
              <tbody>
                {realPlan.allocations.map((realAlloc: any) => {
                  const idealAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
                  const gap = idealAlloc ? idealAlloc.budget - realAlloc.budget : -realAlloc.budget
                  const gapPercent = realAlloc.budget > 0 ? (gap / realAlloc.budget) * 100 : 0

                  return (
                    <tr key={realAlloc.region} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="p-3 text-white/80 font-semibold">{realAlloc.region}</td>
                      <td className="p-3 text-right text-white/50 font-mono">
                        ${(idealAlloc?.budget || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-white/40 font-mono">
                        ${realAlloc.budget.toLocaleString()}
                      </td>
                      <td className={`p-3 text-right font-mono ${
                        gap > 0 ? 'text-white/35' : gap < 0 ? 'text-white/50' : 'text-white/50'
                      }`}>
                        {gap > 0 ? '+' : ''}${gap.toLocaleString()}
                        <div className="text-xs text-white/50">
                          ({gap > 0 ? '+' : ''}{gapPercent.toFixed(0)}%)
                        </div>
                      </td>
                      <td className="p-3 text-right text-white/50 font-mono">
                        {((idealAlloc?.coverage_estimate?.coverage_ratio || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right text-white/40 font-mono">
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
            <div className="font-semibold text-white/80 font-rajdhani mb-4">Visual Comparisons</div>
            <div className="text-sm text-white/80 mb-6 font-rajdhani leading-relaxed bg-white/[0.01] border border-white/[0.04] p-4 rounded-sm">
              <p>
                <strong className="text-white/90">Using Visualizations for Crisis Intervention:</strong> The charts below provide
                intuitive representations of complex allocation patterns. They help identify trends that may not be immediately apparent
                in tabular data, such as correlations between severity and funding, or regional clustering of underfunded areas.
                <strong className="text-white/90"> For UN representatives:</strong> These visuals are powerful communication tools for
                briefings, donor meetings, and coordination forums. They can help stakeholders quickly understand where interventions
                are most needed and where resource reallocation could improve outcomes.
              </p>
            </div>

            <div className="bg-black/60 border border-white/[0.04] p-6 rounded-sm">
              <FundingVsNeedHeatmap
                userPlan={userPlan}
                mlPlan={mlPlan}
                realPlan={realPlan}
              />
            </div>

            <div className="bg-black/60 border border-white/[0.04] p-6 rounded-sm">
              <SeverityVsFundingScatter
                userPlan={userPlan}
                mlPlan={mlPlan}
                realPlan={realPlan}
              />
            </div>

            <div className="bg-black/60 border border-white/[0.04] p-6 rounded-sm">
              <RegionalHeatmap
                userPlan={userPlan}
                mlPlan={mlPlan}
                realPlan={realPlan}
              />
            </div>
          </div>
        )}

        {/* AI-Generated Insights */}
        <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold text-white/65 font-rajdhani text-xl">AI-Generated Insights (Gemini)</div>
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating || !apiKey.trim()}
              className="px-4 py-2 bg-white/[0.1] hover:bg-white/[0.15] text-white rounded-sm font-semibold font-rajdhani transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Insights'}
            </button>
          </div>

          {/* API Key Input Section - Prominent */}
          {showApiKeyInput && (
            <div className="mb-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-sm">
              <div className="text-white/65 font-semibold mb-3 font-rajdhani">Enter Your Gemini API Key</div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Gemini API key here"
                  className="flex-1 px-4 py-3 bg-black/60 border border-white/[0.1] rounded-sm text-white/90 font-mono focus:outline-none focus:border-white/[0.2]"
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveApiKey()}
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-sm font-semibold font-rajdhani transition-all"
                >
                  Save Key
                </button>
              </div>
              <div className="text-xs text-white/40 font-rajdhani">
                Get your API key from{' '}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/65 hover:text-white/75 underline"
                >
                  Google AI Studio
                </a>
                . Your key is stored locally in your browser and only used to generate insights.
              </div>
            </div>
          )}

          {!showApiKeyInput && apiKey && (
            <div className="mb-4 text-xs text-white/40 font-rajdhani">
              API key saved. Click{' '}
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-white/65 hover:text-white/75 underline"
              >
                here
              </button>
              {' '}to change it.
            </div>
          )}

          {!apiKey.trim() && !showApiKeyInput && (
            <div className="text-white/45 text-sm font-rajdhani mb-4 p-3 bg-white/[0.02] border border-white/[0.06] rounded-sm">
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-white/70 hover:text-white/90 underline font-semibold"
              >
                Click here to enter your Gemini API key
              </button>
              {' '}to generate AI-powered insights. Get your key from{' '}
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white/90 underline"
              >
                Google AI Studio
              </a>
              .
            </div>
          )}

          {generationError && (
            <div className="text-white/40 text-sm font-rajdhani mb-4 p-3 bg-white/[0.02] border border-white/[0.06] rounded-sm">
              Error: {generationError}
            </div>
          )}

          {geminiInsights && (
            <div className="text-white/75 font-rajdhani leading-relaxed whitespace-pre-line bg-black/40 p-6 rounded-sm border border-white/[0.04]">
              {geminiInsights}
            </div>
          )}

          {!geminiInsights && !isGenerating && (
            <div className="text-white/40 text-sm font-rajdhani italic">
              Click "Generate Insights" to create AI-powered analysis tailored for UN representatives.
            </div>
          )}
        </div>

        {/* Mismatch Analysis (Fallback) */}
        {mismatchAnalysis && (
          <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
            <div className="font-semibold mb-4 text-white/65 font-rajdhani text-xl">Key Insights & Actionable Recommendations (Pre-Generated)</div>
            <div className="text-sm text-white/65 mb-6 font-rajdhani leading-relaxed bg-white/[0.02] border border-white/[0.04] p-4 rounded-sm">
              <p className="mb-3">
                <strong className="text-white/75">How to Use These Insights:</strong> The analysis below synthesizes patterns across
                all three response scenarios to identify systemic issues and opportunities for improvement. These insights are designed
                to inform strategic decision-making at the policy, coordination, and operational levels.
              </p>
              <p>
                <strong className="text-white/75">For UN Crisis Intervention:</strong> Use these insights to develop advocacy messages,
                inform pooled fund allocation strategies, strengthen coordination mechanisms, and guide capacity-building initiatives.
                Share these findings with country teams, implementing partners, and donor governments to build consensus around
                evidence-based resource allocation approaches.
              </p>
            </div>
            {mismatchAnalysis.narrative && (
              <div className="text-sm text-white/75 font-rajdhani mb-6 whitespace-pre-line leading-relaxed bg-black/40 p-4 rounded-sm border border-white/[0.04]">
                <div className="font-semibold text-white/65 mb-2 font-rajdhani">Detailed Analysis:</div>
                {mismatchAnalysis.narrative}
              </div>
            )}
            {mismatchAnalysis.overlooked_regions && mismatchAnalysis.overlooked_regions.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-3 text-white/40 font-rajdhani">Most Underfunded Regions:</div>
                <div className="text-xs text-white/65 mb-4 font-rajdhani leading-relaxed">
                  <p>
                    <strong className="text-white/75">Critical Action Items:</strong> The regions listed below represent the highest
                    priority areas for intervention in future crises. These regions experienced the largest gaps between ideal and actual
                    funding, indicating systemic barriers to equitable resource distribution. For UN coordination teams, these regions
                    should be flagged for enhanced monitoring, pre-positioned resources, strengthened local partnerships, and dedicated
                    advocacy efforts. Consider establishing early warning systems and rapid response mechanisms specifically for these
                    historically overlooked areas.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {mismatchAnalysis.overlooked_regions.slice(0, 6).map((region: any, i: number) => (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-sm">
                      <div className="font-semibold text-white/60 mb-2">{region.region}</div>
                      <div className="text-xs text-white/30 space-y-1 mb-3">
                        <div>Gap: {Math.abs((region.coverage_gap || 0) * 100).toFixed(0)}%</div>
                        <div>Missing: ${(region.ideal_budget - region.actual_budget).toLocaleString()}</div>
                        {region.unmet_need > 0 && (
                          <div>Unmet Need: {Math.round(region.unmet_need).toLocaleString()} people</div>
                        )}
                      </div>
                      <div className="text-xs text-white/60 font-rajdhani leading-relaxed border-t border-white/[0.04] pt-2">
                        <strong>Intervention Strategy:</strong> This region requires targeted advocacy for additional funding,
                        enhanced coordination mechanisms, and potentially alternative delivery modalities (e.g., cash-based assistance,
                        local procurement) to overcome access or security constraints that may have limited the original response.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conclusion and Next Steps */}
        <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-sm">
          <h2 className="text-xl font-bold text-white/80 font-rajdhani mb-4">Conclusion & Recommendations for Future Crisis Intervention</h2>
          <div className="text-white/90 font-rajdhani leading-relaxed space-y-4">
            <div>
              <strong className="text-white/80">1. Advocacy & Resource Mobilization:</strong> Use the funding gap analysis to develop
              evidence-based funding requests. Present the human impact (people coverage gap) alongside budget requirements to make
              a compelling case for additional resources. Engage with pooled fund mechanisms, donor governments, and private sector
              partners to close identified gaps.
            </div>
            <div>
              <strong className="text-white/80">2. Coordination & Partnership Strengthening:</strong> The regional disparities highlight
              where coordination mechanisms need improvement. Establish stronger partnerships with local organizations in underfunded
              regions, as they often have better access and community trust. Develop contingency plans that address historical
              coordination failures.
            </div>
            <div>
              <strong className="text-white/80">3. Operational Preparedness:</strong> Pre-position resources and establish rapid
              response mechanisms in regions that consistently show large gaps. This includes prepositioning supplies, establishing
              local partnerships, and developing alternative access routes for when traditional channels are compromised.
            </div>
            <div>
              <strong className="text-white/80">4. Policy & System Reform:</strong> Use these insights to advocate for policy changes
              that address systemic barriers. This may include reforming pooled fund allocation criteria, improving needs assessment
              methodologies, or establishing minimum coverage standards that ensure no region falls below a threshold of support.
            </div>
            <div>
              <strong className="text-white/80">5. Learning & Accountability:</strong> Share these findings with implementing partners,
              donor governments, and affected communities. Transparency about gaps and challenges builds trust and creates accountability
              for improved performance in future responses. Use this analysis to inform training programs and capacity-building initiatives.
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-sm text-white/80">
                <strong>Remember:</strong> This analysis is not intended to criticize past efforts, but rather to learn from experience
                and strengthen future humanitarian responses. Every crisis presents unique challenges, and the goal is continuous improvement
                in our collective ability to save lives and reduce suffering.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
