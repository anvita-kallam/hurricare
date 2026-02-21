import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface VisualizationProps {
  userPlan: any
  mlPlan: any
  realPlan: any
  mismatchAnalysis?: any
}

// Generate synthetic sub-regional data for heatmaps
function generateSubRegionalData(allocations: any[], planType: string) {
  const subRegions: any[] = []
  
  allocations.forEach(alloc => {
    // Generate 3-5 sub-regions per region with varying severity and funding
    const numSubRegions = 3 + Math.floor(Math.random() * 3)
      const baseSeverity = alloc.coverage_estimate?.severity_weighted_impact || alloc.coverage_estimate?.coverage_ratio || 0.5
    const baseBudget = alloc.budget
    
    for (let i = 0; i < numSubRegions; i++) {
      const severityVariation = 0.2 + Math.random() * 0.6 // 0.2 to 0.8 multiplier
      const fundingVariation = 0.15 + Math.random() * 0.7 // 0.15 to 0.85 multiplier
      
      subRegions.push({
        region: alloc.region,
        subRegion: `${alloc.region} - Zone ${i + 1}`,
        severity: baseSeverity * severityVariation,
        need: Math.floor((alloc.coverage_estimate?.people_in_need || 0) * (0.2 + Math.random() * 0.3)),
        funding: baseBudget * fundingVariation / numSubRegions,
        planType,
        coverage: (baseBudget * fundingVariation / numSubRegions) / ((alloc.coverage_estimate?.people_in_need || 0) * (0.2 + Math.random() * 0.3) * 500)
      })
    }
  })
  
  return subRegions
}

