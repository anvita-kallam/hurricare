import { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import GlobeScene from './mapvis/GlobeScene'
import '../styles/mapvis.css'

interface MapVisGlobeProps {
  selectedHurricane?: any
  onCountrySelect?: (countryName: string) => void
  onHurricaneSelect?: (hurricaneId: string) => void
  autoSpin?: boolean
}

// Real country statistics data (population in millions, GDP in billions, area in thousands of km², HDI 0-1)
const COUNTRY_STATS: Record<string, { population: number; gdp: number; area: number; hdi: number }> = {
  'United States of America': { population: 333, gdp: 27360, area: 9834, hdi: 0.921 },
  'China': { population: 1425, gdp: 17734, area: 9597, hdi: 0.796 },
  'Japan': { population: 123, gdp: 4231, area: 378, hdi: 0.920 },
  'Germany': { population: 84, gdp: 4308, area: 357, hdi: 0.942 },
  'India': { population: 1428, gdp: 3736, area: 3287, hdi: 0.644 },
  'United Kingdom': { population: 68, gdp: 3332, area: 243, hdi: 0.929 },
  'France': { population: 68, gdp: 3030, area: 644, hdi: 0.912 },
  'Italy': { population: 58, gdp: 2187, area: 301, hdi: 0.895 },
  'Canada': { population: 39, gdp: 2117, area: 9985, hdi: 0.929 },
  'Brazil': { population: 215, gdp: 2081, area: 8515, hdi: 0.754 },
  'Mexico': { population: 128, gdp: 1287, area: 1964, hdi: 0.758 },
  'Russia': { population: 144, gdp: 1856, area: 17098, hdi: 0.822 },
  'South Korea': { population: 52, gdp: 1418, area: 100, hdi: 0.929 },
  'Spain': { population: 48, gdp: 1390, area: 505, hdi: 0.910 },
  'Australia': { population: 26, gdp: 1738, area: 7688, hdi: 0.951 },
  'Argentina': { population: 47, gdp: 632, area: 2780, hdi: 0.853 },
  'Saudi Arabia': { population: 36, gdp: 1107, area: 2150, hdi: 0.875 },
  'Indonesia': { population: 275, gdp: 1417, area: 1919, hdi: 0.729 },
  'Netherlands': { population: 18, gdp: 1098, area: 42, hdi: 0.941 },
  'Thailand': { population: 71, gdp: 508, area: 513, hdi: 0.810 },
  'Nigeria': { population: 223, gdp: 477, area: 924, hdi: 0.543 },
  'Philippines': { population: 117, gdp: 542, area: 300, hdi: 0.709 },
  'Vietnam': { population: 98, gdp: 430, area: 331, hdi: 0.761 },
  'Pakistan': { population: 240, gdp: 377, area: 796, hdi: 0.540 },
  'Bangladesh': { population: 174, gdp: 405, area: 148, hdi: 0.661 },
  'Egypt': { population: 108, gdp: 469, area: 1001, hdi: 0.731 },
  'Haiti': { population: 11, gdp: 20, area: 28, hdi: 0.535 },
  'Dominican Republic': { population: 11, gdp: 106, area: 49, hdi: 0.756 },
  'Jamaica': { population: 2.8, gdp: 17, area: 11, hdi: 0.785 },
  'Puerto Rico': { population: 3.2, gdp: 117, area: 9, hdi: 0.845 },
  'Colombia': { population: 52, gdp: 432, area: 1142, hdi: 0.755 },
  'Peru': { population: 34, gdp: 243, area: 1285, hdi: 0.787 },
  'Chile': { population: 19, gdp: 282, area: 756, hdi: 0.939 },
  'Ecuador': { population: 18, gdp: 107, area: 284, hdi: 0.759 },
  'Guatemala': { population: 17, gdp: 95, area: 109, hdi: 0.651 },
  'Honduras': { population: 10, gdp: 35, area: 112, hdi: 0.634 },
  'Nicaragua': { population: 7, gdp: 21, area: 130, hdi: 0.667 },
  'Costa Rica': { population: 5.2, gdp: 67, area: 51, hdi: 0.809 },
  'Panama': { population: 4.4, gdp: 79, area: 75, hdi: 0.815 },
}

const getCountryStat = (name: string, statKey: 'population' | 'gdp' | 'area' | 'hdi'): number => {
  const stat = COUNTRY_STATS[name]
  if (stat) {
    return stat[statKey]
  }
  // Fallback to approximate values for unknown countries
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const fallbacks = {
    population: 30 + (h % 200),
    gdp: 100 + (h % 500),
    area: 300 + (h % 2000),
    hdi: 0.6 + ((h % 100) / 100) * 0.3,
  }
  return fallbacks[statKey]
}

function CountryPanel({ name, onBack }: { name: string | null, onBack: () => void }) {
  if (!name) return null
  const pop = Math.round(getCountryStat(name, 'population'))
  const gdp = Math.round(getCountryStat(name, 'gdp'))
  const area = Math.round(getCountryStat(name, 'area') * 1000)
  const hdi = getCountryStat(name, 'hdi').toFixed(3)

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
  selectedHurricane,
  onCountrySelect,
  onHurricaneSelect,
  autoSpin = false
}: MapVisGlobeProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [blurring, setBlurring] = useState(false)
  // Hover is disabled by default everywhere except in funding disparity mode
  const hoverEnabled = false
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

  const handleHurricaneClick = useCallback((hurricaneId: string) => {
    onHurricaneSelect?.(hurricaneId)
  }, [onHurricaneSelect])

  const handleBack = useCallback(() => setSelected(null), [])

  return (
    <main className="mapvis-container">
      {selected && <div className="zoom-vignette" />}

      <div className={`globe-container${blurring ? ' motion-blur' : ''}`}>
        <Canvas camera={{ position: [0, 0, 2.9], fov: 50 }} dpr={[1, 2]}>
          <GlobeScene selected={selected} onSelect={handleSelect} hoverEnabled={hoverEnabled} onHurricaneClick={handleHurricaneClick} />
        </Canvas>
      </div>

      <CountryPanel name={selected} onBack={handleBack} />
    </main>
  )
}
