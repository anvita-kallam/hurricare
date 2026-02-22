import { useState, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import GlobeScene from './GlobeScene'
import FundingDisparityPanels from './FundingDisparityPanels'
import '../../styles/mapvis.css'

interface FundingDisparityGlobeProps {
  onClose?: () => void
}

export default function FundingDisparityGlobe({ onClose }: FundingDisparityGlobeProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const canvasRef = useRef(null)

  const handleCountrySelect = useCallback((countryName: string) => {
    setSelectedCountry((prev) => (prev === countryName ? null : countryName))
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

      {/* Intelligence panels — appear left/right on country selection */}
      <FundingDisparityPanels selectedCountry={selectedCountry} />

      {/* Back button — only visible when no country selected */}
      {onClose && !selectedCountry && (
        <button
          onClick={onClose}
          className="absolute top-8 left-8 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold font-rajdhani text-lg transition border border-white/10 z-50"
        >
          &larr; Back to Dashboard
        </button>
      )}

      {/* Legend — only visible when no country selected */}
      {!selectedCountry && (
        <div className="absolute top-8 right-8 bg-black/70 border border-white/[0.1] rounded-lg p-4 max-w-xs z-40">
          <div className="font-bold text-white/80 font-rajdhani mb-3 text-sm">Funding Disparity Legend</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ background: 'rgba(120,220,120,0.8)' }} />
              <span className="text-xs text-white/60 font-exo">Well-Funded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ background: 'rgba(255,220,100,0.8)' }} />
              <span className="text-xs text-white/60 font-exo">Moderate Funding</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ background: 'rgba(255,160,60,0.8)' }} />
              <span className="text-xs text-white/60 font-exo">Under-Resourced</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ background: 'rgba(255,100,80,0.8)' }} />
              <span className="text-xs text-white/60 font-exo">Critically Under-Resourced</span>
            </div>
          </div>
        </div>
      )}

      {/* Deselect button — only visible when country is selected */}
      {selectedCountry && (
        <button
          onClick={() => setSelectedCountry(null)}
          className="fdp-deselect-btn"
        >
          &larr; DESELECT
        </button>
      )}

      {/* Info text — only when no country selected */}
      {!selectedCountry && (
        <div className="absolute bottom-8 left-8 text-white/50 font-rajdhani text-sm max-w-xs z-20">
          <p className="mb-2 font-bold text-white/70">Global Funding Disparity Analysis</p>
          <p>Click on countries to view detailed preparedness and funding statistics. Green indicates well-funded nations, red indicates severe underfunding.</p>
        </div>
      )}
    </div>
  )
}
