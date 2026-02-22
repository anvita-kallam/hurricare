/**
 * Step 4 — Results Play Out
 *
 * Shows coverage results animating in.
 * One explanatory panel with short anchored insights.
 * Regions rise/fall, coverage spreads, gaps appear.
 */

import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Coverage surface visualization — shows regions rising/falling by coverage */
function CoverageTerrainCanvas({ regionData }: {
  regionData: Array<{
    region: string
    userCoverage: number
    mlCoverage: number
    realCoverage: number
    unmetNeed: number
    peopleCovered: { user: number; ml: number; real: number }
  }>
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

    if (regionData.length === 0) return

    const cols = regionData.length
    const cellW = (w - 40) / cols
    const maxH = h * 0.5
    const baseY = h * 0.8
    const tiltX = 0.3
    const tiltY = 0.6

    // Draw perspective grid base
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let g = 0; g <= cols; g++) {
      const x = 20 + g * cellW
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x + 15 * tiltX, baseY - 15 * tiltY)
      ctx.stroke()
    }

    // Draw coverage bars for each plan, per region
    regionData.forEach((r, i) => {
      const x = 20 + i * cellW + cellW * 0.1
      const barW = cellW * 0.25

      // User coverage bar
      const userH = r.userCoverage * maxH
      drawExtrudedBar(ctx, x, baseY, barW, userH, 'rgba(68, 136, 170,', 4)

      // ML coverage bar
      const mlH = r.mlCoverage * maxH
      drawExtrudedBar(ctx, x + barW + 2, baseY, barW, mlH, 'rgba(136, 85, 170,', 4)

      // Real coverage bar
      const realH = r.realCoverage * maxH
      drawExtrudedBar(ctx, x + (barW + 2) * 2, baseY, barW, realH, 'rgba(170, 68, 68,', 4)

      // Region label
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '9px Rajdhani'
      ctx.textAlign = 'center'
      ctx.fillText(
        r.region.length > 10 ? r.region.slice(0, 10) + '..' : r.region,
        x + cellW * 0.4,
        baseY + 16
      )
    })
  }, [regionData])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={260}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}

function drawExtrudedBar(
  ctx: CanvasRenderingContext2D,
  x: number, baseY: number, w: number, h: number,
  colorBase: string, depth: number
) {
  if (h < 1) return

  // Right depth face
  ctx.fillStyle = `${colorBase} 0.2)`
  ctx.beginPath()
  ctx.moveTo(x + w, baseY)
  ctx.lineTo(x + w + depth, baseY - depth)
  ctx.lineTo(x + w + depth, baseY - depth - h)
  ctx.lineTo(x + w, baseY - h)
  ctx.closePath()
  ctx.fill()

  // Top depth face
  ctx.fillStyle = `${colorBase} 0.4)`
  ctx.beginPath()
  ctx.moveTo(x, baseY - h)
  ctx.lineTo(x + depth, baseY - depth - h)
  ctx.lineTo(x + w + depth, baseY - depth - h)
  ctx.lineTo(x + w, baseY - h)
  ctx.closePath()
  ctx.fill()

  // Front face
  ctx.fillStyle = `${colorBase} 0.6)`
  ctx.fillRect(x, baseY - h, w, h)
}

export default function Step4Results() {
  const { comparisonData, coverage, selectedHurricane } = useStore()

  const regionData = useMemo(() => {
    if (!comparisonData?.realPlan) return []
    return comparisonData.realPlan.allocations.map((ra: any) => {
      const ua = comparisonData.userPlan?.allocations?.find((a: any) => a.region === ra.region)
      const ma = comparisonData.mlPlan?.allocations?.find((a: any) => a.region === ra.region)
      return {
        region: ra.region,
        userCoverage: ua?.coverage_estimate?.coverage_ratio || 0,
        mlCoverage: ma?.coverage_estimate?.coverage_ratio || 0,
        realCoverage: ra.coverage_estimate?.coverage_ratio || 0,
        unmetNeed: ra.coverage_estimate?.unmet_need || 0,
        peopleCovered: {
          user: ua?.coverage_estimate?.people_covered || 0,
          ml: ma?.coverage_estimate?.people_covered || 0,
          real: ra.coverage_estimate?.people_covered || 0,
        },
      }
    })
  }, [comparisonData])

  const totalUserCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.user, 0)
  const totalMlCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.ml, 0)
  const totalRealCovered = regionData.reduce((s: number, r: any) => s + r.peopleCovered.real, 0)

  const avgUserCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.userCoverage, 0) / regionData.length : 0
  const avgMlCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.mlCoverage, 0) / regionData.length : 0
  const avgRealCoverage = regionData.length > 0
    ? regionData.reduce((s: number, r: any) => s + r.realCoverage, 0) / regionData.length : 0

  if (!comparisonData) return null

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
          Response Outcome
        </div>
        <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
          Coverage Results
        </h2>
      </div>

      {/* Coverage overview — three rings */}
      <div className="flex justify-center gap-8">
        {[
          { label: 'Your Plan', value: avgUserCoverage, covered: totalUserCovered, color: '#4488aa' },
          { label: 'ML Ideal', value: avgMlCoverage, covered: totalMlCovered, color: '#8855aa' },
          { label: 'Historical', value: avgRealCoverage, covered: totalRealCovered, color: '#aa4444' },
        ].map((plan) => {
          const circumference = 2 * Math.PI * 28
          return (
            <div key={plan.label} className="flex flex-col items-center gap-1">
              <div className="relative w-16 h-16">
                <svg width={64} height={64} className="transform -rotate-90">
                  <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={2} />
                  <circle
                    cx={32} cy={32} r={28}
                    fill="none" stroke={plan.color} strokeWidth={2.5}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - plan.value)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/80 font-mono text-xs">
                    {(plan.value * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="text-white/30 font-rajdhani text-[9px] tracking-wider uppercase">{plan.label}</span>
              <span className="text-white/20 font-mono text-[8px]">{plan.covered.toLocaleString()}</span>
            </div>
          )
        })}
      </div>

      {/* Primary 3D visualization — coverage terrain */}
      <div>
        <div className="text-white/15 font-rajdhani text-[9px] tracking-widest uppercase mb-2 text-center">
          Coverage by Region
        </div>
        <CoverageTerrainCanvas regionData={regionData} />
      </div>

      {/* Anchored insight */}
      <div className="text-center border-t border-white/[0.06] pt-4">
        <div className="text-white/40 font-mono text-[10px] leading-relaxed max-w-md mx-auto">
          {totalMlCovered > totalRealCovered
            ? `ML-optimal allocation could reach ${(totalMlCovered - totalRealCovered).toLocaleString()} more people than the historical response.`
            : `Historical response reached ${(totalRealCovered - totalMlCovered).toLocaleString()} more people than the ML model predicted as optimal.`
          }
        </div>
      </div>
    </div>
  )
}
