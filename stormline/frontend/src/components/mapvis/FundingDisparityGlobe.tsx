import { useState, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import GlobeScene from './GlobeScene'
import '../../styles/mapvis.css'
import { getCountryStatistics } from '../../data/fundingDisparity'

function CountryStatsPanel({ name, onClose }: { name: string | null; onClose: () => void }) {
  if (!name) return null

  const stats = getCountryStatistics(name)

  return (
    <div className="country-panel">
      <button className="back-btn" onClick={onClose}>← Globe</button>
      <h1 className="country-name">{name}</h1>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-val">{stats.preparednessScore}%</span>
          <span className="stat-lbl">Preparedness Score</span>
        </div>
        <div className="stat">
          <span className="stat-val">{stats.fundingRating}/5</span>
          <span className="stat-lbl">Funding Rating</span>
        </div>
        <div className="stat">
          <span className="stat-val">{stats.disparityLevel}</span>
          <span className="stat-lbl">Status</span>
        </div>
        <div className="stat" style={{ color: stats.color }}>
          <span className="stat-val" style={{ color: stats.color }}>●</span>
          <span className="stat-lbl">Disparity Index</span>
        </div>
      </div>
      <div className="mt-6 p-4 bg-black/50 rounded text-cyan-200 text-sm font-exo border border-cyan-500/30">
        <p>
          {stats.disparityLevel === 'Well-Funded'
            ? 'This country has strong disaster preparedness infrastructure and adequate funding for humanitarian response.'
            : stats.disparityLevel === 'Moderate'
            ? 'This country has moderate disaster management capacity but may face resource constraints during major events.'
            : stats.disparityLevel === 'Under-Resourced'
            ? 'This country faces significant resource limitations in disaster response and preparedness.'
            : 'This country has critically limited resources for disaster management and humanitarian response.'}
        </p>
      </div>
    </div>
  )
}

interface FundingDisparityGlobeProps {
  onClose?: () => void
}

export default function FundingDisparityGlobe({ onClose }: FundingDisparityGlobeProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const canvasRef = useRef(null)

  const handleCountrySelect = useCallback((countryName: string) => {
    setSelectedCountry(countryName)
  }, [])

  const handleCloseStats = useCallback(() => {
    setSelectedCountry(null)
  }, [])

  return (
    <div className="mapvis-container">
      <div className="globe-container">
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 0, 2.5], fov: 50 }}
          dpr={[1, 2]}
        >
          <GlobeScene
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelect}
            hoverEnabled={true}
            fundingDisparityMode={true}
          />
        </Canvas>
      </div>

      <div className="zoom-vignette" />

      {selectedCountry && (
        <CountryStatsPanel name={selectedCountry} onClose={handleCloseStats} />
      )}

      {onClose && !selectedCountry && (
        <button
          onClick={onClose}
          className="absolute top-8 left-8 px-6 py-3 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-bold font-orbitron text-lg transition glow-red z-50"
          style={{
            boxShadow: '0 0 20px rgba(220, 38, 38, 0.5)'
          }}
        >
          ← Back to Dashboard
        </button>
      )}

      {!selectedCountry && (
        <div className="absolute bottom-8 left-8 text-cyan-300 font-exo text-sm max-w-xs">
          <p className="mb-2 font-bold">Global Funding Disparity Analysis</p>
          <p>Click on countries to view detailed preparedness and funding statistics. Green indicates well-funded nations, red indicates severe underfunding.</p>
        </div>
      )}
    </div>
  )
}
