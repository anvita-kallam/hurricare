import { useMemo, useState, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PlanData {
  allocations: Array<{
    region: string
    budget: number
    coverage_estimate: {
      people_covered: number
      coverage_ratio: number
      unmet_need: number
      severity_weighted_impact?: number
    }
    resources?: {
      shelters: number
      hospital_beds: number
      responder_units: number
      evac_vehicles: number
      food_days: number
      power_units: number
    }
  }>
  total_budget: number
  objective_scores?: Record<string, number>
}

interface ChartProps {
  userPlan: PlanData
  mlPlan: PlanData
  realPlan: PlanData
}

// ─── Utility ────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function AnimatedNumber({ value, duration = 1200, prefix = '', suffix = '' }: {
  value: number; duration?: number; prefix?: string; suffix?: string
}) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(0)
  const startTimeRef = useRef(0)

  useEffect(() => {
    startRef.current = display
    startTimeRef.current = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(lerp(startRef.current, value, eased))
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return <>{prefix}{Math.round(display).toLocaleString()}{suffix}</>
}

// ─── Ring Indicator ─────────────────────────────────────────────────────────────

export function RingIndicator({ value, max, label, color, size = 72, children }: {
  value: number; max: number; label: string; color: string; size?: number; children?: React.ReactNode
}) {
  const [animatedVal, setAnimatedVal] = useState(0)
  const ratio = max > 0 ? value / max : 0
  const circumference = 2 * Math.PI * (size / 2 - 4)
  const strokeDashoffset = circumference * (1 - animatedVal)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedVal(ratio), 100)
    return () => clearTimeout(timer)
  }, [ratio])

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2} cy={size / 2} r={size / 2 - 4}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2}
          />
          {/* Value arc */}
          <circle
            cx={size / 2} cy={size / 2} r={size / 2 - 4}
            fill="none" stroke={color} strokeWidth={2.5}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/90 font-mono text-xs font-medium">
            {children || `${(ratio * 100).toFixed(0)}%`}
          </span>
        </div>
      </div>
      <span className="text-white/35 font-rajdhani text-[10px] tracking-wider uppercase text-center leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Compact Bar Cluster ────────────────────────────────────────────────────────

