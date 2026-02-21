import { useEffect, useState } from 'react'
import Globe from './components/Globe'
import ProjectTable from './components/ProjectTable'
import FlaggedProjects from './components/FlaggedProjects'
import AllocationPanel from './components/AllocationPanel'
import CoverageChoropleth from './components/CoverageChoropleth'
import { useStore } from './state/useStore'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

function App() {
  const {
    hurricanes,
    setHurricanes,
    setProjects,
    setCoverage,
    setFlaggedProjects,
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
  const [activeTab, setActiveTab] = useState<'projects' | 'flagged' | 'allocation'>('projects')
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hurricanesRes, projectsRes, coverageRes, flagsRes] = await Promise.all([
          axios.get(`${API_BASE}/hurricanes`),
          axios.get(`${API_BASE}/projects`),
          axios.get(`${API_BASE}/coverage`),
          axios.get(`${API_BASE}/flags`),
        ])
        
        setHurricanes(hurricanesRes.data)
        setProjects(projectsRes.data)
        setCoverage(coverageRes.data)
        setFlaggedProjects(flagsRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [setHurricanes, setProjects, setCoverage, setFlaggedProjects])
  
  const handleHurricaneSelect = (hurricaneId: string) => {
    const hurricane = hurricanes.find(h => h.id === hurricaneId)
    setSelectedHurricane(hurricane || null)
    
    // Fetch filtered data for selected hurricane
    const fetchFilteredData = async () => {
      try {
        const [projectsRes, coverageRes, flagsRes] = await Promise.all([
          axios.get(`${API_BASE}/projects?hurricane_id=${hurricaneId}`),
          axios.get(`${API_BASE}/coverage?hurricane_id=${hurricaneId}`),
          axios.get(`${API_BASE}/flags?hurricane_id=${hurricaneId}`),
        ])
        
        setProjects(projectsRes.data)
        setCoverage(coverageRes.data)
        setFlaggedProjects(flagsRes.data)
      } catch (error) {
        console.error('Error fetching filtered data:', error)
      }
    }
    
    if (hurricane) {
      fetchFilteredData()
    }
  }
  
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading StormLine...</div>
          <div className="text-gray-600">Fetching hurricane data...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-screen h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">StormLine</h1>
            <p className="text-sm text-blue-200">Geo-Insight Challenge: Humanitarian Need vs Pooled-Fund Coverage</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSpin}
                onChange={(e) => setAutoSpin(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-rotate Globe</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSeverityOverlay}
                onChange={toggleSeverityOverlay}
                className="w-4 h-4"
              />
              <span className="text-sm">Severity Overlay</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCoverageOverlay}
                onChange={toggleCoverageOverlay}
                className="w-4 h-4"
              />
              <span className="text-sm">Coverage Overlay</span>
            </label>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Hurricane Selection */}
        <div className="w-64 bg-white shadow-lg p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Historical Hurricanes</h2>
          <div className="space-y-2">
            {hurricanes.map((hurricane) => (
              <button
                key={hurricane.id}
                onClick={() => handleHurricaneSelect(hurricane.id)}
                className={`w-full text-left p-3 rounded border-2 transition ${
                  selectedHurricane?.id === hurricane.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold">{hurricane.name}</div>
                <div className="text-sm text-gray-600">
                  {hurricane.year} • Category {hurricane.max_category}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {hurricane.estimated_population_affected.toLocaleString()} affected
                </div>
              </button>
            ))}
          </div>
          
          {selectedHurricane && (
            <div className="mt-6 p-3 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Selected Scenario</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Name:</span> {selectedHurricane.name}</div>
                <div><span className="font-medium">Year:</span> {selectedHurricane.year}</div>
                <div><span className="font-medium">Max Category:</span> {selectedHurricane.max_category}</div>
                <div><span className="font-medium">Affected Countries:</span> {selectedHurricane.affected_countries.join(', ')}</div>
                <div><span className="font-medium">Population Affected:</span> {selectedHurricane.estimated_population_affected.toLocaleString()}</div>
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
        <div className="w-96 bg-gray-50 shadow-lg flex flex-col">
          {/* Tabs */}
          <div className="flex border-b bg-white">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'projects'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'flagged'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Flagged
            </button>
            <button
              onClick={() => setActiveTab('allocation')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'allocation'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Simulator
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'projects' && <ProjectTable />}
            {activeTab === 'flagged' && <FlaggedProjects />}
            {activeTab === 'allocation' && <AllocationPanel />}
          </div>
        </div>
      </div>
      
      {/* Footer with data quality warning */}
      <footer className="bg-gray-800 text-white text-xs p-2 text-center">
        <span className="text-yellow-300">⚠️</span> This application uses synthetic but realistic data based on historical hurricanes. 
        Budgets, beneficiaries, and allocations are simulated for demonstration purposes.
      </footer>
    </div>
  )
}

export default App
