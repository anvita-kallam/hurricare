import { useEffect, useState } from 'react'
import Globe from './components/Globe'
import ProjectTable from './components/ProjectTable'
import FlaggedProjects from './components/FlaggedProjects'
import AllocationPanel from './components/AllocationPanel'
import CoverageChoropleth from './components/CoverageChoropleth'
import SimulationEngine from './components/SimulationEngine'
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
  } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'projects' | 'flagged' | 'simulation'>('simulation')
  
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
    const hurricane = hurricanes.find(h => h.id === hurricaneId)
    setSelectedHurricane(hurricane || null)
    console.log('Selected hurricane:', hurricane?.name)
  }
  
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2 text-glow-cyan font-orbitron">Loading StormLine...</div>
          <div className="text-cyan-300 font-exo">Fetching hurricane data...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-screen h-screen flex flex-col bg-black relative" style={{ zIndex: 1 }}>
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-cyan-500/30 p-4 glow-cyan relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-glow-cyan font-orbitron">StormLine</h1>
            <p className="text-sm text-cyan-300/80 font-exo">Geo-Insight Challenge: Humanitarian Need vs Pooled-Fund Coverage</p>
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
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar - Hurricane Selection */}
        <div className="w-64 bg-black/70 backdrop-blur-sm border-r border-cyan-500/30 p-4 overflow-y-auto glow-cyan">
          <h2 className="text-xl font-bold mb-4 text-glow-cyan font-orbitron">Historical Hurricanes</h2>
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
        
        {/* Right Sidebar - Analysis Panels */}
        <div className="w-96 bg-black/70 backdrop-blur-sm border-l border-cyan-500/30 flex flex-col glow-cyan">
          {/* Tabs */}
          <div className="flex border-b border-cyan-500/30 bg-black/50">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 py-2 px-4 text-sm font-medium transition-all font-orbitron ${
                activeTab === 'projects'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 text-glow-cyan bg-cyan-500/10'
                  : 'text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/5'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`flex-1 py-2 px-4 text-sm font-medium transition-all font-orbitron ${
                activeTab === 'flagged'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 text-glow-cyan bg-cyan-500/10'
                  : 'text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/5'
              }`}
            >
              Flagged
            </button>
            <button
              onClick={() => setActiveTab('simulation')}
              className={`flex-1 py-2 px-4 text-sm font-medium transition-all font-orbitron ${
                activeTab === 'simulation'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 text-glow-cyan bg-cyan-500/10'
                  : 'text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/5'
              }`}
            >
              Game
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'projects' && <ProjectTable />}
            {activeTab === 'flagged' && <FlaggedProjects />}
            {activeTab === 'simulation' && <SimulationEngine />}
          </div>
        </div>
      </div>
      
      {/* Footer with data quality warning */}
      <footer className="bg-black/80 backdrop-blur-sm border-t border-cyan-500/30 text-cyan-300/80 text-xs p-2 text-center relative z-10">
        <span className="text-yellow-400">⚠️</span> This application uses synthetic but realistic data based on historical hurricanes. 
        Budgets, beneficiaries, and allocations are simulated for demonstration purposes.
      </footer>
    </div>
  )
}

export default App
