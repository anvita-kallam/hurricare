import { useEffect, useState } from 'react'
import Globe from './components/Globe'
import CoverageChoropleth from './components/CoverageChoropleth'
import SimulationEngine from './components/SimulationEngine'
import Leaderboard from './components/Leaderboard'
import IntroScreen from './components/IntroScreen'
import NarrativePopup from './components/NarrativePopup'
import { useStore } from './state/useStore'
import axios from 'axios'

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
  } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  
  useEffect(() => {
    const fetchHurricanes = async () => {
      try {
        const [hurricanesRes, coverageRes] = await Promise.all([
          axios.get(`${API_BASE}/hurricanes`),
          axios.get(`${API_BASE}/coverage`)
        ])
        setHurricanes(hurricanesRes.data)
        setCoverage(coverageRes.data)
        console.log('Loaded hurricanes:', hurricanesRes.data.length)
        console.log('Loaded coverage data:', coverageRes.data.length)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchHurricanes()
  }, [setHurricanes, setCoverage])
  
  const handleHurricaneSelect = (hurricaneId: string) => {
    // If clicking the same hurricane, deselect it
    if (selectedHurricane?.id === hurricaneId) {
      setSelectedHurricane(null)
      console.log('Deselected hurricane')
    } else {
      const hurricane = hurricanes.find(h => h.id === hurricaneId)
      setSelectedHurricane(hurricane || null)
      console.log('Selected hurricane:', hurricane?.name)
    }
  }
  
  const handleClearSelection = () => {
    setSelectedHurricane(null)
  }

  const handleEnterGame = () => {
    setGameStarted(true)
    setShowWelcomePopup(true)
  }
  
  // Show intro screen until game is started
  if (!gameStarted) {
    return <IntroScreen onEnter={handleEnterGame} isLoading={loading} />
  }
  
  return (
    <>
      {/* Welcome Narrative Pop-up */}
      {showWelcomePopup && (
        <NarrativePopup
          title="Welcome to HurriCare"
          message="You are about to experience a humanitarian response simulation based on real historical hurricanes.\n\nYour mission: Allocate limited resources to save lives and reduce suffering. You'll compare your decisions against AI-optimized plans and actual historical responses.\n\nSelect a hurricane from the left panel to begin your mission."
          type="story"
          onClose={() => setShowWelcomePopup(false)}
          autoClose={0}
        />
      )}
      
      <div className="w-screen h-screen flex flex-col bg-black relative" style={{ zIndex: 1 }}>
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-cyan-500/30 p-4 glow-cyan relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-glow-cyan font-orbitron">HurriCare</h1>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-cyan-200 hover:text-cyan-100 transition">
              <input
                type="checkbox"
                checked={autoSpin}
                onChange={(e) => setAutoSpin(e.target.checked)}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm">Auto-rotate Globe</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-cyan-200 hover:text-cyan-100 transition">
              <input
                type="checkbox"
                checked={showSeverityOverlay}
                onChange={toggleSeverityOverlay}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm">Severity Overlay</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-cyan-200 hover:text-cyan-100 transition">
              <input
                type="checkbox"
                checked={showCoverageOverlay}
                onChange={toggleCoverageOverlay}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm">Coverage Overlay</span>
            </label>
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="px-3 py-1.5 rounded bg-cyan-600/80 hover:bg-cyan-600 text-cyan-100 text-sm font-semibold font-orbitron transition"
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
        {/* Left Sidebar - Hurricane Selection */}
        <div className="w-64 bg-black/70 backdrop-blur-sm border-r border-cyan-500/30 p-4 overflow-y-auto glow-cyan">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-glow-cyan font-orbitron">Historical Hurricanes</h2>
            {selectedHurricane && (
              <button
                onClick={handleClearSelection}
                className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 font-exo transition"
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
                className={`w-full text-left p-3 rounded border-2 transition-all duration-300 font-exo ${
                  selectedHurricane?.id === hurricane.id
                    ? 'border-cyan-400 bg-cyan-500/20 glow-cyan text-cyan-100'
                    : 'border-cyan-500/30 bg-black/40 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/10 hover:glow-cyan'
                }`}
              >
                <div className="font-semibold">{hurricane.name}</div>
                <div className="text-sm text-cyan-300/80">
                  {hurricane.year} • Category {hurricane.max_category}
                </div>
                <div className="text-xs text-cyan-400/60 mt-1">
                  {hurricane.estimated_population_affected.toLocaleString()} affected
                </div>
              </button>
            ))}
          </div>
          
          {selectedHurricane && (
            <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded glow-cyan">
              <h3 className="font-semibold mb-2 text-cyan-200 font-orbitron">Selected Scenario</h3>
              <div className="text-sm space-y-1 text-cyan-300/90">
                <div><span className="font-medium text-cyan-200">Name:</span> {selectedHurricane.name}</div>
                <div><span className="font-medium text-cyan-200">Year:</span> {selectedHurricane.year}</div>
                <div><span className="font-medium text-cyan-200">Max Category:</span> {selectedHurricane.max_category}</div>
                <div><span className="font-medium text-cyan-200">Affected Countries:</span> {selectedHurricane.affected_countries.join(', ')}</div>
                <div><span className="font-medium text-cyan-200">Population Affected:</span> {selectedHurricane.estimated_population_affected.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Center - Globe */}
        <div className="flex-1 relative">
          <Globe />
          <CoverageChoropleth />
        </div>
        
        {/* Right Sidebar - Game Panel */}
        <div className="w-96 bg-black/70 backdrop-blur-sm border-l border-cyan-500/30 flex flex-col glow-cyan">
          <div className="flex-1 overflow-hidden p-4">
            <SimulationEngine />
          </div>
        </div>
      </div>
      
    </div>
    </>
  )
}

export default App
