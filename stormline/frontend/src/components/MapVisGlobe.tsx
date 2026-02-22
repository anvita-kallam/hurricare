import { useState, useEffect, useRef, useCallback } from 'react'
import GlobeScene from './mapvis/GlobeScene'
import '../styles/mapvis.css'

interface MapVisGlobeProps {
  selectedHurricane?: any
  onCountrySelect?: (countryName: string) => void
  autoSpin?: boolean
}

const mockStat = (name: string, i: number, lo: number, hi: number) => {
  let h = 0
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff
  return Math.round(((h >> (i * 4)) & 0xfff) / 0xfff * (hi - lo) + lo)
}

function CountryPanel({ name, onBack }: { name: string | null, onBack: () => void }) {
  if (!name) return null
  const pop = mockStat(name, 0, 1, 1400)
  const gdp = mockStat(name, 1, 10, 25000)
  const area = mockStat(name, 2, 10, 9500)
  const hdi = (mockStat(name, 3, 400, 950) / 1000).toFixed(3)

  return (
    <div className="country-panel">
      <button className="back-btn" onClick={onBack}>← Globe</button>
      <h1 className="country-name">{name}</h1>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-val">{pop.toLocaleString()}M</span>
          <span className="stat-lbl">Population</span>
        </div>
        <div className="stat">
          <span className="stat-val">${gdp.toLocaleString()}B</span>
          <span className="stat-lbl">GDP</span>
        </div>
        <div className="stat">
          <span className="stat-val">{area.toLocaleString()} km²</span>
          <span className="stat-lbl">Area</span>
        </div>
        <div className="stat">
          <span className="stat-val">{hdi}</span>
          <span className="stat-lbl">HDI</span>
        </div>
      </div>
    </div>
  )
}

export default function MapVisGlobe({
  _selectedHurricane,
  onCountrySelect,
  _autoSpin = false
}: MapVisGlobeProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [blurring, setBlurring] = useState(false)
  const [hoverEnabled, setHoverEnabled] = useState(true)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setBlurring(true)
    blurTimeout.current = setTimeout(() => setBlurring(false), 100)
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current)
    }
  }, [selected])

  const handleSelect = useCallback((name: string) => {
    setSelected(name)
    onCountrySelect?.(name)
  }, [onCountrySelect])

  const handleBack = useCallback(() => setSelected(null), [])

  return (
    <main className="mapvis-container">
      {selected && <div className="zoom-vignette" />}

      <div className={`globe-container${blurring ? ' motion-blur' : ''}`}>
        <button
          className="hover-toggle-btn"
          onClick={() => setHoverEnabled(!hoverEnabled)}
          title={hoverEnabled ? 'Disable hover elevation' : 'Enable hover elevation'}
        >
          Hover: {hoverEnabled ? 'On' : 'Off'}
        </button>
        <GlobeScene selected={selected} onSelect={handleSelect} hoverEnabled={hoverEnabled} />
      </div>

      <CountryPanel name={selected} onBack={handleBack} />
    </main>
  )
}
