/**
 * Step 2 — Budget Allocation Visualization
 *
 * Shows how the user's allocation compares visually across regions.
 * Reactive 3D visualization with depth planes.
 */

import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Depth-layered bar field: user vs ML vs historical as stacked depth planes */
function AllocationDepthField({ data }: {
  data: Array<{ region: string; user: number; ml: number; real: number }>
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

    const maxVal = Math.max(...data.flatMap(d => [d.user, d.ml, d.real]), 1)
    const cols = data.length
    const cellW = (w - 40) / cols
    const maxBarH = h * 0.6
    const baseY = h * 0.82
    const layers = [
      { key: 'real' as const, color: 'rgba(170, 68, 68,', depthZ: 16, label: 'Historical' },
      { key: 'ml' as const, color: 'rgba(136, 85, 170,', depthZ: 8, label: 'ML Ideal' },
      { key: 'user' as const, color: 'rgba(68, 136, 170,', depthZ: 0, label: 'Your Plan' },
    ]

    // Draw layers back-to-front
    layers.forEach((layer) => {
      data.forEach((d, i) => {
        const val = d[layer.key]
        const barH = Math.max(2, (val / maxVal) * maxBarH)
        const x = 20 + i * cellW + cellW * 0.15
        const barW = cellW * 0.6
        const offsetX = layer.depthZ * 0.5
        const offsetY = -layer.depthZ * 0.7

        // Bar shadow/depth
        ctx.fillStyle = `${layer.color} 0.15)`
        ctx.fillRect(x + offsetX + 2, baseY + offsetY - barH + 2, barW, barH)

        // Bar body
        ctx.fillStyle = `${layer.color} 0.6)`
        ctx.fillRect(x + offsetX, baseY + offsetY - barH, barW, barH)

        // Top edge
        ctx.fillStyle = `${layer.color} 0.8)`
        ctx.fillRect(x + offsetX, baseY + offsetY - barH, barW, 2)
      })
    })

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '9px Rajdhani'
    ctx.textAlign = 'center'
    data.forEach((d, i) => {
      const x = 20 + i * cellW + cellW * 0.5
      ctx.fillText(
        d.region.length > 10 ? d.region.slice(0, 10) + '..' : d.region,
        x,
        baseY + 16
      )
    })

    // Legend
    const legendY = 16
    layers.slice().reverse().forEach((layer, li) => {
      const lx = w - 120 + li * 40
      ctx.fillStyle = `${layer.color} 0.7)`
      ctx.fillRect(lx, legendY - 4, 8, 8)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '8px DM Mono, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(layer.label, lx + 11, legendY + 3)
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

export default function Step2Allocation() {
  const { comparisonData, coverage, selectedHurricane } = useStore()

  const allocationData = useMemo(() => {
    if (!comparisonData?.realPlan) return []
    return comparisonData.realPlan.allocations.map((ra: any) => {
      const ua = comparisonData.userPlan?.allocations?.find((a: any) => a.region === ra.region)
      const ma = comparisonData.mlPlan?.allocations?.find((a: any) => a.region === ra.region)
      return {
        region: ra.region,
        user: ua?.budget || 0,
        ml: ma?.budget || 0,
        real: ra.budget || 0,
      }
    })
  }, [comparisonData])

  const totalUser = comparisonData?.userPlan?.total_budget || 0
  const totalMl = comparisonData?.mlPlan?.total_budget || 0
  const totalReal = comparisonData?.realPlan?.total_budget || 0

  if (!comparisonData) return null

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
          Allocation Dynamics
        </div>
        <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
          Budget Distribution
        </h2>
      </div>

      {/* Budget totals — minimal row */}
      <div className="flex justify-center gap-6">
        <div className="text-center">
          <div className="text-[#4488aa]/80 font-mono text-sm">{formatBudget(totalUser)}</div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">You</div>
        </div>
        <div className="text-center">
          <div className="text-[#8855aa]/80 font-mono text-sm">{formatBudget(totalMl)}</div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">ML Ideal</div>
        </div>
        <div className="text-center">
          <div className="text-[#aa4444]/80 font-mono text-sm">{formatBudget(totalReal)}</div>
          <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Historical</div>
        </div>
      </div>

      {/* Primary visualization — depth-layered allocation bars */}
      <div>
        <div className="text-white/15 font-rajdhani text-[9px] tracking-widest uppercase mb-2 text-center">
          Regional Budget Comparison
        </div>
        <AllocationDepthField data={allocationData} />
      </div>

      {/* Region-by-region funding flow bars */}
      <div className="space-y-1.5">
        {allocationData.map((d: any, i: number) => {
          const maxRegion = Math.max(d.user, d.ml, d.real, 1)
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-white/30 font-rajdhani text-[10px] w-20 truncate tracking-wide uppercase">
                {d.region}
              </span>
              <div className="flex-1 space-y-px">
                <div className="h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4488aa]/50 rounded-full transition-all duration-1000"
                    style={{ width: `${(d.user / maxRegion) * 100}%`, transitionDelay: `${i * 50}ms` }}
                  />
                </div>
                <div className="h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8855aa]/50 rounded-full transition-all duration-1000"
                    style={{ width: `${(d.ml / maxRegion) * 100}%`, transitionDelay: `${i * 50 + 80}ms` }}
                  />
                </div>
                <div className="h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#aa4444]/50 rounded-full transition-all duration-1000"
                    style={{ width: `${(d.real / maxRegion) * 100}%`, transitionDelay: `${i * 50 + 160}ms` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
