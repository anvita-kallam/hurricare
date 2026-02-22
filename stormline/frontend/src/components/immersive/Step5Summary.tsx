/**
 * Step 5 — Summary Insight (Minimal)
 *
 * ONE distilled 3D delta visualization.
 * Extremely concise. End of flow.
 */

import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Delta surface — shows the gap between ML ideal and historical as a rising/falling terrain */
function DeltaSurface({ data }: {
  data: Array<{ region: string; delta: number; severity: number; coverageGap: number }>
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

    const maxDelta = Math.max(...data.map(d => Math.abs(d.delta)), 1)
    const cols = data.length
    const cellW = (w - 40) / cols
    const centerY = h * 0.5
    const maxBarH = h * 0.35

    // Zero-line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, centerY)
    ctx.lineTo(w - 20, centerY)
    ctx.stroke()
    ctx.setLineDash([])

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '8px DM Mono, monospace'
    ctx.textAlign = 'right'
    ctx.fillText('Underfunded', 18, centerY - maxBarH * 0.7)
    ctx.fillText('Overfunded', 18, centerY + maxBarH * 0.7)

    data.forEach((d, i) => {
      const x = 20 + i * cellW + cellW * 0.15
      const barW = cellW * 0.7
      const barH = (d.delta / maxDelta) * maxBarH
      const isPositive = d.delta >= 0
      const depth = 6

      const colorBase = isPositive
        ? `rgba(200, 80, 80,`
        : `rgba(80, 170, 110,`

      if (isPositive) {
        // Front face
        ctx.fillStyle = `${colorBase} 0.6)`
        ctx.fillRect(x, centerY - barH, barW, barH)

        // Top face
        ctx.fillStyle = `${colorBase} 0.4)`
        ctx.beginPath()
        ctx.moveTo(x, centerY - barH)
        ctx.lineTo(x + depth, centerY - barH - depth)
        ctx.lineTo(x + barW + depth, centerY - barH - depth)
        ctx.lineTo(x + barW, centerY - barH)
        ctx.closePath()
        ctx.fill()

        // Right face
        ctx.fillStyle = `${colorBase} 0.2)`
        ctx.beginPath()
        ctx.moveTo(x + barW, centerY)
        ctx.lineTo(x + barW + depth, centerY - depth)
        ctx.lineTo(x + barW + depth, centerY - barH - depth)
        ctx.lineTo(x + barW, centerY - barH)
        ctx.closePath()
        ctx.fill()
      } else {
        const absH = Math.abs(barH)
        ctx.fillStyle = `${colorBase} 0.6)`
        ctx.fillRect(x, centerY, barW, absH)

        ctx.fillStyle = `${colorBase} 0.2)`
        ctx.beginPath()
        ctx.moveTo(x, centerY + absH)
        ctx.lineTo(x + depth, centerY + absH - depth)
        ctx.lineTo(x + barW + depth, centerY + absH - depth)
        ctx.lineTo(x + barW, centerY + absH)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = `${colorBase} 0.15)`
        ctx.beginPath()
        ctx.moveTo(x + barW, centerY)
        ctx.lineTo(x + barW + depth, centerY - depth)
        ctx.lineTo(x + barW + depth, centerY + absH - depth)
        ctx.lineTo(x + barW, centerY + absH)
        ctx.closePath()
        ctx.fill()
      }

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '9px Rajdhani'
      ctx.textAlign = 'center'
      ctx.fillText(
        d.region.length > 10 ? d.region.slice(0, 10) + '..' : d.region,
        x + barW / 2,
        h - 10
      )

      // Delta value
      ctx.fillStyle = isPositive ? 'rgba(200,80,80,0.7)' : 'rgba(80,170,110,0.7)'
      ctx.font = '9px DM Mono, monospace'
      ctx.fillText(
        `${isPositive ? '+' : ''}${formatBudget(d.delta)}`,
        x + barW / 2,
        isPositive ? centerY - barH - 12 : centerY + Math.abs(barH) + 14
      )
    })
  }, [data])

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

export default function Step5Summary() {
  const { comparisonData, coverage, selectedHurricane } = useStore()

  const deltaData = useMemo(() => {
    if (!comparisonData?.realPlan || !comparisonData?.mlPlan) return []
    return comparisonData.realPlan.allocations.map((ra: any) => {
      const ma = comparisonData.mlPlan.allocations.find((a: any) => a.region === ra.region)
      const covData = coverage.find(
        (c) => c.hurricane_id === selectedHurricane?.id && c.admin1 === ra.region
      )
      const mlBudget = ma?.budget || 0
      const realBudget = ra.budget || 0
      const mlCoverage = ma?.coverage_estimate?.coverage_ratio || 0
      const realCoverage = ra.coverage_estimate?.coverage_ratio || 0

      return {
        region: ra.region,
        delta: mlBudget - realBudget,
        severity: covData?.severity_index ? Math.min(covData.severity_index / 10, 1) : 0.5,
        coverageGap: mlCoverage - realCoverage,
      }
    })
  }, [comparisonData, coverage, selectedHurricane])

  const totalMlCovered = comparisonData?.mlPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0
  const totalRealCovered = comparisonData?.realPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0
  const totalUserCovered = comparisonData?.userPlan?.allocations?.reduce(
    (s: number, a: any) => s + (a.coverage_estimate?.people_covered || 0), 0
  ) || 0

  const coverageDelta = totalMlCovered - totalRealCovered
  const userVsMl = totalUserCovered - totalMlCovered

  const mostUnderfunded = [...deltaData].sort((a, b) => b.delta - a.delta)[0]

  // Loading state if data isn't ready
  if (!comparisonData) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
            Loading Summary
          </div>
          <div className="text-white/15 font-mono text-[10px] mt-2">
            Waiting for analysis data...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
          Delta Insights
        </div>
        <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
          What Could Have Changed
        </h2>
      </div>

      {/* Key delta insight — one line */}
      <div className="text-center">
        <div className="text-white/40 font-mono text-xs leading-relaxed">
          {coverageDelta > 0
            ? `${coverageDelta.toLocaleString()} additional people reachable with ideal allocation`
            : `Historical response covered ${Math.abs(coverageDelta).toLocaleString()} more than ML ideal`
          }
        </div>
      </div>

      {/* Primary 3D visualization — delta surface */}
      <div>
        <div className="text-white/15 font-rajdhani text-[9px] tracking-widest uppercase mb-2 text-center">
          Budget Delta: ML Ideal vs Historical
        </div>
        <DeltaSurface data={deltaData} />
      </div>

      {/* Concise insights */}
      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
        {mostUnderfunded && (
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#cc5566] mt-1.5 shrink-0" />
            <div>
              <div className="text-white/40 font-rajdhani text-[10px] tracking-wider uppercase">Largest Gap</div>
              <div className="text-white/50 font-mono text-[10px]">
                {mostUnderfunded.region}: {mostUnderfunded.delta > 0 ? 'underfunded' : 'overfunded'} by {formatBudget(Math.abs(mostUnderfunded.delta))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4488aa] mt-1.5 shrink-0" />
          <div>
            <div className="text-white/40 font-rajdhani text-[10px] tracking-wider uppercase">Your Performance</div>
            <div className="text-white/50 font-mono text-[10px]">
              {userVsMl > 0
                ? `You covered ${userVsMl.toLocaleString()} more people than the ML ideal`
                : userVsMl < 0
                  ? `ML ideal would cover ${Math.abs(userVsMl).toLocaleString()} more people`
                  : 'Matched ML ideal coverage'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
