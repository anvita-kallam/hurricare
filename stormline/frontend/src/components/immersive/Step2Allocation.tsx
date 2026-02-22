/**
 * Step 2 — Budget Allocation (Interactive)
 *
 * Full cluster-level allocation per region (6 humanitarian clusters × N regions):
 *   - Emergency Shelter and NFI, Food Security, Health, WASH, Logistics, Early Recovery
 *   - 3D topography terrain chart showing severity landscape
 *   - Donut pie chart with 3D depth showing budget distribution by category
 *   - ALL regions visible with per-cluster sliders (no collapsing)
 *   - Response window setting
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import axios from 'axios'
import { useStore } from '../../state/useStore'

const API_BASE = 'http://localhost:8000'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Standard humanitarian clusters (same as ML model & SimulationEngine)
const CLUSTERS = [
  'Emergency Shelter and NFI',
  'Food Security',
  'Health',
  'Water Sanitation Hygiene',
  'Logistics',
  'Early Recovery',
] as const

const CLUSTER_SHORT: Record<string, string> = {
  'Emergency Shelter and NFI': 'Shelter',
  'Food Security': 'Food',
  'Health': 'Health',
  'Water Sanitation Hygiene': 'WASH',
  'Logistics': 'Logistics',
  'Early Recovery': 'Recovery',
}

const CLUSTER_COLORS: Record<string, string> = {
  'Emergency Shelter and NFI': '#4488aa',
  'Food Security': '#55aa77',
  'Health': '#aa5588',
  'Water Sanitation Hygiene': '#44aaaa',
  'Logistics': '#aa7744',
  'Early Recovery': '#7755aa',
}

/** 3D Donut pie chart with depth/extrusion showing budget by category */
function ClusterDonut3D({ clusterTotals, totalBudget, totalAllocated }: {
  clusterTotals: Record<string, number>
  totalBudget: number
  totalAllocated: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 280 * dpr
    canvas.height = 200 * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = '280px'
    canvas.style.height = '200px'

    const w = 280
    const h = 200
    const cx = w / 2
    const cy = h / 2 + 5
    const outerR = 72
    const innerR = 40
    const extrudeH = 12 // 3D depth

    ctx.clearRect(0, 0, w, h)

    const entries = CLUSTERS.map(c => ({
      cluster: c,
      amount: clusterTotals[c] || 0,
      color: CLUSTER_COLORS[c],
      short: CLUSTER_SHORT[c],
    })).filter(e => e.amount > 0)

    const remaining = totalBudget - totalAllocated

    // Draw the 3D extrusion (bottom layer) first
    let startAngle = -Math.PI / 2
    entries.forEach((e) => {
      const pct = totalBudget > 0 ? e.amount / totalBudget : 0
      const sweep = pct * Math.PI * 2
      if (sweep < 0.01) return

      // Extrusion (side walls) — only draw bottom half of arc
      for (let a = startAngle; a < startAngle + sweep; a += 0.02) {
        const endA = Math.min(a + 0.04, startAngle + sweep)
        const x1 = cx + Math.cos(a) * outerR
        const y1 = cy + Math.sin(a) * outerR
        const x2 = cx + Math.cos(endA) * outerR
        const y2 = cy + Math.sin(endA) * outerR

        // Only draw extrusion for bottom-facing parts
        if (Math.sin(a) > -0.3) {
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.lineTo(x2, y2 + extrudeH)
          ctx.lineTo(x1, y1 + extrudeH)
          ctx.closePath()

          const r = parseInt(e.color.slice(1, 3), 16)
          const g = parseInt(e.color.slice(3, 5), 16)
          const b = parseInt(e.color.slice(5, 7), 16)
          ctx.fillStyle = `rgba(${Math.floor(r * 0.5)},${Math.floor(g * 0.5)},${Math.floor(b * 0.5)},0.8)`
          ctx.fill()
        }
      }
      startAngle += sweep
    })

    // Draw main donut segments (top face)
    startAngle = -Math.PI / 2
    entries.forEach((e) => {
      const pct = totalBudget > 0 ? e.amount / totalBudget : 0
      const sweep = pct * Math.PI * 2
      if (sweep < 0.01) return

      ctx.beginPath()
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep)
      ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true)
      ctx.closePath()

      const r = parseInt(e.color.slice(1, 3), 16)
      const g = parseInt(e.color.slice(3, 5), 16)
      const b = parseInt(e.color.slice(5, 7), 16)

      // Gradient fill for depth look
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
      grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
      grad.addColorStop(1, `rgba(${Math.floor(r * 0.7)},${Math.floor(g * 0.7)},${Math.floor(b * 0.7)},0.85)`)
      ctx.fillStyle = grad
      ctx.fill()

      // Segment border
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Label for segments > 6%
      if (pct > 0.06) {
        const mid = startAngle + sweep / 2
        const lr = outerR + 16
        const lx = cx + Math.cos(mid) * lr
        const ly = cy + Math.sin(mid) * lr

        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.font = 'bold 10px Rajdhani'
        ctx.textAlign = mid > Math.PI / 2 && mid < Math.PI * 1.5 ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(e.short, lx, ly)

        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = '9px DM Mono, monospace'
        ctx.fillText(`${(pct * 100).toFixed(0)}%`, lx, ly + 12)
      }

      startAngle += sweep
    })

    // Remaining (unallocated) segment
    if (remaining > 0 && totalBudget > 0) {
      const pct = remaining / totalBudget
      const sweep = pct * Math.PI * 2
      if (sweep > 0.01) {
        ctx.beginPath()
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep)
        ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.stroke()
      }
    }

    // Inner shadow for depth
    const innerGrad = ctx.createRadialGradient(cx, cy, innerR - 3, cx, cy, innerR + 3)
    innerGrad.addColorStop(0, 'rgba(0,0,0,0)')
    innerGrad.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx.beginPath()
    ctx.arc(cx, cy, innerR + 3, 0, Math.PI * 2)
    ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.fillStyle = innerGrad
    ctx.fill()

    // Center text
    const utilPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = 'bold 22px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${utilPct}%`, cx, cy - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '9px Rajdhani'
    ctx.fillText('ALLOCATED', cx, cy + 12)
  }, [clusterTotals, totalBudget, totalAllocated])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto"
      style={{ width: 280, height: 200, imageRendering: 'auto' }}
    />
  )
}

