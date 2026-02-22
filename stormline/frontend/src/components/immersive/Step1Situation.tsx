/**
 * Step 1 — Situation / System Framing
 *
 * Minimal text. One primary 3D/depth-based visualization.
 * Purpose: establish spatial severity & context.
 *
 * Uses ONLY hurricane + coverage data — no comparisonData required.
 */

import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '../../state/useStore'
import TypewriterText, { CountUpText } from '../TypewriterText'
// Sound removed — only hover/click sounds kept

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Canvas-based extruded severity surface */
function SeveritySurface({ regionData }: { regionData: Array<{ region: string; severity: number; peopleInNeed: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (regionData.length === 0) return

    const cols = regionData.length
    const cellW = w / cols
    const perspective = 0.6
    const maxBarH = h * 0.65
    const baseY = h * 0.85
    const depthOffset = 20

    const sorted = [...regionData].sort((a, b) => a.severity - b.severity)

    sorted.forEach((region) => {
      const x = (regionData.indexOf(region) * cellW) + cellW * 0.15
      const barW = cellW * 0.7
      const barH = Math.max(4, region.severity * maxBarH)

      // Back face (depth)
      ctx.fillStyle = severityToColor(region.severity, 0.3)
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x + depthOffset * perspective, baseY - depthOffset)
      ctx.lineTo(x + depthOffset * perspective, baseY - depthOffset - barH)
      ctx.lineTo(x, baseY - barH)
      ctx.closePath()
      ctx.fill()

      // Right face (depth)
      ctx.fillStyle = severityToColor(region.severity, 0.2)
      ctx.beginPath()
      ctx.moveTo(x + barW, baseY)
      ctx.lineTo(x + barW + depthOffset * perspective, baseY - depthOffset)
      ctx.lineTo(x + barW + depthOffset * perspective, baseY - depthOffset - barH)
      ctx.lineTo(x + barW, baseY - barH)
      ctx.closePath()
      ctx.fill()

      // Top face
      ctx.fillStyle = severityToColor(region.severity, 0.5)
      ctx.beginPath()
      ctx.moveTo(x, baseY - barH)
      ctx.lineTo(x + depthOffset * perspective, baseY - depthOffset - barH)
      ctx.lineTo(x + barW + depthOffset * perspective, baseY - depthOffset - barH)
      ctx.lineTo(x + barW, baseY - barH)
      ctx.closePath()
      ctx.fill()

      // Front face
      ctx.fillStyle = severityToColor(region.severity, 0.7)
      ctx.fillRect(x, baseY - barH, barW, barH)

      // Contour lines on front face
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 0.5
      const contourCount = Math.floor(barH / 12)
      for (let c = 0; c < contourCount; c++) {
        const cy = baseY - (c * 12) - 6
        ctx.beginPath()
        ctx.moveTo(x, cy)
        ctx.lineTo(x + barW, cy)
        ctx.stroke()
      }

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '9px Rajdhani'
      ctx.textAlign = 'center'
      ctx.fillText(
        region.region.length > 10 ? region.region.slice(0, 10) + '..' : region.region,
        x + barW / 2,
        baseY + 14
      )

      // Severity value
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '10px DM Mono, monospace'
      ctx.fillText(
        (region.severity * 10).toFixed(1),
        x + barW / 2,
        baseY - barH - 8
      )
    })

    // Grid lines on base
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let g = 0; g < cols + 1; g++) {
      const gx = g * cellW
      ctx.beginPath()
      ctx.moveTo(gx, baseY)
      ctx.lineTo(gx + depthOffset * perspective, baseY - depthOffset)
      ctx.stroke()
    }
  }, [regionData])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={280}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}

function severityToColor(severity: number, alpha: number): string {
  if (severity > 0.7) return `rgba(200, 60, 60, ${alpha})`
  if (severity > 0.4) return `rgba(200, 160, 60, ${alpha})`
  return `rgba(60, 160, 100, ${alpha})`
}

export default function Step1Situation() {
  const { selectedHurricane, coverage, gameTotalBudget } = useStore()

  // Build region data from coverage — no comparisonData needed
  const regionData = useMemo(() => {
    if (!selectedHurricane) return []

    // Get regions from coverage data
    const fromCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => ({
        region: c.admin1,
        severity: Math.min(c.severity_index / 10, 1),
        peopleInNeed: c.people_in_need,
      }))

    if (fromCoverage.length > 0) return fromCoverage

    // Fallback: use affected_countries with default severity
    return (selectedHurricane.affected_countries || []).map(country => ({
      region: country,
      severity: 0.5,
      peopleInNeed: Math.round(selectedHurricane.estimated_population_affected / (selectedHurricane.affected_countries.length || 1)),
    }))
  }, [selectedHurricane, coverage])

  if (!selectedHurricane) return null

  const totalPeopleInNeed = regionData.reduce((s, r) => s + r.peopleInNeed, 0)

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <TypewriterText
          text="Situation Assessment"
          emphasis="soft"
          delayMs={100}
          className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase"
          as="div"
        />
        <h2 className="text-white/90 font-rajdhani font-bold text-2xl tracking-wider">
          <TypewriterText text={selectedHurricane.name} emphasis="headline" delayMs={400} charIntervalMs={55} />
        </h2>
        <div className="text-white/30 font-mono text-xs">
          <TypewriterText
            text={`${selectedHurricane.year} \u2014 Category ${selectedHurricane.max_category} \u2014 ${selectedHurricane.estimated_population_affected.toLocaleString()} affected`}
            emphasis="normal"
            delayMs={800}
            charIntervalMs={18}
            onComplete={() => {}}
          />
        </div>
      </div>

      {/* Key stats row — very minimal */}
      <div className="flex justify-center gap-8">
        <div className="text-center">
          <div className="text-white/60 font-mono text-sm">
            <CountUpText value={regionData.length} delayMs={1000} duration={600} />
          </div>
          <TypewriterText text="Regions" emphasis="soft" delayMs={1000} className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase" as="div" />
        </div>
        <div className="text-center">
          <div className="text-white/60 font-mono text-sm">
            {formatBudget(gameTotalBudget)}
          </div>
          <TypewriterText text="Budget" emphasis="soft" delayMs={1100} className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase" as="div" />
        </div>
        <div className="text-center">
          <div className="text-white/60 font-mono text-sm">
            <CountUpText value={totalPeopleInNeed} delayMs={1200} duration={1500} />
          </div>
          <TypewriterText text="People in Need" emphasis="soft" delayMs={1200} className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase" as="div" />
        </div>
      </div>

      {/* Primary 3D visualization — extruded severity surface */}
      <div>
        <div className="text-white/15 font-rajdhani text-[9px] tracking-widest uppercase mb-2 text-center">
          Regional Severity Terrain
        </div>
        <SeveritySurface regionData={regionData} />
      </div>

      {/* Affected countries */}
      <div className="text-center">
        <div className="text-white/20 font-mono text-[10px]">
          {selectedHurricane.affected_countries.join(' / ')}
        </div>
      </div>
    </div>
  )
}
