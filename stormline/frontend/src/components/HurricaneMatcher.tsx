import { useState } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'
// Slider audio removed — sliders must be silent

const API_BASE = 'http://localhost:8000'

interface HurricaneMatcherProps {
  onMatchFound: (hurricaneId: string) => void
  onSkip: () => void
}

export default function HurricaneMatcher({ onMatchFound, onSkip }: HurricaneMatcherProps) {
  const [region, setRegion] = useState('')
  const [category, setCategory] = useState(3)
  const [direction, setDirection] = useState<string>('')
  const [extraDetails, setExtraDetails] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [matchResult, setMatchResult] = useState<any>(null)
  const { setSelectedHurricane, hurricanes } = useStore()

  const handleSearch = async () => {
    if (!region.trim()) {
      alert('Please enter a region')
      return
    }

    setIsSearching(true)
    try {
      const params: any = {
        region: region.trim(),
        category: category
      }
      if (direction) {
        params.direction = direction
      }
      
      const response = await axios.get(`${API_BASE}/hurricanes/match`, { params })
      setMatchResult(response.data)
    } catch (error) {
      console.error('Error finding matching hurricane:', error)
      alert('Error finding matching hurricane. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectMatch = () => {
    if (matchResult?.match) {
      const hurricane = hurricanes.find(h => h.id === matchResult.match.id)
      if (hurricane) {
        setSelectedHurricane(hurricane)
        onMatchFound(matchResult.match.id)
      }
    }
  }

  const handleSelectAlternative = (altHurricane: any) => {
    const hurricane = hurricanes.find(h => h.id === altHurricane.id)
    if (hurricane) {
      setSelectedHurricane(hurricane)
      onMatchFound(altHurricane.id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-black/80 border-2 border-white/[0.08] rounded-lg p-8 max-w-2xl w-full mx-4">
        <h2 className="text-3xl font-bold font-rajdhani mb-6 text-center">
          Find Matching Hurricane
        </h2>
        
        <p className="text-white/60 font-rajdhani mb-6 text-center">
          Enter a region and category to find the most similar historical hurricane
        </p>

        <div className="space-y-6">
          {/* Region Input */}
          <div>
            <label className="block text-white/50 font-rajdhani mb-2">
              Region / Country
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g., United States, Jamaica, Philippines, Caribbean"
              className="w-full px-4 py-3 bg-black/60 border border-white/[0.08] rounded-lg text-white/70 font-rajdhani focus:outline-none focus:border-white/20"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Category Input */}
          <div>
            <label className="block text-white/50 font-rajdhani mb-2">
              Category: {category}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={category}
              onChange={(e) => {
                setCategory(parseInt(e.target.value))
              }}
              className="w-full h-2 bg-white/[0.04] rounded-lg appearance-none cursor-pointer accent-white/60"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1 font-rajdhani">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Direction Input (Optional) */}
          <div>
            <label className="block text-white/50 font-rajdhani mb-2">
              Direction (Optional)
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-4 py-3 bg-black/60 border border-white/[0.08] rounded-lg text-white/70 font-rajdhani focus:outline-none focus:border-white/20"
            >
              <option value="">Select direction...</option>
              <option value="north">North</option>
              <option value="east">East</option>
              <option value="south">South</option>
              <option value="west">West</option>
            </select>
          </div>

          {/* Extra Details (Optional, doesn't affect matching) */}
          <div>
            <label className="block text-white/50 font-rajdhani mb-2">
              Extra Details (Optional)
            </label>
            <textarea
              value={extraDetails}
              onChange={(e) => setExtraDetails(e.target.value)}
              placeholder="Add any additional notes or details about the hurricane scenario..."
              rows={3}
              className="w-full px-4 py-3 bg-black/60 border border-white/[0.08] rounded-lg text-white/70 font-rajdhani focus:outline-none focus:border-white/20 resize-none"
            />
            <p className="text-xs text-white/40 mt-1 font-rajdhani">
              This field does not affect matching - it's for your notes only
            </p>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !region.trim()}
            className="w-full px-6 py-3 bg-white/[0.12] hover:bg-white/[0.15] text-white font-bold font-rajdhani rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Find Match'}
          </button>

          {/* Results */}
          {matchResult && (
            <div className="mt-6 space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold font-rajdhani">
                    Best Match
                  </h3>
                  <div className="flex items-center gap-2">
                    {matchResult.category_match && (
                      <span className="text-xs px-2 py-1 bg-white/[0.04] text-white/40 rounded font-rajdhani">
                        Category Match
                      </span>
                    )}
                    {matchResult.region_match && (
                      <span className="text-xs px-2 py-1 bg-white/[0.04] text-white/40 rounded font-rajdhani">
                        Region Match
                      </span>
                    )}
                    {matchResult.direction_match && (
                      <span className="text-xs px-2 py-1 bg-white/[0.04] text-white/40 rounded font-rajdhani">
                        Direction Match
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-white/60 font-rajdhani space-y-1">
                  <div className="text-lg font-semibold text-white/70">
                    {matchResult.match.name} ({matchResult.match.year})
                  </div>
                  <div>Category {matchResult.match.max_category}</div>
                  <div>Affected: {matchResult.match.affected_countries.join(', ')}</div>
                  <div>Population Affected: {matchResult.match.estimated_population_affected.toLocaleString()}</div>
                  <div className="text-xs text-white/40 mt-2">
                    Match Score: {Math.round(matchResult.score)}
                  </div>
                  {extraDetails && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                      <div className="text-xs text-white/40 font-rajdhani mb-1">Your Notes:</div>
                      <div className="text-sm text-white/50 font-rajdhani italic">{extraDetails}</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSelectMatch}
                  className="mt-4 w-full px-4 py-2 bg-white/[0.12] hover:bg-white/[0.15] text-white font-bold font-rajdhani rounded transition-all duration-300"
                >
                  Select This Hurricane
                </button>
              </div>

              {/* Alternatives */}
              {matchResult.alternatives && matchResult.alternatives.length > 0 && (
                <div>
                  <h4 className="text-white/50 font-rajdhani mb-2">Alternative Matches</h4>
                  <div className="space-y-2">
                    {matchResult.alternatives.map((alt: any, idx: number) => (
                      <div
                        key={alt.id}
                        className="bg-black/40 border border-white/[0.04] rounded p-3 hover:border-white/[0.08] transition-all cursor-pointer"
                        onClick={() => handleSelectAlternative(alt)}
                      >
                        <div className="text-white/60 font-rajdhani">
                          <div className="font-semibold">
                            {alt.name} ({alt.year}) - Category {alt.max_category}
                          </div>
                          <div className="text-xs text-white/40">
                            {alt.affected_countries.join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skip Button */}
          <button
            onClick={onSkip}
            className="w-full px-6 py-2 text-white/50 hover:text-white/70 font-rajdhani border border-white/[0.06] hover:border-white/[0.08] rounded-lg transition-all duration-300"
          >
            Skip - Browse All Hurricanes
          </button>
        </div>
      </div>
    </div>
  )
}
