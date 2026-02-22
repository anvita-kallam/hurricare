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
    // Greyscale gradient for crisis/severity
    const intensity = Math.min(value / maxValue, 1)
    const v = Math.floor(30 + (200 - 30) * intensity)
    return `rgb(${v}, ${v}, ${v})`
  } else {
    // Greyscale gradient for funding
    const intensity = Math.min(value / maxValue, 1)
    const v = Math.floor(25 + (180 - 25) * intensity)
    return `rgb(${v}, ${v}, ${v})`
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
      <div className="bg-black/80 border border-white/[0.06] rounded-sm p-6 flex flex-col">
        <h3 className="text-2xl font-bold mb-4 text-white/60 font-rajdhani">Crisis Intensity & Need</h3>
        <div className="w-full flex-1 bg-black/60 rounded border border-white/[0.04]">
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
                          stroke: '#000000',
                          strokeWidth: 1,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        hover: {
                          fill: color,
                          stroke: '#ffffff',
                          strokeWidth: 2,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: {
                          fill: color,
                          stroke: '#ffffff',
                          strokeWidth: 3,
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
        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 p-2 bg-black/40 rounded">
          <div className="flex-1 flex items-center gap-1">
            <span className="text-xs text-white/40 font-rajdhani">Low</span>
            {[0, 0.25, 0.5, 0.75, 1].map((val) => (
              <div key={val} className="flex-1 h-3 rounded-sm" style={{
                background: getColor(val * maxCrisis, maxCrisis, 'crisis')
              }} />
            ))}
            <span className="text-xs text-white/40 font-rajdhani">High</span>
          </div>
        </div>
      </div>

      {/* Funding Heatmap */}
      <div className="bg-black/80 border border-white/[0.06] rounded-sm p-6 flex flex-col">
        <h3 className="text-2xl font-bold mb-4 text-white/60 font-rajdhani">Funding Allocation</h3>
        <div className="w-full flex-1 bg-black/60 rounded border border-white/[0.04]">
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
                          stroke: '#000000',
                          strokeWidth: 1,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        hover: {
                          fill: color,
                          stroke: '#ffffff',
                          strokeWidth: 2,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: {
                          fill: color,
                          stroke: '#ffffff',
                          strokeWidth: 3,
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
        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 p-2 bg-black/40 rounded">
          <div className="flex-1 flex items-center gap-1">
            <span className="text-xs text-white/40 font-rajdhani">Low</span>
            {[0, 0.25, 0.5, 0.75, 1].map((val) => (
              <div key={val} className="flex-1 h-3 rounded-sm" style={{
                background: getColor(val * maxFunding, maxFunding, 'funding')
              }} />
            ))}
            <span className="text-xs text-white/40 font-rajdhani">High</span>
          </div>
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
