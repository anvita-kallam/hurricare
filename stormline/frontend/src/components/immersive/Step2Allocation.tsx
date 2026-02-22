/**
 * Step 2 — Budget Allocation (Interactive)
 *
 * User allocates budget to regions.
 * Visualization reacts in real time (extruded regions, stacked depth planes).
 * No other UI elements besides the allocation controls and 3D viz.
 */

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Depth-layered allocation bar field — updates in real time as user adjusts */
function AllocationSurface({ data, totalBudget }: {
  data: Array<{ region: string; budget: number; severity: number; needPct: number }>
  totalBudget: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (data.length === 0) return

    const maxVal = Math.max(totalBudget * 0.5, ...data.map(d => d.budget), 1)
    const cols = data.length
    const cellW = (w - 40) / cols
    const maxBarH = h * 0.55
    const baseY = h * 0.82
    const depth = 12

    // Perspective grid base
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 0.5
    for (let g = 0; g <= cols; g++) {
      const x = 20 + g * cellW
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x + depth * 0.5, baseY - depth * 0.7)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(20, baseY)
    ctx.lineTo(20 + cols * cellW, baseY)
    ctx.stroke()

    data.forEach((d, i) => {
      const x = 20 + i * cellW + cellW * 0.15
      const barW = cellW * 0.7
      const barH = Math.max(2, (d.budget / maxVal) * maxBarH)

      // Severity background bar (shows total need)
      const needH = d.needPct * maxBarH
      ctx.fillStyle = 'rgba(200, 60, 60, 0.15)'
      ctx.fillRect(x, baseY - needH, barW, needH)

      // Right depth face
      ctx.fillStyle = 'rgba(68, 136, 170, 0.35)'
      ctx.beginPath()
      ctx.moveTo(x + barW, baseY)
      ctx.lineTo(x + barW + depth, baseY - depth)
      ctx.lineTo(x + barW + depth, baseY - depth - barH)
      ctx.lineTo(x + barW, baseY - barH)
      ctx.closePath()
      ctx.fill()

      // Top depth face
      ctx.fillStyle = 'rgba(68, 136, 170, 0.55)'
      ctx.beginPath()
      ctx.moveTo(x, baseY - barH)
      ctx.lineTo(x + depth, baseY - barH - depth)
      ctx.lineTo(x + barW + depth, baseY - barH - depth)
      ctx.lineTo(x + barW, baseY - barH)
      ctx.closePath()
      ctx.fill()

      // Front face
      const alpha = 0.45 + (d.budget / maxVal) * 0.45
      ctx.fillStyle = `rgba(80, 160, 200, ${alpha})`
      ctx.fillRect(x, baseY - barH, barW, barH)

      // Contour lines
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 0.5
      const contours = Math.floor(barH / 14)
      for (let c = 0; c < contours; c++) {
        const cy = baseY - (c * 14) - 7
        ctx.beginPath()
        ctx.moveTo(x, cy)
        ctx.lineTo(x + barW, cy)
        ctx.stroke()
      }

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '11px Rajdhani'
      ctx.textAlign = 'center'
      ctx.fillText(
        d.region.length > 10 ? d.region.slice(0, 10) + '..' : d.region,
        x + barW / 2,
        baseY + 16
      )

      // Budget value
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '11px DM Mono, monospace'
      ctx.fillText(
        formatBudget(d.budget),
        x + barW / 2,
        baseY - barH - 8
      )
    })
  }, [data, totalBudget])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={240}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}