export function FundingVsNeedHeatmap({ userPlan, mlPlan, realPlan }: VisualizationProps) {
  const heatmapData = useMemo(() => {
    const data: any[] = []
    
    realPlan.allocations.forEach(realAlloc => {
      const userAlloc = userPlan.allocations.find((a: any) => a.region === realAlloc.region)
      const mlAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
      
      const need = realAlloc.coverage_estimate?.people_in_need || 0
      const severity = realAlloc.coverage_estimate?.severity_weighted_impact || realAlloc.coverage_estimate?.coverage_ratio || 0.5
      
      data.push({
        region: realAlloc.region,
        need: need,
        severity: severity,
        userFunding: userAlloc?.budget || 0,
        mlFunding: mlAlloc?.budget || 0,
        realFunding: realAlloc.budget,
        userCoverage: userAlloc?.coverage_estimate?.coverage_ratio || 0,
        mlCoverage: mlAlloc?.coverage_estimate?.coverage_ratio || 0,
        realCoverage: realAlloc.coverage_estimate?.coverage_ratio || 0,
      })
    })
    
    return data.sort((a, b) => b.severity - a.severity)
  }, [userPlan, mlPlan, realPlan])
  
  return (
    <div className="bg-black/40 p-4 rounded border border-cyan-500/20">
      <h4 className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Funding vs Need by Region</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={heatmapData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00bcd4" opacity={0.2} />
          <XAxis 
            dataKey="region" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fill: '#00bcd4', fontSize: 10 }}
            interval={0}
          />
          <YAxis tick={{ fill: '#00bcd4', fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#000', border: '1px solid #00bcd4', borderRadius: '4px' }}
            labelStyle={{ color: '#00bcd4', fontFamily: 'Orbitron' }}
          />
          <Legend />
          <Bar dataKey="need" fill="#ff6b6b" name="People in Need" />
          <Bar dataKey="userFunding" fill="#00bcd4" name="Your Plan" />
          <Bar dataKey="mlFunding" fill="#9c27b0" name="ML Ideal" />
          <Bar dataKey="realFunding" fill="#f44336" name="Real-World" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CoverageGapChart({ userPlan, mlPlan, realPlan }: VisualizationProps) {
  const gapData = useMemo(() => {
    return realPlan.allocations.map((realAlloc: any) => {
      const userAlloc = userPlan.allocations.find((a: any) => a.region === realAlloc.region)
      const mlAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
      
      const idealCoverage = mlAlloc?.coverage_estimate?.coverage_ratio || 0
      const realCoverage = realAlloc.coverage_estimate?.coverage_ratio || 0
      const userCoverage = userAlloc?.coverage_estimate?.coverage_ratio || 0
      
      return {
        region: realAlloc.region,
        ideal: idealCoverage * 100,
        real: realCoverage * 100,
        user: userCoverage * 100,
        gap: (idealCoverage - realCoverage) * 100,
      }
    }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  }, [userPlan, mlPlan, realPlan])
  
  return (
    <div className="bg-black/40 p-4 rounded border border-cyan-500/20">
      <h4 className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Coverage Gap Analysis</h4>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={gapData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00bcd4" opacity={0.2} />
          <XAxis 
            dataKey="region" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fill: '#00bcd4', fontSize: 10 }}
            interval={0}
          />
          <YAxis tick={{ fill: '#00bcd4', fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#000', border: '1px solid #00bcd4', borderRadius: '4px' }}
            labelStyle={{ color: '#00bcd4', fontFamily: 'Orbitron' }}
          />
          <Legend />
          <Area type="monotone" dataKey="ideal" stackId="1" stroke="#9c27b0" fill="#9c27b0" fillOpacity={0.6} name="ML Ideal Coverage %" />
          <Area type="monotone" dataKey="real" stackId="2" stroke="#f44336" fill="#f44336" fillOpacity={0.6} name="Real-World Coverage %" />
          <Area type="monotone" dataKey="user" stackId="3" stroke="#00bcd4" fill="#00bcd4" fillOpacity={0.4} name="Your Plan Coverage %" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RegionalHeatmap({ userPlan, mlPlan, realPlan }: VisualizationProps) {
  const heatmapData = useMemo(() => {
    const userSubRegions = generateSubRegionalData(userPlan.allocations, 'user')
    const mlSubRegions = generateSubRegionalData(mlPlan.allocations, 'ml')
    const realSubRegions = generateSubRegionalData(realPlan.allocations, 'real')
    
    // Combine and group by region
    const regionMap: any = {}
    
    ;[...userSubRegions, ...mlSubRegions, ...realSubRegions].forEach(sub => {
      if (!regionMap[sub.region]) {
        regionMap[sub.region] = {
          region: sub.region,
          subRegions: []
        }
      }
      regionMap[sub.region].subRegions.push(sub)
    })
    
    return Object.values(regionMap)
  }, [userPlan, mlPlan, realPlan])
  
  return (
    <div className="bg-black/40 p-4 rounded border border-cyan-500/20">
      <h4 className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Regional Intensity Heatmap</h4>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {heatmapData.map((regionData: any) => {
          const subRegions = regionData.subRegions.filter((s: any) => s.planType === 'real')
          const maxSeverity = Math.max(...subRegions.map((s: any) => s.severity))
          const maxFunding = Math.max(...subRegions.map((s: any) => s.funding))
          
          return (
            <div key={regionData.region} className="bg-black/60 p-3 rounded border border-cyan-500/10">
              <div className="font-semibold text-cyan-200 mb-2 font-exo">{regionData.region}</div>
              <div className="grid grid-cols-2 gap-2">
                {subRegions.map((sub: any, idx: number) => {
                  const severityIntensity = (sub.severity / maxSeverity) * 100
                  const fundingIntensity = (sub.funding / maxFunding) * 100
                  const mismatch = Math.abs(severityIntensity - fundingIntensity)
                  
                  return (
                    <div key={idx} className="bg-black/40 p-2 rounded border border-cyan-500/20">
                      <div className="text-xs text-cyan-300/70 font-exo mb-1">{sub.subRegion.split(' - ')[1]}</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 font-exo">Crisis:</span>
                          <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                              style={{ width: `${severityIntensity}%` }}
                            />
                          </div>
                          <span className="text-xs text-cyan-300 font-orbitron">{severityIntensity.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 font-exo">Funding:</span>
                          <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-teal-500 transition-all"
                              style={{ width: `${fundingIntensity}%` }}
                            />
                          </div>
                          <span className="text-xs text-cyan-300 font-orbitron">{fundingIntensity.toFixed(0)}%</span>
                        </div>
                        {mismatch > 20 && (
                          <div className="text-xs text-yellow-400 font-exo mt-1">
                            Mismatch: {mismatch.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function OutcomeRadarChart({ userPlan, mlPlan, realPlan, mismatchAnalysis }: VisualizationProps) {
  const radarData = useMemo(() => {
    const userCoverage = userPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / userPlan.allocations.length
    const mlCoverage = mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / mlPlan.allocations.length
    const realCoverage = realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.coverage_ratio || 0), 0) / realPlan.allocations.length
    
    const userPeople = userPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0)
    const mlPeople = mlPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0)
    const realPeople = realPlan.allocations.reduce((sum: number, a: any) => sum + (a.coverage_estimate?.people_covered || 0), 0)
    
    const maxPeople = Math.max(userPeople, mlPeople, realPeople)
    
    return [
      {
        metric: 'Coverage',
        user: userCoverage * 100,
        ml: mlCoverage * 100,
        real: realCoverage * 100,
      },
      {
        metric: 'People Reached',
        user: (userPeople / maxPeople) * 100,
        ml: (mlPeople / maxPeople) * 100,
        real: (realPeople / maxPeople) * 100,
      },
      {
        metric: 'Equity',
        user: 100 - (mismatchAnalysis?.equity_deviation || 0) * 100,
        ml: 100,
        real: 100 - (mismatchAnalysis?.equity_deviation || 0) * 100,
      },
      {
        metric: 'Efficiency',
        user: 100 - (mismatchAnalysis?.efficiency_loss || 0) * 50,
        ml: 100,
        real: 100 - (mismatchAnalysis?.efficiency_loss || 0) * 100,
      },
      {
        metric: 'Budget Utilization',
        user: 95,
        ml: 100,
        real: 85,
      },
    ]
  }, [userPlan, mlPlan, realPlan, mismatchAnalysis])
  
  return (
    <div className="bg-black/40 p-4 rounded border border-cyan-500/20">
      <h4 className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Outcome Comparison Radar</h4>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#00bcd4" opacity={0.3} />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#00bcd4', fontSize: 11, fontFamily: 'Exo 2' }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#00bcd4', fontSize: 10 }} />
          <Radar name="Your Plan" dataKey="user" stroke="#00bcd4" fill="#00bcd4" fillOpacity={0.4} />
          <Radar name="ML Ideal" dataKey="ml" stroke="#9c27b0" fill="#9c27b0" fillOpacity={0.4} />
          <Radar name="Real-World" dataKey="real" stroke="#f44336" fill="#f44336" fillOpacity={0.4} />
          <Legend />
          <Tooltip 
            contentStyle={{ backgroundColor: '#000', border: '1px solid #00bcd4', borderRadius: '4px' }}
            labelStyle={{ color: '#00bcd4', fontFamily: 'Orbitron' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SeverityVsFundingScatter({ userPlan, mlPlan, realPlan }: VisualizationProps) {
  const scatterData = useMemo(() => {
    return realPlan.allocations.map((realAlloc: any) => {
      const userAlloc = userPlan.allocations.find((a: any) => a.region === realAlloc.region)
      const mlAlloc = mlPlan.allocations.find((a: any) => a.region === realAlloc.region)
      
      const severity = realAlloc.coverage_estimate?.severity_weighted_impact || realAlloc.coverage_estimate?.coverage_ratio || 0.5
      
      return {
        region: realAlloc.region,
        severity: severity * 100,
        userFunding: (userAlloc?.budget || 0) / 1000000, // Convert to millions
        mlFunding: (mlAlloc?.budget || 0) / 1000000,
        realFunding: realAlloc.budget / 1000000,
      }
    })
  }, [userPlan, mlPlan, realPlan])
  
  return (
    <div className="bg-black/40 p-4 rounded border border-cyan-500/20">
      <h4 className="text-sm font-semibold mb-3 text-cyan-200 font-orbitron">Severity vs Funding Allocation</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={scatterData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00bcd4" opacity={0.2} />
          <XAxis 
            dataKey="severity" 
            type="number"
            domain={[0, 100]}
            label={{ value: 'Severity Index', position: 'insideBottom', offset: -5, fill: '#00bcd4', fontFamily: 'Exo 2' }}
            tick={{ fill: '#00bcd4', fontSize: 10 }}
          />
          <YAxis 
            label={{ value: 'Funding (Millions USD)', angle: -90, position: 'insideLeft', fill: '#00bcd4', fontFamily: 'Exo 2' }}
            tick={{ fill: '#00bcd4', fontSize: 10 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#000', border: '1px solid #00bcd4', borderRadius: '4px' }}
            labelStyle={{ color: '#00bcd4', fontFamily: 'Orbitron' }}
            formatter={(value: any) => [`$${value.toFixed(2)}M`, '']}
          />
          <Legend />
          <Bar dataKey="userFunding" fill="#00bcd4" name="Your Plan" />
          <Bar dataKey="mlFunding" fill="#9c27b0" name="ML Ideal" />
          <Bar dataKey="realFunding" fill="#f44336" name="Real-World" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
