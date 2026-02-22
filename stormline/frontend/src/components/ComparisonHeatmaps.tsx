import { useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { useStore } from '../state/useStore'

// Simplified world map TopoJSON - using a simple approach
// In production, you'd load actual TopoJSON files
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface ComparisonHeatmapsProps {
  userPlan: any
  mlPlan: any
  realPlan: any
  selectedHurricane: any
}

// Generate color based on value
function getColor(value: number, maxValue: number, type: 'crisis' | 'funding') {
  if (type === 'crisis') {
    // Red gradient for crisis/severity
    const intensity = Math.min(value / maxValue, 1)
    const r = Math.floor(255 * intensity)
    const g = Math.floor(100 * (1 - intensity))
    const b = Math.floor(50 * (1 - intensity))
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Blue gradient for funding
    const intensity = Math.min(value / maxValue, 1)
    const r = Math.floor(50 * (1 - intensity))
    const g = Math.floor(150 * intensity)
    const b = Math.floor(255 * intensity)
    return `rgb(${r}, ${g}, ${b})`
  }
}

export default function ComparisonHeatmaps({ userPlan, mlPlan, realPlan, selectedHurricane }: ComparisonHeatmapsProps) {
  const { coverage } = useStore()
  
  // Prepare data for crisis heatmap (severity/need)
  const crisisData = useMemo(() => {
    const data: Record<string, { severity: number; need: number }> = {}
    
    realPlan.allocations.forEach((alloc: any) => {
      const region = alloc.region
      const severity = alloc.coverage_estimate?.severity_weighted_impact || alloc.coverage_estimate?.coverage_ratio || 0.5
      const need = alloc.coverage_estimate?.people_in_need || 0
      
      // Map region names to country codes (simplified - in production use proper mapping)
      const countryCode = getCountryCodeFromRegion(region)
      if (countryCode) {
        data[countryCode] = {
          severity: Math.max(data[countryCode]?.severity || 0, severity),
          need: Math.max(data[countryCode]?.need || 0, need)
        }
      }
    })
    
    return data
  }, [realPlan])
  
  // Prepare data for funding heatmap
  const fundingData = useMemo(() => {
    const data: Record<string, { real: number; ideal: number; user: number }> = {}
    
    realPlan.allocations.forEach((realAlloc: any) => {
      const region = realAlloc.region
      const mlAlloc = mlPlan.allocations.find((a: any) => a.region === region)
      const userAlloc = userPlan.allocations.find((a: any) => a.region === region)
      
      const countryCode = getCountryCodeFromRegion(region)
      if (countryCode) {
        data[countryCode] = {
          real: (data[countryCode]?.real || 0) + realAlloc.budget,
          ideal: (data[countryCode]?.ideal || 0) + (mlAlloc?.budget || 0),
          user: (data[countryCode]?.user || 0) + (userAlloc?.budget || 0)
        }
      }
    })
    
    return data
  }, [realPlan, mlPlan, userPlan])
  
  const maxCrisis = useMemo(() => {
    return Math.max(...Object.values(crisisData).map(d => d.severity), 1)
  }, [crisisData])
  
  const maxFunding = useMemo(() => {
    return Math.max(...Object.values(fundingData).map(d => Math.max(d.real, d.ideal, d.user)), 1)
  }, [fundingData])
  
  return (
    <div className="w-full h-full grid grid-cols-2 gap-4 p-4">
      {/* Crisis/Severity Heatmap */}
      <div className="bg-black/80 border-2 border-red-500/50 rounded-lg p-6 glow-red">
        <h3 className="text-2xl font-bold mb-4 text-red-300 font-orbitron">Crisis Intensity & Need</h3>
        <div className="w-full h-[calc(100%-5rem)] bg-black/60 rounded border-2 border-red-500/30">
          <ComposableMap
            projectionConfig={{ scale: 150 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryCode = geo.properties.ISO_A2 || geo.properties.ISO_A3
                  const crisis = crisisData[countryCode]
                  const color = crisis ? getColor(crisis.severity, maxCrisis, 'crisis') : '#1a1a1a'
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: color,
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        hover: {
                          fill: '#ff6b6b',
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: {
                          fill: color,
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none'
                        }
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
        <div className="mt-2 text-xs text-red-300/70 font-exo">
          Red intensity indicates crisis severity and people in need
        </div>
      </div>
      
      {/* Funding Heatmap */}
      <div className="bg-black/80 border-2 border-cyan-500/50 rounded-lg p-6 glow-cyan">
        <h3 className="text-2xl font-bold mb-4 text-cyan-300 font-orbitron">Funding Allocation</h3>
        <div className="w-full h-[calc(100%-5rem)] bg-black/60 rounded border-2 border-cyan-500/30">
          <ComposableMap
            projectionConfig={{ scale: 150 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryCode = geo.properties.ISO_A2 || geo.properties.ISO_A3
                  const funding = fundingData[countryCode]
                  // Use real-world funding for color
                  const color = funding ? getColor(funding.real, maxFunding, 'funding') : '#1a1a1a'
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: color,
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        hover: {
                          fill: '#06b6d4',
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: {
                          fill: color,
                          stroke: '#333',
                          strokeWidth: 0.5,
                          outline: 'none'
                        }
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
        <div className="mt-2 text-xs text-cyan-300/70 font-exo">
          Blue intensity indicates funding allocation (Real-World)
        </div>
      </div>
    </div>
  )
}

// Helper to map region names to country codes
function getCountryCodeFromRegion(region: string): string | null {
  const regionToCountry: Record<string, string> = {
    // US States
    'Louisiana': 'US',
    'Mississippi': 'US',
    'Texas': 'US',
    'Florida': 'US',
    'New York': 'US',
    'New Jersey': 'US',
    'North Carolina': 'US',
    'South Carolina': 'US',
    'Georgia': 'US',
    'Alabama': 'US',
    // Countries
    'Bahamas': 'BS',
    'Puerto Rico': 'PR',
    'Dominican Republic': 'DO',
    'Haiti': 'HT',
    'Cuba': 'CU',
    'Jamaica': 'JM',
    'Philippines': 'PH',
    'Vietnam': 'VN',
    'China': 'CN',
    'Japan': 'JP',
    'Canada': 'CA',
    'Mexico': 'MX',
  }
  
  // Try exact match first
  if (regionToCountry[region]) {
    return regionToCountry[region]
  }
  
  // Try partial match
  for (const [key, code] of Object.entries(regionToCountry)) {
    if (region.includes(key) || key.includes(region)) {
      return code
    }
  }
  
  return null
}