/** 3D Topography terrain chart — severity landscape with allocation peaks */
function SeverityTerrainChart({ data, totalBudget }: {
  data: Array<{ region: string; total: number; severity: number; needPct: number; need: number }>
  totalBudget: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 600 * dpr
    canvas.height = 220 * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = '600px'
    canvas.style.height = '220px'

    const w = 600
    const h = 220
    ctx.clearRect(0, 0, w, h)
    if (data.length === 0) return

    const maxVal = Math.max(totalBudget * 0.35, ...data.map(d => d.total), 1)
    const cols = data.length
    const cellW = (w - 80) / cols
    const maxBarH = h * 0.50
    const baseY = h * 0.78
    const depth = 10
    const perspSkew = 0.4

    // Terrain grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let y = 0; y <= 5; y++) {
      const gridY = baseY - (y / 5) * maxBarH
      ctx.beginPath()
      ctx.moveTo(40, gridY)
      ctx.lineTo(w - 30, gridY)
      ctx.stroke()
    }

    // Ground terrain effect — gradient base
    const groundGrad = ctx.createLinearGradient(40, baseY, w - 30, baseY)
    data.forEach((d, i) => {
      const t = i / Math.max(cols - 1, 1)
      const sev = d.severity
      if (sev > 0.7) {
        groundGrad.addColorStop(t, 'rgba(180,50,50,0.15)')
      } else if (sev > 0.4) {
        groundGrad.addColorStop(t, 'rgba(180,160,50,0.1)')
      } else {
        groundGrad.addColorStop(t, 'rgba(50,150,80,0.08)')
      }
    })
    ctx.fillStyle = groundGrad
    ctx.fillRect(40, baseY, w - 70, 3)

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '10px Rajdhani'
    ctx.textAlign = 'left'

    // Severity terrain bar (behind)
    ctx.fillStyle = 'rgba(200,80,80,0.5)'
    ctx.fillRect(42, 8, 10, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Severity Need', 56, 16)

    // Allocation bar (in front)
    ctx.fillStyle = 'rgba(80,170,210,0.6)'
    ctx.fillRect(150, 8, 10, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Your Allocation', 164, 16)

    data.forEach((d, i) => {
      const x = 50 + i * cellW
      const barW = cellW * 0.35

      // Severity/need mountain (back layer)
      const needH = Math.max(4, d.needPct * maxBarH)
      const sevColor = d.severity > 0.7 ? [200, 60, 60] : d.severity > 0.4 ? [200, 160, 60] : [60, 160, 100]

      // Back mountain — wider, like terrain
      const mtnW = barW * 1.6
      const mtnX = x - (mtnW - barW) / 2

      // Mountain terrain shape (polygon)
      ctx.beginPath()
      ctx.moveTo(mtnX - 4, baseY)
      ctx.lineTo(mtnX + mtnW * 0.3, baseY - needH * 0.7)
      ctx.lineTo(mtnX + mtnW * 0.5, baseY - needH)
      ctx.lineTo(mtnX + mtnW * 0.7, baseY - needH * 0.8)
      ctx.lineTo(mtnX + mtnW + 4, baseY)
      ctx.closePath()
      const mtnGrad = ctx.createLinearGradient(mtnX, baseY, mtnX, baseY - needH)
      mtnGrad.addColorStop(0, `rgba(${sevColor[0]},${sevColor[1]},${sevColor[2]},0.15)`)
      mtnGrad.addColorStop(0.5, `rgba(${sevColor[0]},${sevColor[1]},${sevColor[2]},0.4)`)
      mtnGrad.addColorStop(1, `rgba(${sevColor[0]},${sevColor[1]},${sevColor[2]},0.6)`)
      ctx.fillStyle = mtnGrad
      ctx.fill()

      // Contour lines on the mountain
      for (let c = 0.2; c < 1; c += 0.25) {
        const cy2 = baseY - needH * c
        const spread = mtnW * (1 - c * 0.3) / 2
        ctx.beginPath()
        ctx.moveTo(mtnX + mtnW / 2 - spread, cy2)
        ctx.lineTo(mtnX + mtnW / 2 + spread, cy2)
        ctx.strokeStyle = `rgba(${sevColor[0]},${sevColor[1]},${sevColor[2]},0.15)`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Allocation bar — 3D extruded block (front layer)
      const allocX = x + barW * 0.2
      const aH = Math.max(3, (d.total / maxVal) * maxBarH)
      const intensity = Math.min(0.4 + (d.total / maxVal) * 0.55, 0.95)

      // Front face
      const barGrad = ctx.createLinearGradient(allocX, baseY - aH, allocX, baseY)
      barGrad.addColorStop(0, `rgba(80,170,210,${intensity})`)
      barGrad.addColorStop(1, `rgba(50,130,170,${intensity * 0.7})`)
      ctx.fillStyle = barGrad
      ctx.fillRect(allocX, baseY - aH, barW, aH)

      // Top face (3D)
      ctx.fillStyle = `rgba(100,190,230,${intensity * 0.7})`
      ctx.beginPath()
      ctx.moveTo(allocX, baseY - aH)
      ctx.lineTo(allocX + depth * perspSkew, baseY - aH - depth * 0.6)
      ctx.lineTo(allocX + barW + depth * perspSkew, baseY - aH - depth * 0.6)
      ctx.lineTo(allocX + barW, baseY - aH)
      ctx.closePath()
      ctx.fill()

      // Right face (3D)
      ctx.fillStyle = `rgba(50,130,170,${intensity * 0.4})`
      ctx.beginPath()
      ctx.moveTo(allocX + barW, baseY)
      ctx.lineTo(allocX + barW + depth * perspSkew, baseY - depth * 0.6)
      ctx.lineTo(allocX + barW + depth * perspSkew, baseY - aH - depth * 0.6)
      ctx.lineTo(allocX + barW, baseY - aH)
      ctx.closePath()
      ctx.fill()

      // Value on top
      ctx.fillStyle = `rgba(255,255,255,${intensity > 0.5 ? 0.8 : 0.5})`
      ctx.font = 'bold 9px DM Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(formatBudget(d.total), allocX + barW / 2 + 3, baseY - Math.max(aH, needH) - 14)

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '10px Rajdhani'
      ctx.textAlign = 'center'
      const label = d.region.length > 12 ? d.region.slice(0, 12) + '..' : d.region
      ctx.fillText(label, x + barW * 0.5, baseY + 16)

      // Severity indicator dot
      const dotColor = d.severity > 0.7 ? '#cc4444' : d.severity > 0.4 ? '#ccaa44' : '#44aa77'
      ctx.fillStyle = dotColor
      ctx.beginPath()
      ctx.arc(x + barW * 0.5, baseY + 26, 2.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '8px DM Mono, monospace'
      ctx.fillText(`Sev ${(d.severity * 10).toFixed(1)}`, x + barW * 0.5, baseY + 36)
    })
  }, [data, totalBudget])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}

export default function Step2Allocation() {
  const {
    selectedHurricane,
    coverage,
    projects,
    gameTotalBudget,
    gameAllocations,
    gameClusterAllocations,
    gameResponseWindow,
    setGameClusterAllocations,
    updateGameClusterAllocation,
    setGameResponseWindow,
  } = useStore()

  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [backendRegions, setBackendRegions] = useState<Array<{ admin1: string; severity_index: number; people_in_need: number }>>([])

  // Fetch valid regions from backend API — this is the source of truth
  useEffect(() => {
    if (!selectedHurricane) {
      setBackendRegions([])
      return
    }
    let cancelled = false
    axios.get(`${API_BASE}/simulation/regions/${selectedHurricane.id}`)
      .then(res => {
        if (!cancelled && res.data?.regions) {
          setBackendRegions(res.data.regions)
        }
      })
      .catch(err => {
        console.warn('[Step2] Failed to fetch regions from backend, falling back to coverage data:', err)
        if (!cancelled) setBackendRegions([])
      })
    return () => { cancelled = true }
  }, [selectedHurricane])

  // Derive regions — prefer backend API, then coverage data. NEVER use affected_countries.
  const regions = useMemo(() => {
    if (!selectedHurricane) return []
    if (backendRegions.length > 0) {
      return backendRegions.map(r => r.admin1)
    }
    const fromCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => c.admin1)
      .filter((v, i, a) => a.indexOf(v) === i)
    return fromCoverage
  }, [selectedHurricane, backendRegions, coverage])

  // Coverage lookup — merge backend region data with coverage data
  const coverageLookup = useMemo(() => {
    if (!selectedHurricane) return {} as Record<string, { severity: number; need: number; coverageRatio: number }>
    const result: Record<string, { severity: number; need: number; coverageRatio: number }> = {}
    backendRegions.forEach(r => {
      result[r.admin1] = {
        severity: Math.min(r.severity_index / 10, 1),
        need: r.people_in_need,
        coverageRatio: 0,
      }
    })
    coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .forEach(c => {
        result[c.admin1] = {
          severity: Math.min(c.severity_index / 10, 1),
          need: c.people_in_need,
          coverageRatio: c.coverage_ratio,
        }
      })
    return result
  }, [selectedHurricane, backendRegions, coverage])

  // Historical cluster budgets per region (from projects data)
  const historicalClusterBudgets = useMemo(() => {
    if (!selectedHurricane) return {} as Record<string, Record<string, number>>
    const result: Record<string, Record<string, number>> = {}
    projects
      .filter(p => p.hurricane_id === selectedHurricane.id && p.pooled_fund)
      .forEach(p => {
        if (!result[p.admin1]) result[p.admin1] = {}
        result[p.admin1][p.cluster] = (result[p.admin1][p.cluster] || 0) + p.budget_usd
      })
    return result
  }, [selectedHurricane, projects])

  // Initialize cluster allocations when regions change and allocations are empty
  useEffect(() => {
    if (regions.length > 0 && Object.keys(gameClusterAllocations).length === 0) {
      const initial: Record<string, Record<string, number>> = {}
      const totalSeverity = regions.reduce((s, r) => s + (coverageLookup[r]?.severity || 0.5), 0) || 1
      regions.forEach(region => {
        const severity = coverageLookup[region]?.severity || 0.5
        const regionBudget = Math.round((severity / totalSeverity) * gameTotalBudget)
        initial[region] = {}
        const perCluster = Math.floor(regionBudget / CLUSTERS.length)
        CLUSTERS.forEach(cluster => {
          initial[region][cluster] = perCluster
        })
      })
      setGameClusterAllocations(initial)
    }
  }, [regions, gameClusterAllocations, gameTotalBudget, coverageLookup, setGameClusterAllocations])

  // Auto-highlight first region
  useEffect(() => {
    if (regions.length > 0 && !activeRegion) {
      setActiveRegion(regions[0])
    }
  }, [regions, activeRegion])

  const totalAllocated = useMemo(() => {
    return Object.values(gameAllocations).reduce((s, v) => s + (v || 0), 0)
  }, [gameAllocations])

  const remaining = gameTotalBudget - totalAllocated

  // Cluster totals across all regions (for donut chart)
  const clusterTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    CLUSTERS.forEach(c => { totals[c] = 0 })
    Object.values(gameClusterAllocations).forEach(clusters => {
      Object.entries(clusters).forEach(([cluster, amount]) => {
        totals[cluster] = (totals[cluster] || 0) + (amount || 0)
      })
    })
    return totals
  }, [gameClusterAllocations])

  const handleClusterChange = useCallback((region: string, cluster: string, value: number) => {
    const currentVal = gameClusterAllocations[region]?.[cluster] || 0
    const otherTotal = totalAllocated - currentVal
    const maxAllowed = gameTotalBudget - otherTotal
    const clamped = Math.max(0, Math.min(value, maxAllowed))
    updateGameClusterAllocation(region, cluster, clamped)
  }, [gameClusterAllocations, totalAllocated, gameTotalBudget, updateGameClusterAllocation])

  // Terrain chart data
  const terrainData = useMemo(() => {
    const maxNeed = Math.max(...regions.map(r => coverageLookup[r]?.need || 0), 1)
    return regions.map(region => ({
      region,
      total: gameAllocations[region] || 0,
      severity: coverageLookup[region]?.severity || 0.5,
      needPct: (coverageLookup[region]?.need || 0) / maxNeed,
      need: coverageLookup[region]?.need || 0,
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
        <p className="text-white/30 font-mono text-[10px]">
          {regions.length} regions &times; 6 categories = {regions.length * 6} allocation points
        </p>
      </div>

      {/* Budget summary bar */}
      <div className="flex justify-center gap-6 py-2">
        <div className="text-center">
          <div className="text-white/90 font-mono text-sm font-bold">{formatBudget(gameTotalBudget)}</div>
          <div className="text-white/40 font-rajdhani text-[10px] tracking-widest uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-[#64b4dc] font-mono text-sm font-bold">{formatBudget(totalAllocated)}</div>
          <div className="text-white/40 font-rajdhani text-[10px] tracking-widest uppercase">Allocated</div>
        </div>
        <div className="text-center">
          <div className={`font-mono text-sm font-bold ${remaining < 0 ? 'text-[#cc5566]' : 'text-white/70'}`}>
            {formatBudget(Math.abs(remaining))}
          </div>
          <div className="text-white/40 font-rajdhani text-[10px] tracking-widest uppercase">
            {remaining >= 0 ? 'Remaining' : 'Over'}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={gameResponseWindow}
              onChange={(e) => setGameResponseWindow(Number(e.target.value) || 72)}
              className="w-12 bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-0.5 text-white/80 font-mono text-sm text-center focus:border-white/25 focus:outline-none"
            />
            <span className="text-white/35 font-mono text-[9px]">hrs</span>
          </div>
          <div className="text-white/40 font-rajdhani text-[10px] tracking-widest uppercase">Window</div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mx-auto w-64 h-[6px] bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(utilizationPct, 100)}%`,
            background: remaining < 0
              ? 'linear-gradient(90deg, #cc5566, #aa3344)'
              : 'linear-gradient(90deg, rgba(80,160,210,0.6), rgba(100,180,220,0.8))',
          }}
        />
      </div>

      {/* Charts row: Donut + Terrain stacked or side by side */}
      <div className="flex gap-3 items-start">
        {/* Left: 3D Donut */}
        <div className="shrink-0 w-[280px]">
          <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-1 text-center">
            Budget by Category
          </div>
          <ClusterDonut3D
            clusterTotals={clusterTotals}
            totalBudget={gameTotalBudget}
            totalAllocated={totalAllocated}
          />
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 px-2">
            {CLUSTERS.map(c => (
              <div key={c} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CLUSTER_COLORS[c] }} />
                <span className="text-white/50 font-rajdhani text-[9px]">{CLUSTER_SHORT[c]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Terrain chart — fills remaining space */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase mb-1 text-center">
            Severity Terrain vs Your Allocation
          </div>
          <SeverityTerrainChart data={terrainData} totalBudget={gameTotalBudget} />
        </div>
      </div>

      {/* Region-by-region cluster allocation — ALL visible */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        <div className="text-white/25 font-rajdhani text-[9px] tracking-widest uppercase text-center pb-1">
          Per-Region Category Allocation
        </div>
        {regions.map(region => {
          const cov = coverageLookup[region]
          const regionTotal = gameAllocations[region] || 0
          const isActive = activeRegion === region
          const historicalClusters = historicalClusterBudgets[region] || {}
          // Max per slider = region fair share (so slider range is visually useful)
          const sliderMax = Math.max(Math.ceil(gameTotalBudget / Math.max(regions.length, 1)), 1)

          return (
            <div
              key={region}
              className={`rounded border transition-all duration-200 ${
                isActive
                  ? 'bg-white/[0.04] border-white/[0.12]'
                  : 'bg-white/[0.015] border-white/[0.05] hover:border-white/[0.08]'
              }`}
            >
              {/* Region header */}
              <button
                onClick={() => setActiveRegion(isActive ? null : region)}
                className="w-full text-left px-3 py-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: cov
                        ? cov.severity > 0.7 ? '#cc4444' : cov.severity > 0.4 ? '#ccaa44' : '#44aa77'
                        : 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <span className="text-white/80 font-rajdhani text-sm font-semibold tracking-wide">{region}</span>
                  {cov && (
                    <span className="text-white/30 font-mono text-[9px]">
                      Sev {(cov.severity * 10).toFixed(1)} &bull; {cov.need.toLocaleString()} in need
                    </span>
                  )}
                </div>
                <span className="text-white/50 font-mono text-[10px] font-medium">{formatBudget(regionTotal)}</span>
              </button>

              {/* 6 cluster sliders — always visible, single column */}
              <div className="px-3 pb-3 space-y-2">
                {CLUSTERS.map(cluster => {
                  const value = gameClusterAllocations[region]?.[cluster] || 0
                  const fillPct = sliderMax > 0 ? (value / sliderMax) * 100 : 0
                  const historicalVal = historicalClusters[cluster] || 0
                  const color = CLUSTER_COLORS[cluster]

                  return (
                    <div key={cluster}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-white/55 font-rajdhani text-[10px] tracking-wide font-medium w-16 shrink-0">
                          {CLUSTER_SHORT[cluster]}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={sliderMax}
                          step={Math.max(1000, Math.floor(sliderMax / 100))}
                          value={value}
                          onChange={(e) => handleClusterChange(region, cluster, Number(e.target.value))}
                          className="flex-1 h-[6px] appearance-none rounded-full cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, ${color} 0%, ${color} ${Math.min(fillPct, 100)}%, rgba(255,255,255,0.08) ${Math.min(fillPct, 100)}%, rgba(255,255,255,0.08) 100%)`,
                          }}
                        />
                        <span className="text-white/60 font-mono text-[9px] w-12 text-right shrink-0">{formatBudget(value)}</span>
                      </div>
                      {historicalVal > 0 && (
                        <div className="text-white/20 font-mono text-[8px] ml-[88px]">
                          hist: {formatBudget(historicalVal)}
                        </div>
                      )}
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
