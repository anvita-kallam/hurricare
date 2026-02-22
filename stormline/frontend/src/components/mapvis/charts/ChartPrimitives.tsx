/**
 * Custom SVG chart primitives for the Funding Disparity intelligence panels.
 * All charts are minimal, data-dense, matching the reference image exactly:
 * - ~1px stroke width
 * - No chunky axes
 * - Faint dotted grid
 * - White/gray base with muted orange/yellow accents
 * - DM Mono for values, Rajdhani for labels
 */

interface MiniLineChartProps {
  series: number[][]
  width: number
  height: number
  colors?: string[]
  showDots?: boolean
  showGrid?: boolean
  labels?: string[]
}

export function MiniLineChart({
  series,
  width,
  height,
  colors = ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.35)', 'rgba(255,180,60,0.6)'],
  showDots = false,
  showGrid = true,
  labels,
}: MiniLineChartProps) {
  const pad = { top: 4, right: 4, bottom: labels ? 16 : 4, left: 4 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom

  const allValues = series.flat()
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1

  const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * w
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h

  return (
    <svg width={width} height={height} className="block">
      {showGrid && (
        <g>
          {[0.25, 0.5, 0.75].map((frac) => (
            <line
              key={frac}
              x1={pad.left}
              y1={pad.top + h * frac}
              x2={pad.left + w}
              y2={pad.top + h * frac}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={pad.left + (w / 4) * i}
              y1={pad.top}
              x2={pad.left + (w / 4) * i}
              y2={pad.top + h}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          ))}
        </g>
      )}
      {series.map((data, si) => {
        const color = colors[si % colors.length]
        const path = data
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`)
          .join(' ')
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={color} strokeWidth="1" />
            {showDots &&
              data.map((v, i) => (
                <circle
                  key={i}
                  cx={toX(i, data.length)}
                  cy={toY(v)}
                  r="1.5"
                  fill={color}
                />
              ))}
          </g>
        )
      })}
      {labels && (
        <g>
          {labels.map((label, i) => (
            <text
              key={i}
              x={toX(i * Math.floor((series[0]?.length || 1) / (labels.length - 1 || 1)), series[0]?.length || 1)}
              y={height - 2}
              fill="rgba(255,255,255,0.25)"
              fontSize="7"
              fontFamily="'DM Mono', monospace"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}

interface MiniAreaChartProps {
  data: number[]
  width: number
  height: number
  color?: string
  fillOpacity?: number
  showGrid?: boolean
}

export function MiniAreaChart({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.5)',
  fillOpacity = 0.08,
  showGrid = true,
}: MiniAreaChartProps) {
  const pad = { top: 4, right: 4, bottom: 4, left: 4 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * w
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h

  const linePath = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ')

  const areaPath = `${linePath} L${toX(data.length - 1).toFixed(1)},${(pad.top + h).toFixed(1)} L${pad.left},${(pad.top + h).toFixed(1)} Z`

  return (
    <svg width={width} height={height} className="block">
      {showGrid && (
        <g>
          {[0.33, 0.66].map((frac) => (
            <line
              key={frac}
              x1={pad.left}
              y1={pad.top + h * frac}
              x2={pad.left + w}
              y2={pad.top + h * frac}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          ))}
        </g>
      )}
      <path d={areaPath} fill={color} opacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  )
}

interface MiniDotTimelineProps {
  events: { year: number; severity: number }[]
  width: number
  height: number
  yearRange?: [number, number]
}

export function MiniDotTimeline({
  events,
  width,
  height,
  yearRange = [2013, 2024],
}: MiniDotTimelineProps) {
  const pad = { top: 6, right: 8, bottom: 14, left: 8 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const span = yearRange[1] - yearRange[0]

  const toX = (year: number) => pad.left + ((year - yearRange[0]) / span) * w

  return (
    <svg width={width} height={height} className="block">
      {/* baseline */}
      <line
        x1={pad.left}
        y1={pad.top + h / 2}
        x2={pad.left + w}
        y2={pad.top + h / 2}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />
      {/* year ticks */}
      {Array.from({ length: span + 1 }, (_, i) => yearRange[0] + i)
        .filter((y) => y % 3 === 0)
        .map((year) => (
          <g key={year}>
            <line
              x1={toX(year)}
              y1={pad.top + h / 2 - 2}
              x2={toX(year)}
              y2={pad.top + h / 2 + 2}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.5"
            />
            <text
              x={toX(year)}
              y={height - 2}
              fill="rgba(255,255,255,0.2)"
              fontSize="6.5"
              fontFamily="'DM Mono', monospace"
              textAnchor="middle"
            >
              {year}
            </text>
          </g>
        ))}
      {/* event dots */}
      {events.map((ev, i) => {
        const x = toX(ev.year)
        const r = 2 + ev.severity * 3
        const color =
          ev.severity > 0.7
            ? 'rgba(255,160,50,0.8)'
            : ev.severity > 0.4
            ? 'rgba(255,255,255,0.5)'
            : 'rgba(255,255,255,0.25)'
        return (
          <circle
            key={i}
            cx={x}
            cy={pad.top + h / 2}
            r={r}
            fill={color}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.5"
          />
        )
      })}
    </svg>
  )
}

interface MiniHistogramProps {
  data: number[]
  width: number
  height: number
  color?: string
  showGrid?: boolean
}

export function MiniHistogram({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.4)',
  showGrid = true,
}: MiniHistogramProps) {
  const pad = { top: 4, right: 4, bottom: 4, left: 4 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom

  const max = Math.max(...data)

  // Generate smooth curve path through tops of bars
  const points = data.map((v, i) => ({
    x: pad.left + (i / (data.length - 1)) * w,
    y: pad.top + h - (v / (max || 1)) * h,
  }))

  // Smooth curve using quadratic bezier
  let curvePath = `M${points[0].x.toFixed(1)},${(pad.top + h).toFixed(1)} L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const cx = (points[i - 1].x + points[i].x) / 2
    curvePath += ` Q${points[i - 1].x.toFixed(1)},${points[i - 1].y.toFixed(1)} ${cx.toFixed(1)},${((points[i - 1].y + points[i].y) / 2).toFixed(1)}`
  }
  curvePath += ` L${points[points.length - 1].x.toFixed(1)},${points[points.length - 1].y.toFixed(1)}`
  curvePath += ` L${points[points.length - 1].x.toFixed(1)},${(pad.top + h).toFixed(1)} Z`

  const strokePath = points.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`
    const prev = points[i - 1]
    const cx = (prev.x + p.x) / 2
    return acc + ` Q${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${((prev.y + p.y) / 2).toFixed(1)}`
  }, '') + ` L${points[points.length - 1].x.toFixed(1)},${points[points.length - 1].y.toFixed(1)}`

  return (
    <svg width={width} height={height} className="block">
      {showGrid && (
        <line
          x1={pad.left}
          y1={pad.top + h}
          x2={pad.left + w}
          y2={pad.top + h}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />
      )}
      <path d={curvePath} fill={color} opacity="0.1" />
      <path d={strokePath} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  )
}

interface MiniSparklineProps {
  data: number[]
  width: number
  height: number
  color?: string
}

export function MiniSparkline({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.4)',
}: MiniSparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const toX = (i: number) => (i / (data.length - 1)) * width
  const toY = (v: number) => height - ((v - min) / range) * height

  const path = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ')

  return (
    <svg width={width} height={height} className="block">
      <path d={path} fill="none" stroke={color} strokeWidth="1" />
      <circle
        cx={toX(data.length - 1)}
        cy={toY(data[data.length - 1])}
        r="1.5"
        fill={color}
      />
    </svg>
  )
}

interface StatWithSparklineProps {
  label: string
  value: string
  unit?: string
  sparkData?: number[]
  sparkColor?: string
  alert?: boolean
}

export function StatWithSparkline({
  label,
  value,
  unit,
  sparkData,
  sparkColor = 'rgba(255,255,255,0.35)',
  alert = false,
}: StatWithSparklineProps) {
  return (
    <div className="fdp-stat">
      <div className="fdp-stat-label">{label}</div>
      <div className="fdp-stat-row">
        <span
          className="fdp-stat-value"
          style={alert ? { color: 'rgba(255,180,60,0.9)' } : undefined}
        >
          {value}
          {unit && <span className="fdp-stat-unit">{unit}</span>}
        </span>
        {sparkData && sparkData.length > 1 && (
          <MiniSparkline
            data={sparkData}
            width={48}
            height={16}
            color={alert ? 'rgba(255,180,60,0.5)' : sparkColor}
          />
        )}
      </div>
    </div>
  )
}

interface TrendIndicatorProps {
  trend: 'improving' | 'stable' | 'declining' | 'worsening'
}

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const symbol =
    trend === 'improving' ? '\u2191' :
    trend === 'declining' || trend === 'worsening' ? '\u2193' : '\u2192'
  const color =
    trend === 'improving' ? 'rgba(120,220,120,0.6)' :
    trend === 'declining' || trend === 'worsening' ? 'rgba(255,160,60,0.6)' :
    'rgba(255,255,255,0.3)'

  return (
    <span className="fdp-trend" style={{ color }}>
      {symbol} {trend}
    </span>
  )
}