export function CompactBarCluster({ data, height = 120 }: {
  data: Array<{ label: string; user: number; ml: number; real: number }>
  height?: number
}) {
  const maxVal = useMemo(() => {
    let m = 0
    data.forEach(d => { m = Math.max(m, d.user, d.ml, d.real) })
    return m || 1
  }, [data])

  const barWidth = Math.max(2, Math.min(6, 200 / (data.length * 3 + data.length)))

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-px" style={{ height }}>
        {data.map((d, i) => {
          const userH = (d.user / maxVal) * (height - 16)
          const mlH = (d.ml / maxVal) * (height - 16)
          const realH = (d.real / maxVal) * (height - 16)
          return (
            <div key={i} className="flex items-end gap-px group relative flex-1 justify-center">
              <div
                className="transition-all duration-700 ease-out rounded-t-[1px]"
                style={{ width: barWidth, height: userH, transitionDelay: `${i * 40}ms`, backgroundColor: 'rgba(255,255,255,0.6)' }}
              />
              <div
                className="transition-all duration-700 ease-out rounded-t-[1px]"
                style={{ width: barWidth, height: mlH, transitionDelay: `${i * 40 + 80}ms`, backgroundColor: 'rgba(255,255,255,0.35)' }}
              />
              <div
                className="transition-all duration-700 ease-out rounded-t-[1px]"
                style={{ width: barWidth, height: realH, transitionDelay: `${i * 40 + 160}ms`, backgroundColor: 'rgba(255,255,255,0.15)' }}
              />
              {/* Hover tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 pointer-events-none">
                <div className="bg-black/95 border border-white/10 rounded px-2 py-1.5 whitespace-nowrap">
                  <div className="text-white/70 font-rajdhani text-[10px] font-semibold mb-1">{d.label}</div>
                  <div className="text-[9px] font-mono space-y-0.5">
                    <div style={{ color: 'rgba(255,255,255,0.7)' }}>You: ${(d.user / 1e6).toFixed(1)}M</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>ML: ${(d.ml / 1e6).toFixed(1)}M</div>
                    <div style={{ color: 'rgba(255,255,255,0.2)' }}>Real: ${(d.real / 1e6).toFixed(1)}M</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* X labels — full names with smart overflow */}
      <div className="flex justify-between mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center overflow-hidden">
            <span className="text-white/25 font-rajdhani text-[7px] tracking-wide block truncate" title={d.label}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Delta Bar (shows difference between two values) ────────────────────────────

export function DeltaBar({ label, ideal, actual, maxRange }: {
  label: string; ideal: number; actual: number; maxRange: number
}) {
  const delta = ideal - actual
  const pct = maxRange > 0 ? (delta / maxRange) * 100 : 0
  const isPositive = delta >= 0

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-white/30 font-rajdhani text-[10px] w-20 truncate tracking-wide uppercase">{label}</span>
      <div className="flex-1 h-[6px] bg-white/[0.04] rounded-full relative overflow-hidden">
        <div className="absolute top-0 left-1/2 w-px h-full bg-white/10" />
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            left: isPositive ? '50%' : `${50 + pct}%`,
            width: `${Math.abs(pct)}%`,
            backgroundColor: isPositive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
          }}
        />
      </div>
      <span className="font-mono text-[10px] w-14 text-right" style={{ color: isPositive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>
        {isPositive ? '+' : ''}{(delta / 1e6).toFixed(1)}M
      </span>
    </div>
  )
}

// ─── Contour Surface (simulated intensity map) ──────────────────────────────────

export function ContourSurface({ regions, colorFn, height = 140 }: {
  regions: Array<{ name: string; value: number; max: number }>
  colorFn: (ratio: number) => string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Create a grid of intensity values based on region data
    const cols = regions.length
    const cellW = w / cols

    regions.forEach((region, i) => {
      const ratio = region.max > 0 ? region.value / region.max : 0
      const x = i * cellW

      // Draw contour-like gradient for each region
      const gradient = ctx.createLinearGradient(x, 0, x, h)
      const baseColor = colorFn(ratio)
      gradient.addColorStop(0, 'transparent')
      gradient.addColorStop(0.3, baseColor)
      gradient.addColorStop(0.5 + ratio * 0.3, baseColor)
      gradient.addColorStop(1, 'transparent')

      ctx.fillStyle = gradient
      ctx.globalAlpha = 0.3 + ratio * 0.5
      ctx.fillRect(x, 0, cellW + 1, h)

      // Add contour lines
      ctx.strokeStyle = baseColor
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 0.5
      const levels = 4
      for (let l = 0; l < levels; l++) {
        const y = (h / levels) * l + (1 - ratio) * (h / levels) * 0.5
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.bezierCurveTo(
          x + cellW * 0.3, y - 4 * ratio,
          x + cellW * 0.7, y + 6 * ratio,
          x + cellW, y
        )
        ctx.stroke()
      }
    })

    ctx.globalAlpha = 1
    setAnimated(true)
  }, [regions, colorFn])

  return (
    <div className="relative" style={{ height }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="w-full h-full transition-opacity duration-1000"
        style={{ opacity: animated ? 1 : 0, imageRendering: 'auto' }}
      />
      {/* Region labels overlaid — full names */}
      <div className="absolute bottom-0 left-0 right-0 flex">
        {regions.map((r, i) => (
          <div key={i} className="flex-1 text-center pb-1 overflow-hidden">
            <span className="text-white/30 font-rajdhani text-[7px] tracking-wide truncate block" title={r.name}>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Severity Grid (small multiples) ────────────────────────────────────────────

export function SeverityGrid({ data }: {
  data: Array<{ region: string; severity: number; coverage: number; gap: number }>
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {data.map((d, i) => {
        const sevOpacity = 0.1 + d.severity * 0.4
        const sevColor = `rgba(255,255,255,${sevOpacity})`
        const gapOpacity = d.gap > 0.2 ? 0.5 : d.gap > 0.05 ? 0.3 : 0.15
        const gapColor = `rgba(255,255,255,${gapOpacity})`

        return (
          <div
            key={i}
            className="relative p-1.5 rounded-sm border border-white/[0.04] group cursor-default transition-all duration-300 hover:border-white/10"
            style={{
              background: `linear-gradient(135deg, ${sevColor} 0%, transparent 100%)`,
            }}
          >
            <div className="text-white/50 font-rajdhani text-[9px] tracking-wider uppercase truncate">{d.region}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono text-[10px] text-white/70">{(d.coverage * 100).toFixed(0)}%</span>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gapColor }} />
            </div>
            {/* Hover detail */}
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 pointer-events-none">
              <div className="bg-black/95 border border-white/10 rounded px-2 py-1.5 whitespace-nowrap">
                <div className="text-white/60 font-rajdhani text-[10px] font-semibold">{d.region}</div>
                <div className="text-[9px] font-mono space-y-0.5 mt-0.5">
                  <div style={{ color: `rgba(255,255,255,${0.3 + d.severity * 0.5})` }}>Severity: {(d.severity * 10).toFixed(1)}</div>
                  <div className="text-white/50">Coverage: {(d.coverage * 100).toFixed(1)}%</div>
                  <div style={{ color: gapColor }}>Gap: {(d.gap * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Dense Time-Series Lines (simulated temporal progression) ───────────────────

export function DenseTimeSeries({ series, height = 100, labels }: {
  series: Array<{ name: string; color: string; values: number[] }>
  height?: number
  labels?: string[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const maxVal = useMemo(() => {
    let m = 0
    series.forEach(s => s.values.forEach(v => { if (v > m) m = v }))
    return m || 1
  }, [series])

  const width = 300

  // Monochrome line differentiation: all white, varying strokeWidth and opacity
  const lineStyles = [
    { strokeWidth: 2.0, opacity: 0.8 },
    { strokeWidth: 1.2, opacity: 0.45 },
    { strokeWidth: 0.7, opacity: 0.2 },
  ]

  return (
    <div className="relative" style={{ height }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <line
            key={ratio}
            x1={0} y1={height * (1 - ratio)} x2={width} y2={height * (1 - ratio)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
          />
        ))}
        {/* Series */}
        {series.map((s, si) => {
          const style = lineStyles[si] || { strokeWidth: 1.0, opacity: 0.3 }
          const points = s.values.map((v, i) => {
            const x = (i / (s.values.length - 1)) * width
            const y = height - (v / maxVal) * (height - 10)
            return `${x},${y}`
          }).join(' ')

          // Area fill
          const firstY = height - (s.values[0] / maxVal) * (height - 10)
          const areaPath = `M0,${firstY} ${points.split(' ').map(p => `L${p}`).join(' ')} L${width},${height} L0,${height} Z`

          return (
            <g key={si}>
              <path
                d={areaPath}
                fill="rgba(255,255,255,1)"
                opacity={style.opacity * 0.08}
                className="transition-opacity duration-1000"
              />
              <polyline
                points={points}
                fill="none"
                stroke="rgba(255,255,255,1)"
                strokeWidth={style.strokeWidth}
                opacity={style.opacity}
                className="transition-opacity duration-1000"
                style={{ strokeDasharray: width * 2, strokeDashoffset: 0 }}
              />
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div className="absolute top-1 right-1 flex gap-3">
        {series.map((s, i) => {
          const style = lineStyles[i] || { strokeWidth: 1.0, opacity: 0.3 }
          return (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,1)', opacity: style.opacity, height: Math.max(1, style.strokeWidth) }} />
              <span className="text-white/30 font-mono text-[8px]">{s.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Funding Flow Sankey-like Visualization ─────────────────────────────────────

export function FundingFlow({ allocations, totalBudget, planLabel, color }: {
  allocations: Array<{ region: string; budget: number }>
  totalBudget: number
  planLabel: string
  color: string
}) {
  const sorted = useMemo(() =>
    [...allocations].sort((a, b) => b.budget - a.budget),
    [allocations]
  )

  return (
    <div className="space-y-px">
      {sorted.map((a, i) => {
        const pct = totalBudget > 0 ? (a.budget / totalBudget) * 100 : 0
        return (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-white/25 font-mono text-[9px] w-16 truncate text-right">{a.region.slice(0, 10)}</span>
            <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  opacity: 0.5 + (pct / 100) * 0.5,
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            </div>
            <span className="text-white/30 font-mono text-[9px] w-12 text-right">{pct.toFixed(0)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Metric Card (for key stats) ────────────────────────────────────────────────

export function MetricCard({ label, value, subtext, trend, color = 'rgba(255,255,255,0.7)' }: {
  label: string; value: string | number; subtext?: string; trend?: 'up' | 'down' | 'neutral'
  color?: string
}) {
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : ''
  const trendColor = trend === 'up' ? 'rgba(255,255,255,0.6)' : trend === 'down' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.4)'

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-sm p-2.5 transition-all duration-300 hover:border-white/[0.1]">
      <div className="text-white/30 font-rajdhani text-[9px] tracking-wider uppercase mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-base font-medium" style={{ color }}>{value}</span>
        {trend && (
          <span className="text-[10px]" style={{ color: trendColor }}>{trendIcon}</span>
        )}
      </div>
      {subtext && (
        <div className="text-white/20 font-mono text-[9px] mt-0.5">{subtext}</div>
      )}
    </div>
  )
}

// ─── Coverage Surface Map ───────────────────────────────────────────────────────

export function CoverageSurfaceMap({ userPlan, mlPlan, realPlan }: ChartProps) {
  const regions = useMemo(() => {
    return realPlan.allocations.map(ra => {
      const ua = userPlan.allocations.find(a => a.region === ra.region)
      const ma = mlPlan.allocations.find(a => a.region === ra.region)
      return {
        name: ra.region,
        userCoverage: ua?.coverage_estimate.coverage_ratio || 0,
        mlCoverage: ma?.coverage_estimate.coverage_ratio || 0,
        realCoverage: ra.coverage_estimate.coverage_ratio || 0,
        gap: (ma?.coverage_estimate.coverage_ratio || 0) - (ra.coverage_estimate.coverage_ratio || 0),
      }
    })
  }, [userPlan, mlPlan, realPlan])

  return (
    <div className="space-y-2">
      {regions.map((r, i) => {
        const maxCoverage = Math.max(r.userCoverage, r.mlCoverage, r.realCoverage, 0.01)
        const gapOpacity = r.gap > 0.1 ? 0.6 : r.gap > 0 ? 0.4 : 0.25
        return (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-white/25 font-rajdhani text-[10px] w-20 truncate tracking-wide uppercase">{r.name}</span>
            <div className="flex-1 flex gap-0.5 items-end h-5">
              {/* Stacked comparison bars */}
              <div className="flex-1 relative h-full">
                <div className="absolute inset-0 bg-white/[0.02] rounded-sm" />
                <div
                  className="absolute bottom-0 left-0 h-full rounded-sm transition-all duration-800 ease-out"
                  style={{ width: `${(r.userCoverage / maxCoverage) * 100}%`, transitionDelay: `${i * 50}ms`, backgroundColor: 'rgba(255,255,255,0.5)' }}
                />
                <div
                  className="absolute bottom-0 left-0 h-1 rounded-sm transition-all duration-800 ease-out"
                  style={{ width: `${(r.mlCoverage / maxCoverage) * 100}%`, transitionDelay: `${i * 50 + 100}ms`, backgroundColor: 'rgba(255,255,255,0.3)' }}
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 rounded-sm transition-all duration-800 ease-out"
                  style={{ width: `${(r.realCoverage / maxCoverage) * 100}%`, transitionDelay: `${i * 50 + 200}ms`, backgroundColor: 'rgba(255,255,255,0.15)' }}
                />
              </div>
            </div>
            <span className="font-mono text-[9px] w-10 text-right" style={{ color: `rgba(255,255,255,${gapOpacity})` }}>
              {r.gap > 0 ? '-' : '+'}{(Math.abs(r.gap) * 100).toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
