import { useEffect, useState, useCallback, useRef } from 'react'
import MapVisGlobe from './components/MapVisGlobe'
import CoverageChoropleth from './components/CoverageChoropleth'
import SimulationEngine from './components/SimulationEngine'
import ComparisonPage from './components/ComparisonPage'
import Leaderboard from './components/Leaderboard'
import Dashboard3D from './components/Dashboard3D'
import FundingDisparityGlobe from './components/mapvis/FundingDisparityGlobe'
import NarrativePopup from './components/NarrativePopup'
import CinematicIntro from './components/CinematicIntro'
import HurricaneMatcher from './components/HurricaneMatcher'
import PostSimulationMap from './components/PostSimulationMap'
import { useStore } from './state/useStore'
import axios from 'axios'
import { ImpactEvent } from './hooks/useCinematicController'

const API_BASE = 'http://localhost:8000'

function App() {
  const {
    hurricanes,
    setHurricanes,
    setCoverage,
    selectedHurricane,
    setSelectedHurricane,
    showSeverityOverlay,
    showCoverageOverlay,
    toggleSeverityOverlay,
    toggleCoverageOverlay,
    autoSpin,
    setAutoSpin,
    lastSimulationScore,
    leaderboardOpen,
    setLeaderboardOpen,
    isCinematicPlaying,
    setCinematicPlaying,
    cinematicCompleted,
    setCinematicCompleted,
    narrativePopup,
    setNarrativePopup,
    showComparisonPage,
    setShowComparisonPage,
    postSimulationMapMode,
    setPostSimulationMapMode,
  } = useStore()

  const [loading, setLoading] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [pendingHurricane, setPendingHurricane] = useState<string | null>(null)
  const [showMatcher, setShowMatcher] = useState(false)
  const [showFundingDisparity, setShowFundingDisparity] = useState(false)
  // Map transition: 'globe' | 'fading-out' | 'flat-entering' | 'flat'
  const [mapPhase, setMapPhase] = useState<'globe' | 'fading-out' | 'flat-entering' | 'flat'>('globe')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger globe → flat map transition when cinematic completes
  useEffect(() => {
    if (cinematicCompleted && selectedHurricane && mapPhase === 'globe') {
      // Start the transition sequence
      setMapPhase('fading-out')
      transitionTimerRef.current = setTimeout(() => {
        setPostSimulationMapMode(true)
        setMapPhase('flat-entering')
        transitionTimerRef.current = setTimeout(() => {
          setMapPhase('flat')
        }, 900)
      }, 600)
    }
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [cinematicCompleted, selectedHurricane])

  // Reset to globe when selection is cleared
  useEffect(() => {
    if (!selectedHurricane && postSimulationMapMode) {
      setPostSimulationMapMode(false)
      setMapPhase('globe')
    }
  }, [selectedHurricane, postSimulationMapMode])

  useEffect(() => {
    const fetchHurricanes = async () => {
      try {
        const [hurricanesRes, coverageRes] = await Promise.all([
          axios.get(`${API_BASE}/hurricanes`),
          axios.get(`${API_BASE}/coverage`)
        ])
        setHurricanes(hurricanesRes.data)
        setCoverage(coverageRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHurricanes()
  }, [setHurricanes, setCoverage])

  const generateImpactEvents = (hurricane: any): ImpactEvent[] => {
    const events: ImpactEvent[] = []
    const track = hurricane.track || []

    if (track.length === 0) return events

    const eventIndices = [
      Math.floor(track.length * 0.2),
      Math.floor(track.length * 0.4),
      Math.floor(track.length * 0.6),
      Math.floor(track.length * 0.8),
    ]

    eventIndices.forEach((idx, i) => {
      if (idx >= track.length) return
      const point = track[idx]
      const timeHours = idx * 6
      const regionName = hurricane.affected_countries?.[0] || 'Affected Region'

      events.push({
        time_hours: timeHours,
        location: {
          name: `${regionName} - Track Point ${i + 1}`,
          lat: point.lat,
          lon: point.lon
        },
        impact: {
          power_outages: Math.floor(Math.random() * 50000) + 10000,
          evacuations: Math.floor(Math.random() * 20000) + 5000,
          flooding_reported: point.wind > 100
        }
      })
    })

    return events
  }

  const handleHurricaneSelect = (hurricaneId: string) => {
    if (selectedHurricane?.id === hurricaneId) {
      setSelectedHurricane(null)
      setCinematicPlaying(false)
      setPendingHurricane(null)
      setCinematicCompleted(false)
      setPostSimulationMapMode(false)
      setMapPhase('globe')
    } else {
      const hurricane = hurricanes.find(h => h.id === hurricaneId)
      if (hurricane) {
        setSelectedHurricane(hurricane)
        setPendingHurricane(hurricaneId)
        setCinematicCompleted(false)
        setPostSimulationMapMode(false)
        setMapPhase('globe')
      }
    }
  }

  const handleCinematicComplete = useCallback(() => {
    setCinematicPlaying(false)
    setCinematicCompleted(true)

    if (pendingHurricane) {
      const hurricane = hurricanes.find(h => h.id === pendingHurricane)
      setSelectedHurricane(hurricane || null)
      setPendingHurricane(null)
      if (hurricane) {
        setTimeout(() => {
          setNarrativePopup({
            title: `Hurricane ${hurricane.name} - ${hurricane.year}`,
            message: `You are now the humanitarian response coordinator for ${hurricane.name}, a Category ${hurricane.max_category} storm that affected ${hurricane.affected_countries.join(', ')}. ${hurricane.estimated_population_affected.toLocaleString()} people were impacted. Your mission: allocate limited resources to save lives and reduce suffering. You have a fixed budget based on actual historical funding. Make every dollar count.`,
            type: 'story'
          })
        }, 500)
      }
    }
  }, [pendingHurricane, hurricanes, setNarrativePopup])

  const handleClearSelection = () => {
    setSelectedHurricane(null)
    setPostSimulationMapMode(false)
    setMapPhase('globe')
    setCinematicCompleted(false)
  }

  const handleDashboardOption = (option: 'search' | 'browse' | 'disparity') => {
    if (option === 'search' || option === 'browse') {
      setShowMatcher(true)
    } else if (option === 'disparity') {
      setShowFundingDisparity(true)
    }
  }

  const handleMatcherMatch = (hurricaneId: string) => {
    setShowMatcher(false)
    setGameStarted(true)
    setShowWelcomePopup(true)
  }

  const handleMatcherSkip = () => {
    setShowMatcher(false)
    setGameStarted(true)
    setShowWelcomePopup(true)
  }

  const handleCloseFundingDisparity = () => {
    setShowFundingDisparity(false)
  }

  // Dashboard entry screen
  if (!gameStarted && !showFundingDisparity) {
    return (
      <>
        <Dashboard3D
          onSelectOption={handleDashboardOption}
          onEnter={() => {}}
          isLoading={loading}
        />
        {showMatcher && !loading && (
          <HurricaneMatcher
            onMatchFound={handleMatcherMatch}
            onSkip={handleMatcherSkip}
          />
        )}
      </>
    )
  }

  // Funding disparity globe
  if (showFundingDisparity) {
    return (
      <FundingDisparityGlobe onClose={handleCloseFundingDisparity} />
    )
  }

  const cinematicHurricane = pendingHurricane
    ? hurricanes.find(h => h.id === pendingHurricane)
    : null

  const cinematicImpactEvents = cinematicHurricane
    ? (cinematicHurricane.impact_events || generateImpactEvents(cinematicHurricane))
    : []

  const handleStartSimulation = () => {
    if (selectedHurricane) {
      setPendingHurricane(selectedHurricane.id)
      setCinematicPlaying(true)
      setCinematicCompleted(false)
    }
  }

  return (
    <>
      {/* Cinematic Intro */}
      {isCinematicPlaying && cinematicHurricane && (
        <CinematicIntro
          hurricane={cinematicHurricane}
          impactEvents={cinematicImpactEvents}
          onComplete={handleCinematicComplete}
        />
      )}

      {/* Welcome Narrative */}
      {showWelcomePopup && !isCinematicPlaying && (
        <NarrativePopup
          title="Welcome to HurriCare"
          message="You are about to experience a humanitarian response simulation based on real historical hurricanes. Your mission: Allocate limited resources to save lives and reduce suffering. You'll compare your decisions against AI-optimized plans and actual historical responses. Select a hurricane from the left panel to begin your mission."
          type="story"
          onClose={() => setShowWelcomePopup(false)}
          autoClose={0}
        />
      )}

      {/* Comparison Page */}
      {showComparisonPage ? (
        <ComparisonPage />
      ) : (
        <div
          className="w-screen h-screen flex flex-col bg-black relative"
          style={{
            zIndex: 1,
            pointerEvents: isCinematicPlaying ? 'none' : 'auto',
            opacity: isCinematicPlaying ? 0 : 1,
            transition: 'opacity 0.5s ease-in-out',
            display: isCinematicPlaying ? 'none' : 'flex'
          }}
        >
      {/* Header — near-black bg, hairline white border, no cyan/neon glow */}
      <header className="bg-black/90 border-b border-white/[0.08] p-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white font-rajdhani tracking-wider">HurriCare</h1>
            {postSimulationMapMode && (
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/[0.05] border border-white/[0.08]">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                <span className="text-xs font-rajdhani text-white/50 tracking-wider uppercase">Analysis Mode</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!postSimulationMapMode && (
              <label className="flex items-center gap-2 cursor-pointer text-white/60 hover:text-white/80 transition">
                <input
                  type="checkbox"
                  checked={autoSpin}
                  onChange={(e) => setAutoSpin(e.target.checked)}
                  className="w-4 h-4 accent-white/50"
                />
                <span className="text-sm font-rajdhani">Auto-rotate Globe</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-white/60 hover:text-white/80 transition">
              <input
                type="checkbox"
                checked={showSeverityOverlay}
                onChange={toggleSeverityOverlay}
                className="w-4 h-4 accent-white/50"
              />
              <span className="text-sm font-rajdhani">Severity Overlay</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-white/60 hover:text-white/80 transition">
              <input
                type="checkbox"
                checked={showCoverageOverlay}
                onChange={toggleCoverageOverlay}
                className="w-4 h-4 accent-white/50"
              />
              <span className="text-sm font-rajdhani">Coverage Overlay</span>
            </label>
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="px-3 py-1.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white/70 text-sm font-semibold font-rajdhani transition border border-white/[0.08]"
            >
              Daily Leaderboard
            </button>
          </div>
        </div>
      </header>

      <Leaderboard
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        lastScore={lastSimulationScore}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar — Hurricane Selection */}
        <div className="w-64 bg-black/80 border-r border-white/[0.08] p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white/90 font-rajdhani">Historical Hurricanes</h2>
            {selectedHurricane && (
              <button
                onClick={handleClearSelection}
                className="text-xs px-2 py-1 rounded bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-white/50 font-rajdhani transition"
                title="Clear Selection"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-2">
            {hurricanes.map((hurricane) => (
              <button
                key={hurricane.id}
                onClick={() => handleHurricaneSelect(hurricane.id)}
                className={`w-full text-left p-3 rounded border transition-all duration-300 font-rajdhani ${
                  selectedHurricane?.id === hurricane.id
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-white/[0.08] bg-black/40 text-white/60 hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white/80'
                }`}
              >
                <div className="font-semibold">{hurricane.name}</div>
                <div className="text-sm text-white/40 font-mono">
                  {hurricane.year} &bull; Category {hurricane.max_category}
                </div>
                <div className="text-xs text-white/30 mt-1 font-mono">
                  {hurricane.estimated_population_affected.toLocaleString()} affected
                </div>
              </button>
            ))}
          </div>

          {selectedHurricane && (
            <div className="mt-6 p-3 bg-white/[0.05] border border-white/[0.08] rounded">
              <h3 className="font-semibold mb-2 text-white/70 font-rajdhani">Selected Scenario</h3>
              <div className="text-sm space-y-1 text-white/50">
                <div><span className="font-medium text-white/60 font-rajdhani">Name:</span> <span className="font-mono">{selectedHurricane.name}</span></div>
                <div><span className="font-medium text-white/60 font-rajdhani">Year:</span> <span className="font-mono">{selectedHurricane.year}</span></div>
                <div><span className="font-medium text-white/60 font-rajdhani">Max Category:</span> <span className="font-mono">{selectedHurricane.max_category}</span></div>
                <div><span className="font-medium text-white/60 font-rajdhani">Affected:</span> <span className="font-mono">{selectedHurricane.affected_countries.join(', ')}</span></div>
                <div><span className="font-medium text-white/60 font-rajdhani">Population:</span> <span className="font-mono">{selectedHurricane.estimated_population_affected.toLocaleString()}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Center — Globe or Post-Simulation Map */}
        <div className="flex-1 relative">
          {/* Globe view (pre-simulation) */}
          {!postSimulationMapMode && (
            <div
              className="w-full h-full"
              style={{
                opacity: mapPhase === 'fading-out' ? 0 : 1,
                transition: 'opacity 0.6s ease-out',
              }}
            >
              <MapVisGlobe
                selectedHurricane={selectedHurricane}
                autoSpin={autoSpin}
                onCountrySelect={(country) => console.log('Selected country:', country)}
              />
              <CoverageChoropleth />
            </div>
          )}

          {/* Flat tactical map (post-simulation) */}
          {postSimulationMapMode && (
            <PostSimulationMap
              transitionPhase={mapPhase === 'flat-entering' ? 'entering' : 'active'}
            />
          )}
        </div>

        {/* Right Sidebar — Game Panel */}
        <div className="w-96 bg-black/80 border-l border-white/[0.08] flex flex-col">
          <div className="flex-1 overflow-hidden p-4">
            <SimulationEngine onStartSimulation={handleStartSimulation} />
          </div>
        </div>
      </div>
        </div>
      )}
    </>
  )
}

export default App