export default function Step2Allocation() {
  const {
    selectedHurricane,
    coverage,
    gameTotalBudget,
    gameAllocations,
    updateGameAllocation,
    setGameAllocations,
  } = useStore()

  // Derive regions from coverage data
  const regions = useMemo(() => {
    if (!selectedHurricane) return []
    const fromCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => c.admin1)
      .filter((v, i, a) => a.indexOf(v) === i)
    if (fromCoverage.length > 0) return fromCoverage
    return (selectedHurricane.affected_countries || [])
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
  }, [selectedHurricane, coverage])

  // Coverage lookup
  const coverageLookup = useMemo(() => {
    if (!selectedHurricane) return {} as Record<string, { severity: number; need: number }>
    const result: Record<string, { severity: number; need: number }> = {}
    coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .forEach(c => {
        result[c.admin1] = {
          severity: Math.min(c.severity_index / 10, 1),
          need: c.people_in_need,
        }
      })
    return result
  }, [selectedHurricane, coverage])

  // Initialize allocations if empty
  useEffect(() => {
    if (regions.length > 0 && Object.keys(gameAllocations).length === 0) {
      const initial: Record<string, number> = {}
      const totalSeverity = regions.reduce((s, r) => s + (coverageLookup[r]?.severity || 0.5), 0) || 1
      regions.forEach(region => {
        const severity = coverageLookup[region]?.severity || 0.5
        initial[region] = Math.round((severity / totalSeverity) * gameTotalBudget)
      })
      setGameAllocations(initial)
    }
  }, [regions, gameAllocations, gameTotalBudget, coverageLookup, setGameAllocations])

  const totalAllocated = useMemo(() => {
    return Object.values(gameAllocations).reduce((s, v) => s + (v || 0), 0)
  }, [gameAllocations])

  const remaining = gameTotalBudget - totalAllocated

  const handleAllocationChange = useCallback((region: string, value: number) => {
    const currentRegionVal = gameAllocations[region] || 0
    const otherAllocated = totalAllocated - currentRegionVal
    const maxForRegion = gameTotalBudget - otherAllocated
    updateGameAllocation(region, Math.max(0, Math.min(value, maxForRegion)))
  }, [gameAllocations, totalAllocated, gameTotalBudget, updateGameAllocation])

  // Build visualization data
  const vizData = useMemo(() => {
    const maxNeed = Math.max(...regions.map(r => coverageLookup[r]?.need || 0), 1)
    return regions.map(region => ({
      region,
      budget: gameAllocations[region] || 0,
      severity: coverageLookup[region]?.severity || 0.5,
      needPct: (coverageLookup[region]?.need || 0) / maxNeed,
    }))
  }, [regions, gameAllocations, coverageLookup])

  if (!selectedHurricane) return null

  const utilizationPct = gameTotalBudget > 0 ? (totalAllocated / gameTotalBudget) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="text-white/50 font-rajdhani text-[11px] tracking-[0.3em] uppercase">
          Resource Allocation
        </div>
        <h2 className="text-white font-rajdhani font-bold text-2xl tracking-wider">
          Distribute Your Budget
        </h2>
      </div>

      {/* Budget summary */}
      <div className="flex justify-center gap-8">
        <div className="text-center">
          <div className="text-white/90 font-mono text-base font-medium">{formatBudget(gameTotalBudget)}</div>
          <div className="text-white/50 font-rajdhani text-[11px] tracking-widest uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-[#64b4dc] font-mono text-base font-medium">{formatBudget(totalAllocated)}</div>
          <div className="text-white/50 font-rajdhani text-[11px] tracking-widest uppercase">Allocated</div>
        </div>
        <div className="text-center">
          <div className={`font-mono text-base font-medium ${remaining < 0 ? 'text-[#cc5566]' : 'text-white/70'}`}>
            {formatBudget(Math.abs(remaining))}
          </div>
          <div className="text-white/50 font-rajdhani text-[11px] tracking-widest uppercase">
            {remaining >= 0 ? 'Remaining' : 'Over'}
          </div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mx-auto w-56 h-[5px] bg-white/[0.1] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(utilizationPct, 100)}%`,
            backgroundColor: remaining < 0 ? '#cc5566' : 'rgba(100, 180, 220, 0.7)',
          }}
        />
      </div>

      {/* 3D Visualization — updates in real time */}
      <AllocationSurface data={vizData} totalBudget={gameTotalBudget} />

      {/* Region sliders */}
      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
        {regions.map(region => {
          const cov = coverageLookup[region]
          const value = gameAllocations[region] || 0
          const fillPct = gameTotalBudget > 0 ? (value / gameTotalBudget) * 100 : 0

          return (
            <div key={region} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: cov && cov.severity > 0.7
                      ? 'rgba(220, 70, 70, 1)'
                      : cov && cov.severity > 0.4
                        ? 'rgba(220, 180, 60, 1)'
                        : 'rgba(60, 180, 110, 1)',
                  }}
                />
                <span className="text-white/80 font-rajdhani text-xs tracking-wide truncate">
                  {region}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={gameTotalBudget}
                step={Math.max(1000, Math.floor(gameTotalBudget / 200))}
                value={value}
                onChange={(e) => handleAllocationChange(region, Number(e.target.value))}
                className="flex-1 h-[6px] appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(100,180,220,0.7) 0%, rgba(100,180,220,0.7) ${fillPct}%, rgba(255,255,255,0.1) ${fillPct}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <span className="text-white/70 font-mono text-[11px] w-16 text-right shrink-0">
                {formatBudget(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
