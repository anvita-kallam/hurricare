/**
 * Step 2 — Budget Allocation (Interactive)
 *
 * Full cluster-level allocation per region (6 humanitarian clusters × N regions):
 *   - Emergency Shelter and NFI, Food Security, Health, WASH, Logistics, Early Recovery
 *   - 2.5D isometric severity height map
 *   - Donut pie chart with 3D depth showing budget distribution by category
 *   - Single-region slider view with left/right navigation arrows
 *   - Response window setting
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import axios from 'axios'
import { useStore } from '../../state/useStore'
import TypewriterText from '../TypewriterText'

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

      for (let a = startAngle; a < startAngle + sweep; a += 0.02) {
        const endA = Math.min(a + 0.04, startAngle + sweep)
        const x1 = cx + Math.cos(a) * outerR
        const y1 = cy + Math.sin(a) * outerR
        const x2 = cx + Math.cos(endA) * outerR
        const y2 = cy + Math.sin(endA) * outerR

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
          ctx.fillStyle = `rgba(${Math.floor(r * 0.5)},${Math.floor(g * 0.5)},${Math.floor(b * 0.5)},1)`
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

      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
      grad.addColorStop(1, `rgba(${Math.floor(r * 0.7)},${Math.floor(g * 0.7)},${Math.floor(b * 0.7)},1)`)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.lineWidth = 1
      ctx.stroke()

      if (pct > 0.06) {
        const mid = startAngle + sweep / 2
        const lr = outerR + 16
        const lx = cx + Math.cos(mid) * lr
        const ly = cy + Math.sin(mid) * lr

        ctx.fillStyle = 'rgba(255,255,255,1)'
        ctx.font = 'bold 10px Rajdhani'
        ctx.textAlign = mid > Math.PI / 2 && mid < Math.PI * 1.5 ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(e.short, lx, ly)

        ctx.fillStyle = 'rgba(255,255,255,0.75)'
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
        ctx.fillStyle = 'rgba(255,255,255,0.33)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.34)'
        ctx.stroke()
      }
    }

    // Inner shadow for depth
    const innerGrad = ctx.createRadialGradient(cx, cy, innerR - 3, cx, cy, innerR + 3)
    innerGrad.addColorStop(0, 'rgba(0,0,0,0)')
    innerGrad.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.beginPath()
    ctx.arc(cx, cy, innerR + 3, 0, Math.PI * 2)
    ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.fillStyle = innerGrad
    ctx.fill()

    // Center text
    const utilPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0
    ctx.fillStyle = 'rgba(255,255,255,1)'
    ctx.font = 'bold 22px DM Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${utilPct}%`, cx, cy - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
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

/** 2.5D Isometric Severity Height Map — terrain tiles with height = severity */
function SeverityHeightMap({ data, totalBudget, activeIndex }: {
  data: Array<{ region: string; total: number; severity: number; needPct: number; need: number }>
  totalBudget: number
  activeIndex: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cw = 600
    const ch = 260
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`

    ctx.clearRect(0, 0, cw, ch)
    if (data.length === 0) return

    const cols = data.length
    // Isometric tile dimensions
    const tileW = Math.min(80, (cw - 60) / cols)
    const tileD = tileW * 0.5 // depth in perspective
    const maxHeight = ch * 0.45
    const startX = (cw - cols * tileW) / 2
    const baseY = ch * 0.82

    // Draw from back to front (painter's algorithm)
    // Sort by severity descending so taller ones don't occlude shorter in front
    const sorted = data.map((d, i) => ({ ...d, origIdx: i }))

    // Draw ground grid
    ctx.strokeStyle = 'rgba(255,255,255,0.34)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= cols; i++) {
      const gx = startX + i * tileW
      // Vertical grid line
      ctx.beginPath()
      ctx.moveTo(gx, baseY)
      ctx.lineTo(gx + tileD * 0.5, baseY - tileD)
      ctx.stroke()
      // Horizontal grid line
      ctx.beginPath()
      ctx.moveTo(startX + i * tileW, baseY)
      ctx.lineTo(startX + cols * tileW, baseY - (cols - i) * 0)
      ctx.stroke()
    }

    // Draw tiles
    sorted.forEach((d) => {
      const i = d.origIdx
      const x = startX + i * tileW
      const sevHeight = Math.max(8, d.severity * maxHeight)
      const allocHeight = totalBudget > 0 ? Math.max(2, (d.total / (totalBudget * 0.3)) * maxHeight * 0.4) : 2
      const isActive = i === activeIndex

      // Severity color
      const sevR = d.severity > 0.7 ? 200 : d.severity > 0.4 ? 200 : 60
      const sevG = d.severity > 0.7 ? 60 : d.severity > 0.4 ? 160 : 160
      const sevB = d.severity > 0.7 ? 60 : d.severity > 0.4 ? 60 : 100
      const activeBoost = isActive ? 1.3 : 1.0
      const baseSevAlpha = isActive ? 1 : 0.85

      // --- Severity terrain tile (isometric) ---
      const tileLeft = x + 2
      const tileRight = tileLeft + tileW - 4
      const tileMid = (tileLeft + tileRight) / 2
      const perspOff = tileD * 0.4

      // Right face
      ctx.beginPath()
      ctx.moveTo(tileRight, baseY)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight, baseY - sevHeight)
      ctx.closePath()
      ctx.fillStyle = `rgba(${Math.floor(sevR * 0.5)},${Math.floor(sevG * 0.5)},${Math.floor(sevB * 0.5)},${baseSevAlpha * 0.7})`
      ctx.fill()

      // Front face — gradient
      const frontGrad = ctx.createLinearGradient(tileLeft, baseY, tileLeft, baseY - sevHeight)
      frontGrad.addColorStop(0, `rgba(${sevR},${sevG},${sevB},${baseSevAlpha * 0.3})`)
      frontGrad.addColorStop(0.5, `rgba(${sevR},${sevG},${sevB},${baseSevAlpha * 0.7})`)
      frontGrad.addColorStop(1, `rgba(${sevR},${sevG},${sevB},${baseSevAlpha})`)
      ctx.fillStyle = frontGrad
      ctx.fillRect(tileLeft, baseY - sevHeight, tileRight - tileLeft, sevHeight)

      // Top face (isometric)
      ctx.beginPath()
      ctx.moveTo(tileLeft, baseY - sevHeight)
      ctx.lineTo(tileLeft + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight, baseY - sevHeight)
      ctx.closePath()
      ctx.fillStyle = `rgba(${Math.min(255, Math.floor(sevR * activeBoost))},${Math.min(255, Math.floor(sevG * activeBoost))},${Math.min(255, Math.floor(sevB * activeBoost))},${baseSevAlpha * 0.9})`
      ctx.fill()

      // Contour lines on front face
      ctx.strokeStyle = `rgba(255,255,255,${isActive ? 0.42 : 0.36})`
      ctx.lineWidth = 0.5
      const contours = Math.floor(sevHeight / 16)
      for (let c = 1; c <= contours; c++) {
        const cy = baseY - (c * 16)
        if (cy < baseY - sevHeight) break
        ctx.beginPath()
        ctx.moveTo(tileLeft, cy)
        ctx.lineTo(tileRight, cy)
        ctx.stroke()
      }

      // --- Allocation overlay bar on front face ---
      if (d.total > 0) {
        const aBarH = Math.min(allocHeight, sevHeight * 0.8)
        const aBarW = (tileRight - tileLeft) * 0.35
        const aBarX = tileMid - aBarW / 2
        const intensity = Math.min(0.4 + (d.total / (totalBudget * 0.3)) * 0.5, 0.95)

        // Allocation bar (on the face)
        const aGrad = ctx.createLinearGradient(aBarX, baseY, aBarX, baseY - aBarH)
        aGrad.addColorStop(0, `rgba(80,170,210,${intensity * 0.8})`)
        aGrad.addColorStop(1, `rgba(100,190,230,${intensity})`)
        ctx.fillStyle = aGrad
        ctx.fillRect(aBarX, baseY - aBarH, aBarW, aBarH)

        // Allocation glow
        if (isActive) {
          ctx.shadowColor = 'rgba(100,180,230,0.6)'
          ctx.shadowBlur = 8
          ctx.fillRect(aBarX, baseY - aBarH, aBarW, aBarH)
          ctx.shadowBlur = 0
        }
      }

      // Active highlight border
      if (isActive) {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(tileLeft - 1, baseY - sevHeight - 1, tileRight - tileLeft + 2, sevHeight + 2)
      }

      // Region label below — smart truncation based on tile width
      ctx.fillStyle = isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.8)'
      ctx.font = `${isActive ? 'bold ' : ''}10px Rajdhani`
      ctx.textAlign = 'center'
      let label = d.region
      const maxLabelW = tileW - 4
      if (ctx.measureText(label).width > maxLabelW) {
        while (label.length > 4 && ctx.measureText(label + '..').width > maxLabelW) {
          label = label.slice(0, -1)
        }
        label += '..'
      }
      ctx.fillText(label, tileMid, baseY + 14)

      // Severity value on top
      ctx.fillStyle = isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.8)'
      ctx.font = `bold 10px DM Mono, monospace`
      ctx.textAlign = 'center'
      ctx.fillText(
        `${(d.severity * 10).toFixed(1)}`,
        tileMid + perspOff * 0.3,
        baseY - sevHeight - perspOff * 0.5 - 6
      )

      // Allocation amount
      if (d.total > 0) {
        ctx.fillStyle = isActive ? 'rgba(100,190,230,1)' : 'rgba(100,190,230,0.9)'
        ctx.font = '9px DM Mono, monospace'
        ctx.fillText(formatBudget(d.total), tileMid, baseY + 26)
      }
    })

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '9px Rajdhani'
    ctx.textAlign = 'left'
    // Severity
    ctx.fillStyle = 'rgba(200,100,60,0.9)'
    ctx.fillRect(8, 8, 12, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('Severity (height)', 24, 16)
    // Allocation
    ctx.fillStyle = 'rgba(80,170,210,1)'
    ctx.fillRect(8, 22, 12, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('Your Allocation', 24, 30)
  }, [data, totalBudget, activeIndex])

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

  const [regionIndex, setRegionIndex] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
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

  // Navigation for single-region slider
  const goToRegion = useCallback((idx: number) => {
    if (idx < 0 || idx >= regions.length) return
    setSlideDir(idx > regionIndex ? 'right' : 'left')
    setRegionIndex(idx)
    // Clear animation class after transition
    setTimeout(() => setSlideDir(null), 350)
  }, [regions.length, regionIndex])

  const goNext = useCallback(() => {
    if (regionIndex < regions.length - 1) goToRegion(regionIndex + 1)
  }, [regionIndex, regions.length, goToRegion])

  const goPrev = useCallback(() => {
    if (regionIndex > 0) goToRegion(regionIndex - 1)
  }, [regionIndex, goToRegion])

  if (!selectedHurricane) return null

  const utilizationPct = gameTotalBudget > 0 ? (totalAllocated / gameTotalBudget) * 100 : 0
  const currentRegion = regions[regionIndex]
  const cov = currentRegion ? coverageLookup[currentRegion] : null
  const regionTotal = currentRegion ? (gameAllocations[currentRegion] || 0) : 0
  const historicalClusters = currentRegion ? (historicalClusterBudgets[currentRegion] || {}) : {}
  const sliderMax = Math.max(Math.ceil(gameTotalBudget / Math.max(regions.length, 1)), 1)

  // Slide animation CSS
  const slideClass = slideDir === 'right'
    ? 'animate-slide-in-right'
    : slideDir === 'left'
      ? 'animate-slide-in-left'
      : ''

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="text-center space-y-1">
        <TypewriterText text="Resource Allocation" emphasis="soft" delayMs={100} className="text-white/75 font-rajdhani text-base tracking-[0.3em] uppercase" as="div" />
        <h2 className="text-white font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text="Distribute Your Budget" emphasis="headline" delayMs={300} charIntervalMs={35} />
        </h2>
        <p className="text-white/65 font-mono text-sm">
          {regions.length} regions &times; 6 categories = {regions.length * 6} allocation points
        </p>
      </div>

      {/* Budget summary bar */}
      <div className="flex justify-center gap-6 py-2">
        <div className="text-center">
          <div className="text-white font-mono text-base font-bold">{formatBudget(gameTotalBudget)}</div>
          <div className="text-white/70 font-rajdhani text-sm tracking-widest uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-[#64b4dc] font-mono text-base font-bold">{formatBudget(totalAllocated)}</div>
          <div className="text-white/70 font-rajdhani text-sm tracking-widest uppercase">Allocated</div>
        </div>
        <div className="text-center">
          <div className={`font-mono text-base font-bold ${remaining < 0 ? 'text-[#cc5566]' : 'text-white/90'}`}>
            {formatBudget(Math.abs(remaining))}
          </div>
          <div className="text-white/70 font-rajdhani text-sm tracking-widest uppercase">
            {remaining >= 0 ? 'Remaining' : 'Over'}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={gameResponseWindow}
              onChange={(e) => setGameResponseWindow(Number(e.target.value) || 72)}
              className="w-12 bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-0.5 text-white/95 font-mono text-base text-center focus:border-white/60 focus:outline-none"
            />
            <span className="text-white/65 font-mono text-sm">hrs</span>
          </div>
          <div className="text-white/70 font-rajdhani text-sm tracking-widest uppercase">Window</div>
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
              : 'linear-gradient(90deg, rgba(80,160,210,0.9), rgba(100,180,220,1))',
          }}
        />
      </div>

      {/* Charts row: Donut + 2.5D Height Map */}
      <div className="flex gap-3 items-start">
        {/* Left: 3D Donut */}
        <div className="shrink-0 w-[280px]">
          <div className="text-white/60 font-rajdhani text-sm tracking-widest uppercase mb-1 text-center">
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
                <span className="text-white/75 font-rajdhani text-sm">{CLUSTER_SHORT[c]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 2.5D Severity Height Map */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-white/60 font-rajdhani text-sm tracking-widest uppercase mb-1 text-center">
            Severity Height Map
          </div>
          <SeverityHeightMap data={terrainData} totalBudget={gameTotalBudget} activeIndex={regionIndex} />
        </div>
      </div>

      {/* Single-region slider with left/right navigation */}
      <div className="relative">
        <div className="text-white/60 font-rajdhani text-sm tracking-widest uppercase text-center pb-2">
          Region {regionIndex + 1} of {regions.length}
        </div>

        <div className="flex items-center gap-3">
          {/* Left arrow */}
          <button
            onClick={goPrev}
            disabled={regionIndex === 0}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded border border-white/[0.08] hover:border-white/[0.2] text-white/70 hover:text-white/90 transition-all disabled:opacity-10 disabled:cursor-not-allowed"
          >
            <span className="text-lg">&#9666;</span>
          </button>

          {/* Region card — FDP-style glass panel */}
          <div
            key={currentRegion}
            className={`flex-1 overflow-hidden ${slideClass}`}
            style={{
              animation: slideDir ? undefined : 'none',
              background: 'linear-gradient(180deg, rgba(0,0,2,1) 0%, rgba(0,0,4,1) 50%, rgba(0,0,3,1) 100%)',
              border: '1px solid rgba(255,255,255,0.36)',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.312) 0.5px, transparent 0.5px)',
              backgroundSize: '10px 10px',
              boxShadow: '0 4px 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.34)',
            }}
          >
            {/* Region header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.34)', background: 'rgba(255,255,255,0.315)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: cov
                      ? cov.severity > 0.7 ? '#cc4444' : cov.severity > 0.4 ? '#ccaa44' : '#44aa77'
                      : 'rgba(255,255,255,0.45)',
                  }}
                />
                <div>
                  <span className="text-white font-rajdhani text-base font-bold tracking-wide">{currentRegion}</span>
                  {cov && (
                    <div className="text-white/65 font-mono text-sm mt-0.5">
                      Severity {(cov.severity * 10).toFixed(1)} &bull; {cov.need.toLocaleString()} people in need
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[#64b4dc] font-mono text-base font-bold">{formatBudget(regionTotal)}</div>
                <div className="text-white/65 font-rajdhani text-xs tracking-widest uppercase">allocated</div>
              </div>
            </div>

            {/* 6 cluster sliders */}
            <div className="px-4 py-3 space-y-2.5">
              {CLUSTERS.map(cluster => {
                const value = gameClusterAllocations[currentRegion]?.[cluster] || 0
                const fillPct = sliderMax > 0 ? (value / sliderMax) * 100 : 0
                const historicalVal = historicalClusters[cluster] || 0
                const color = CLUSTER_COLORS[cluster]

                return (
                  <div key={cluster}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-white/80 font-rajdhani text-sm tracking-wide font-medium w-16 shrink-0">
                        {CLUSTER_SHORT[cluster]}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={Math.max(1000, Math.floor(sliderMax / 100))}
                        value={value}
                        onChange={(e) => handleClusterChange(currentRegion, cluster, Number(e.target.value))}
                        className="flex-1 h-[6px] appearance-none rounded-full cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${color} 0%, ${color} ${Math.min(fillPct, 100)}%, rgba(255,255,255,0.38) ${Math.min(fillPct, 100)}%, rgba(255,255,255,0.38) 100%)`,
                        }}
                      />
                      <span className="text-white/85 font-mono text-sm w-12 text-right shrink-0">{formatBudget(value)}</span>
                    </div>
                    {historicalVal > 0 && (
                      <div className="text-white/60 font-mono text-xs ml-[88px]">
                        hist: {formatBudget(historicalVal)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={goNext}
            disabled={regionIndex >= regions.length - 1}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded border border-white/[0.08] hover:border-white/[0.2] text-white/70 hover:text-white/90 transition-all disabled:opacity-10 disabled:cursor-not-allowed"
          >
            <span className="text-lg">&#9656;</span>
          </button>
        </div>

        {/* Region dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {regions.map((r, i) => (
            <button
              key={r}
              onClick={() => goToRegion(i)}
              className={`rounded-full transition-all duration-300 ${
                i === regionIndex
                  ? 'w-5 h-1.5 bg-white/40'
                  : 'w-1.5 h-1.5 bg-white/10 hover:bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Inline keyframe styles for slide animations + FDP slider styling */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0.3; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-40px); opacity: 0.3; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.3s ease-out;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, rgba(255,255,255,1), rgba(180,200,220,1));
          box-shadow: 0 0 6px rgba(100,180,230,0.7), 0 1px 3px rgba(0,0,0,0.8);
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.4);
          transition: box-shadow 0.15s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 12px rgba(100,180,230,0.9), 0 2px 6px rgba(0,0,0,0.8);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, rgba(255,255,255,1), rgba(180,200,220,1));
          box-shadow: 0 0 6px rgba(100,180,230,0.7), 0 1px 3px rgba(0,0,0,0.8);
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  )
}
