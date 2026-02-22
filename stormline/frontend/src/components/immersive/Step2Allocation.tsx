/**
 * Step 2 — Budget Allocation (Interactive)
 *
 * Rich interactive allocation with:
 *   - Donut chart showing proportional distribution
 *   - 3D severity vs allocation comparison bars
 *   - Per-region sliders with color-coded severity indicators
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Color palette for regions
const REGION_COLORS = [
  '#4488aa', '#aa5588', '#55aa77', '#aa7744', '#7755aa',
  '#44aa99', '#aa4455', '#5577aa', '#88aa44', '#aa6633',
]

function getRegionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length]
}

/** Donut chart showing allocation breakdown */
function AllocationDonut({ data, totalBudget, selectedRegion }: {
  data: Array<{ region: string; budget: number; color: string }>
  totalBudget: number
  selectedRegion: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const outerR = Math.min(w, h) * 0.42
    const innerR = outerR * 0.58

    ctx.clearRect(0, 0, w, h)
    if (data.length === 0) return

    const totalAllocated = data.reduce((s, d) => s + d.budget, 0)
    const remaining = totalBudget - totalAllocated

    // Draw donut segments
    let startAngle = -Math.PI / 2
    data.forEach((d) => {
      const pct = totalBudget > 0 ? d.budget / totalBudget : 0
      const sweepAngle = pct * Math.PI * 2
      if (sweepAngle < 0.005) return

      const isSelected = selectedRegion === d.region
      const segOuterR = isSelected ? outerR + 5 : outerR
      const segInnerR = isSelected ? innerR - 2 : innerR

      // Segment fill
      ctx.beginPath()
      ctx.arc(cx, cy, segOuterR, startAngle, startAngle + sweepAngle)
      ctx.arc(cx, cy, segInnerR, startAngle + sweepAngle, startAngle, true)
      ctx.closePath()
      ctx.fillStyle = isSelected ? d.color : d.color + 'bb'
      ctx.fill()

      // Segment border
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label for segments > 10%
      if (pct > 0.10) {
        const midAngle = startAngle + sweepAngle / 2
        const labelR = segOuterR + 14
        const lx = cx + Math.cos(midAngle) * labelR
        const ly = cy + Math.sin(midAngle) * labelR

        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '10px Rajdhani'
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left'
        ctx.textBaseline = 'middle'

        const label = d.region.length > 12 ? d.region.slice(0, 12) + '..' : d.region
        ctx.fillText(label, lx, ly)

        // Percentage
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = '8px DM Mono, monospace'
        ctx.fillText(`${(pct * 100).toFixed(0)}%`, lx, ly + 12)
      }

      startAngle += sweepAngle
    })

    // Remaining (unallocated) segment
    if (remaining > 0 && totalBudget > 0) {
      const remainPct = remaining / totalBudget
      const sweepAngle = remainPct * Math.PI * 2
      if (sweepAngle > 0.01) {
        ctx.beginPath()
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sweepAngle)
        ctx.arc(cx, cy, innerR, startAngle + sweepAngle, startAngle, true)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // Center text
    const utilPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 20px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${utilPct}%`, cx, cy - 8)

    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '10px Rajdhani'
    ctx.fillText('ALLOCATED', cx, cy + 10)
  }, [data, totalBudget, selectedRegion])

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={200}
      className="mx-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}

/** 3D bar chart comparing severity need vs allocation per region */
function SeverityVsAllocationChart({ data, totalBudget }: {
  data: Array<{ region: string; budget: number; severity: number; needPct: number; color: string }>
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
    const cellW = (w - 50) / cols
    const maxBarH = h * 0.52
    const baseY = h * 0.80
    const depth = 7

    // Legend
    ctx.fillStyle = 'rgba(200, 80, 80, 0.7)'
    ctx.fillRect(12, 6, 10, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '9px Rajdhani'
    ctx.textAlign = 'left'
    ctx.fillText('Need Level', 26, 12)

    ctx.fillStyle = 'rgba(80, 160, 200, 0.7)'
    ctx.fillRect(100, 6, 10, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Your Allocation', 114, 12)

    // Base line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, baseY)
    ctx.lineTo(w - 10, baseY)
    ctx.stroke()

    // Perspective grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let g = 0; g <= cols; g++) {
      const x = 30 + g * cellW
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x + depth, baseY - depth)
      ctx.stroke()
    }

    data.forEach((d, i) => {
      const x = 30 + i * cellW + cellW * 0.08
      const barGroupW = cellW * 0.84
      const singleBarW = barGroupW * 0.42
      const gap = barGroupW * 0.08

      // ── Severity/need bar (red/orange/green) ──
      const needH = Math.max(3, d.needPct * maxBarH)
      const sevColor = d.severity > 0.7
        ? 'rgba(200, 60, 60,'
        : d.severity > 0.4
          ? 'rgba(200, 160, 60,'
          : 'rgba(60, 160, 100,'

      // Front face
      ctx.fillStyle = `${sevColor} 0.6)`
      ctx.fillRect(x, baseY - needH, singleBarW, needH)
      // Top face
      ctx.fillStyle = `${sevColor} 0.4)`
      ctx.beginPath()
      ctx.moveTo(x, baseY - needH)
      ctx.lineTo(x + depth * 0.6, baseY - needH - depth * 0.6)
      ctx.lineTo(x + singleBarW + depth * 0.6, baseY - needH - depth * 0.6)
      ctx.lineTo(x + singleBarW, baseY - needH)
      ctx.closePath()
      ctx.fill()
      // Right face
      ctx.fillStyle = `${sevColor} 0.25)`
      ctx.beginPath()
      ctx.moveTo(x + singleBarW, baseY)
      ctx.lineTo(x + singleBarW + depth * 0.6, baseY - depth * 0.6)
      ctx.lineTo(x + singleBarW + depth * 0.6, baseY - needH - depth * 0.6)
      ctx.lineTo(x + singleBarW, baseY - needH)
      ctx.closePath()
      ctx.fill()

      // ── Allocation bar (blue, uses region color) ──
      const allocX = x + singleBarW + gap
      const allocH = Math.max(3, (d.budget / maxVal) * maxBarH)
      const alpha = 0.4 + (d.budget / maxVal) * 0.5

      // Front face
      ctx.fillStyle = `rgba(80, 160, 200, ${alpha})`
      ctx.fillRect(allocX, baseY - allocH, singleBarW, allocH)
      // Top face
      ctx.fillStyle = `rgba(80, 160, 200, ${alpha * 0.7})`
      ctx.beginPath()
      ctx.moveTo(allocX, baseY - allocH)
      ctx.lineTo(allocX + depth * 0.6, baseY - allocH - depth * 0.6)
      ctx.lineTo(allocX + singleBarW + depth * 0.6, baseY - allocH - depth * 0.6)
      ctx.lineTo(allocX + singleBarW, baseY - allocH)
      ctx.closePath()
      ctx.fill()
      // Right face
      ctx.fillStyle = `rgba(80, 160, 200, ${alpha * 0.3})`
      ctx.beginPath()
      ctx.moveTo(allocX + singleBarW, baseY)
      ctx.lineTo(allocX + singleBarW + depth * 0.6, baseY - depth * 0.6)
      ctx.lineTo(allocX + singleBarW + depth * 0.6, baseY - allocH - depth * 0.6)
      ctx.lineTo(allocX + singleBarW, baseY - allocH)
      ctx.closePath()
      ctx.fill()

      // Contour lines on allocation bar
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 0.5
      const contours = Math.floor(allocH / 16)
      for (let c = 0; c < contours; c++) {
        const cy = baseY - (c * 16) - 8
        ctx.beginPath()
        ctx.moveTo(allocX, cy)
        ctx.lineTo(allocX + singleBarW, cy)
        ctx.stroke()
      }

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.font = '10px Rajdhani'
      ctx.textAlign = 'center'
      ctx.fillText(
        d.region.length > 10 ? d.region.slice(0, 10) + '..' : d.region,
        x + barGroupW / 2,
        baseY + 14
      )

      // Budget value
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '9px DM Mono, monospace'
      ctx.fillText(
        formatBudget(d.budget),
        x + barGroupW / 2,
        baseY - Math.max(allocH, needH) - 10
      )
    })
  }, [data, totalBudget])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={220}
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

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

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
    return regions.map((region, i) => ({
      region,
      budget: gameAllocations[region] || 0,
      severity: coverageLookup[region]?.severity || 0.5,
      needPct: (coverageLookup[region]?.need || 0) / maxNeed,
      color: getRegionColor(i),
    }))
  }, [regions, gameAllocations, coverageLookup])

  if (!selectedHurricane) return null

  const utilizationPct = gameTotalBudget > 0 ? (totalAllocated / gameTotalBudget) * 100 : 0

  return (
    <div className="space-y-4">
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

      {/* Donut Chart — proportional distribution */}
      <div>
        <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-1 text-center">
          Budget Distribution
        </div>
        <AllocationDonut
          data={vizData}
          totalBudget={gameTotalBudget}
          selectedRegion={selectedRegion}
        />
      </div>

      {/* Severity vs Allocation — 3D comparison bar chart */}
      <div>
        <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-1 text-center">
          Need vs Your Allocation
        </div>
        <SeverityVsAllocationChart data={vizData} totalBudget={gameTotalBudget} />
      </div>

      {/* Region sliders — interactive allocation controls */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {regions.map((region, idx) => {
          const cov = coverageLookup[region]
          const value = gameAllocations[region] || 0
          const fillPct = gameTotalBudget > 0 ? (value / gameTotalBudget) * 100 : 0
          const color = getRegionColor(idx)

          return (
            <div
              key={region}
              className={`flex items-center gap-3 py-1 px-1.5 rounded transition-colors cursor-pointer ${
                selectedRegion === region ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              }`}
              onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
            >
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-white/80 font-rajdhani text-xs tracking-wide truncate block">
                    {region}
                  </span>
                  {cov && (
                    <span className={`text-[8px] font-mono ${
                      cov.severity > 0.7 ? 'text-red-400/60' : cov.severity > 0.4 ? 'text-yellow-400/60' : 'text-green-400/60'
                    }`}>
                      Sev: {(cov.severity * 10).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={gameTotalBudget}
                step={Math.max(1000, Math.floor(gameTotalBudget / 200))}
                value={value}
                onChange={(e) => {
                  e.stopPropagation()
                  handleAllocationChange(region, Number(e.target.value))
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-[6px] appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${color} 0%, ${color} ${fillPct}%, rgba(255,255,255,0.1) ${fillPct}%, rgba(255,255,255,0.1) 100%)`,
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
