import { useState } from 'react'
import axios from 'axios'
import { useStore } from '../state/useStore'
import { playButtonPress, playHover } from '../audio/SoundEngine'

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

    playButtonPress()
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
    playButtonPress()
    if (matchResult?.match) {
      const hurricane = hurricanes.find(h => h.id === matchResult.match.id)
      if (hurricane) {
        setSelectedHurricane(hurricane)
        onMatchFound(matchResult.match.id)
      }
    }
  }

  const handleSelectAlternative = (altHurricane: any) => {
    playButtonPress()
    const hurricane = hurricanes.find(h => h.id === altHurricane.id)
    if (hurricane) {
      setSelectedHurricane(hurricane)
      onMatchFound(altHurricane.id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: 'rgba(2,4,8,0.94)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" style={{
        background: 'linear-gradient(180deg, rgba(8,12,24,0.95) 0%, rgba(10,14,28,0.97) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '32px',
        boxShadow: '0 0 80px rgba(60,100,180,0.06), 0 0 1px rgba(255,255,255,0.1)',
      }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-rajdhani text-xs tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            HURRICANE INTELLIGENCE
          </div>
          <h2 className="font-rajdhani text-2xl font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Find Matching Hurricane
          </h2>
          <div className="mt-2 mx-auto" style={{ width: '60px', height: '1px', background: 'rgba(255,255,255,0.12)' }} />
          <p className="font-rajdhani text-sm mt-3 tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Enter a region and category to find the most similar historical hurricane
          </p>
        </div>

        <div className="space-y-5">
          {/* Region Input */}
          <div>
            <label className="block font-rajdhani text-xs tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Region / Country
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g., United States, Jamaica, Philippines, Caribbean"
              className="w-full px-4 py-3 font-rajdhani text-sm tracking-wide rounded-md focus:outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(100,160,230,0.35)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Category Input */}
          <div>
            <label className="block font-rajdhani text-xs tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Category: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{category}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={category}
              onChange={(e) => {
                setCategory(parseInt(e.target.value))
              }}
              className="w-full h-[2px] rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(90deg, rgba(100,160,230,0.5) 0%, rgba(100,160,230,0.5) ${(category - 1) * 25}%, rgba(255,255,255,0.08) ${(category - 1) * 25}%, rgba(255,255,255,0.08) 100%)`,
                accentColor: 'rgba(100,160,230,0.8)',
              }}
            />
            <div className="flex justify-between font-rajdhani text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Direction Input (Optional) */}
          <div>
            <label className="block font-rajdhani text-xs tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Direction (Optional)
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-4 py-3 font-rajdhani text-sm tracking-wide rounded-md focus:outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: direction ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(100,160,230,0.35)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            >
              <option value="">Select direction...</option>
              <option value="north">North</option>
              <option value="east">East</option>
              <option value="south">South</option>
              <option value="west">West</option>
            </select>
          </div>

          {/* Extra Details (Optional) */}
          <div>
            <label className="block font-rajdhani text-xs tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Extra Details (Optional)
            </label>
            <textarea
              value={extraDetails}
              onChange={(e) => setExtraDetails(e.target.value)}
              placeholder="Add any additional notes or details about the hurricane scenario..."
              rows={3}
              className="w-full px-4 py-3 font-rajdhani text-sm tracking-wide rounded-md focus:outline-none transition-all duration-200 resize-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(100,160,230,0.35)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
            <p className="font-rajdhani text-xs mt-1 tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
              This field does not affect matching — it's for your notes only
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />

          {/* Search Button */}
          <button
            onClick={handleSearch}
            onMouseEnter={() => playHover()}
            disabled={isSearching || !region.trim()}
            className="w-full py-3 font-rajdhani text-sm font-semibold tracking-[0.15em] uppercase rounded-md transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(100,160,230,0.12)',
              border: '1px solid rgba(100,160,230,0.25)',
              color: 'rgba(255,255,255,0.9)',
            }}
            onMouseOver={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = 'rgba(100,160,230,0.2)'
                e.currentTarget.style.borderColor = 'rgba(100,160,230,0.4)'
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(100,160,230,0.12)'
              e.currentTarget.style.borderColor = 'rgba(100,160,230,0.25)'
            }}
          >
            {isSearching ? 'Searching...' : 'Find Match'}
          </button>

          {/* Results */}
          {matchResult && (
            <div className="mt-2 space-y-4">
              {/* Best Match */}
              <div className="rounded-md p-5" style={{
                background: 'linear-gradient(180deg, rgba(12,18,32,0.8) 0%, rgba(8,12,24,0.85) 100%)',
                border: '1px solid rgba(100,160,230,0.15)',
              }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-rajdhani text-xs tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Best Match
                  </div>
                  <div className="flex items-center gap-2">
                    {matchResult.category_match && (
                      <span className="font-rajdhani text-xs px-2 py-0.5 rounded" style={{
                        background: 'rgba(100,200,120,0.1)',
                        border: '1px solid rgba(100,200,120,0.2)',
                        color: 'rgba(100,200,120,0.8)',
                      }}>
                        Category
                      </span>
                    )}
                    {matchResult.region_match && (
                      <span className="font-rajdhani text-xs px-2 py-0.5 rounded" style={{
                        background: 'rgba(100,200,120,0.1)',
                        border: '1px solid rgba(100,200,120,0.2)',
                        color: 'rgba(100,200,120,0.8)',
                      }}>
                        Region
                      </span>
                    )}
                    {matchResult.direction_match && (
                      <span className="font-rajdhani text-xs px-2 py-0.5 rounded" style={{
                        background: 'rgba(100,160,230,0.1)',
                        border: '1px solid rgba(100,160,230,0.2)',
                        color: 'rgba(100,160,230,0.8)',
                      }}>
                        Direction
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-rajdhani space-y-1.5">
                  <div className="text-lg font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {matchResult.match.name} ({matchResult.match.year})
                  </div>
                  <div className="text-sm tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Category {matchResult.match.max_category}
                  </div>
                  <div className="text-sm tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Affected: {matchResult.match.affected_countries.join(', ')}
                  </div>
                  <div className="text-sm tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Population Affected: {matchResult.match.estimated_population_affected.toLocaleString()}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Match Score: {Math.round(matchResult.score)}
                  </div>
                  {extraDetails && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-xs tracking-[0.15em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Your Notes</div>
                      <div className="text-sm italic tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>{extraDetails}</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSelectMatch}
                  onMouseEnter={() => playHover()}
                  className="mt-4 w-full py-2.5 font-rajdhani text-sm font-semibold tracking-[0.15em] uppercase rounded-md transition-all duration-300"
                  style={{
                    background: 'rgba(100,160,230,0.15)',
                    border: '1px solid rgba(100,160,230,0.3)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(100,160,230,0.25)'
                    e.currentTarget.style.borderColor = 'rgba(100,160,230,0.45)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(100,160,230,0.15)'
                    e.currentTarget.style.borderColor = 'rgba(100,160,230,0.3)'
                  }}
                >
                  Select This Hurricane
                </button>
              </div>

              {/* Alternatives */}
              {matchResult.alternatives && matchResult.alternatives.length > 0 && (
                <div>
                  <div className="font-rajdhani text-xs tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Alternative Matches
                  </div>
                  <div className="space-y-2">
                    {matchResult.alternatives.map((alt: any) => (
                      <div
                        key={alt.id}
                        className="rounded-md p-3 cursor-pointer transition-all duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                        onClick={() => handleSelectAlternative(alt)}
                        onMouseEnter={(e) => {
                          playHover()
                          e.currentTarget.style.borderColor = 'rgba(100,160,230,0.25)'
                          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div className="font-rajdhani">
                          <div className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>
                            {alt.name} ({alt.year}) — Category {alt.max_category}
                          </div>
                          <div className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
            onClick={() => { playButtonPress(); onSkip() }}
            onMouseEnter={() => playHover()}
            className="w-full py-2.5 font-rajdhani text-sm tracking-[0.1em] rounded-md transition-all duration-200"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
            }}
          >
            Skip — Browse All Hurricanes
          </button>
        </div>
      </div>
    </div>
  )
}
