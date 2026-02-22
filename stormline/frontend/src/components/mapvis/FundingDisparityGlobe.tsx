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
      <h1 className="country-name" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{name}</h1>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-val" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.preparednessScore}%</span>
          <span className="stat-lbl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Preparedness Score</span>
        </div>
        <div className="stat">
          <span className="stat-val" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.fundingRating}/5</span>
          <span className="stat-lbl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Funding Rating</span>
        </div>
        <div className="stat">
          <span className="stat-val" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.disparityLevel}</span>
          <span className="stat-lbl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Status</span>
        </div>
        <div className="stat" style={{ color: stats.color }}>
          <span className="stat-val" style={{ color: stats.color, fontFamily: 'DM Mono, monospace' }}>●</span>
          <span className="stat-lbl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Disparity Index</span>
        </div>
      </div>
      <div className="mt-6 p-4 bg-black/50 rounded text-white/70 text-sm font-rajdhani border border-white/10">
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
          className="absolute top-8 left-8 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold font-rajdhani text-lg transition border border-white/10 z-50"
        >
          ← Back to Dashboard
        </button>
      )}

      {!selectedCountry && (
        <div className="absolute bottom-8 left-8 text-white/50 font-rajdhani text-sm max-w-xs">
          <p className="mb-2 font-bold text-white/70">Global Funding Disparity Analysis</p>
          <p>Click on countries to view detailed preparedness and funding statistics. Green indicates well-funded nations, red indicates severe underfunding.</p>
        </div>
      )}
    </div>
  )
}
