/**
 * VISUALIZATION ARCHETYPES
 *
 * 11 distinct visualization styles — each used exactly once across panels.
 * 1. TriangularAreaFill — area between two series, crosshair, scatter dots
 * 2. RidgeChart — layered mountain/ridge area fills
 * 3. FanBurst — lines radiating from a focal point
 * 4. ConcentricRadar — concentric arcs with data markers
 * 5. ThinVerticalBars — tightly packed thin vertical bars
 * 6. PerspectiveGrid — 3D receding grid with height data
 * 7. LargePercentReadout — big percentage number with indicator
 * 8. SegmentedHorizontalBars — horizontal stacked bar strips
 * 9. CircularGauge — donut arc gauge with ticks
 * 10. MountainSilhouette — multi-peak filled silhouette
 * 11. DotBarStrip — alternating dots and bars on a baseline
 */

// ─── Deterministic noise ──────────────────────────────────────────────

function sn(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297
  return (x - Math.floor(x)) * 2 - 1
}

function su(seed: number, i: number): number {
  const x = Math.sin(seed * 7919 + i * 104729) * 104729
  return x - Math.floor(x)
}

// ─── Edge-fade mask ───────────────────────────────────────────────────

function FadeMask({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="white" stopOpacity="0" />
        <stop offset="7%" stopColor="white" stopOpacity="1" />
        <stop offset="90%" stopColor="white" stopOpacity="1" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-m`}>
        <rect width="100%" height="100%" fill={`url(#${id}-f)`} />
      </mask>
    </defs>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 1. TRIANGULAR AREA FILL — area between two series with crosshair
// ═══════════════════════════════════════════════════════════════════════

interface TriangularAreaFillProps {
  dataA: number[]
  dataB: number[]
  width: number
  height: number
  seed?: number
  accentColor?: string
}

export function TriangularAreaFill({
  dataA, dataB, width, height, seed = 1,
  accentColor = 'rgba(255,180,60,0.6)',
}: TriangularAreaFillProps) {
  const id = `taf-${seed}`
  const all = [...dataA, ...dataB]
  const min = Math.min(...all) * 0.85
  const max = Math.max(...all) * 1.15
  const range = max - min || 1
  const pad = 4
  const iw = width - pad * 2
  const ih = height - pad * 2

  const toX = (i: number, len: number) => pad + (i / (len - 1)) * iw
  const toY = (v: number) => pad + ih - ((v - min) / range) * ih

  const len = Math.min(dataA.length, dataB.length)

  // Build area between two series
  const topPts = Array.from({ length: len }, (_, i) =>
    `${toX(i, len).toFixed(1)},${toY(dataA[i]).toFixed(1)}`
  )
  const botPts = Array.from({ length: len }, (_, i) =>
    `${toX(len - 1 - i, len).toFixed(1)},${toY(dataB[len - 1 - i]).toFixed(1)}`
  )
  const areaPath = `M${topPts.join(' L')} L${botPts.join(' L')} Z`
  const topLine = `M${topPts.join(' L')}`
  const botLine = `M${Array.from({ length: len }, (_, i) =>
    `${toX(i, len).toFixed(1)},${toY(dataB[i]).toFixed(1)}`
  ).join(' L')}`

  // Crosshair at max divergence
  let maxDivIdx = 0
  let maxDiv = 0
  for (let i = 0; i < len; i++) {
    const d = Math.abs(dataA[i] - dataB[i])
    if (d > maxDiv) { maxDiv = d; maxDivIdx = i }
  }
  const cx = toX(maxDivIdx, len)
  const cy = toY((dataA[maxDivIdx] + dataB[maxDivIdx]) / 2)

  // Scatter dots in the area
  const dots: { x: number; y: number; r: number; o: number }[] = []
  for (let d = 0; d < 24; d++) {
    const t = su(seed + d, d * 3) * (len - 1)
    const fl = Math.floor(t)
    const cl = Math.min(fl + 1, len - 1)
    const fr = t - fl
    const va = dataA[fl] * (1 - fr) + dataA[cl] * fr
    const vb = dataB[fl] * (1 - fr) + dataB[cl] * fr
    const lerp = su(seed + d * 7, d)
    dots.push({
      x: toX(t, len) + sn(seed + d * 5, d) * 3,
      y: toY(va + (vb - va) * lerp) + sn(seed + d * 9, d) * 2,
      r: 0.6 + su(seed + d, d) * 1.0,
      o: 0.12 + su(seed + d * 2, d) * 0.25,
    })
  }

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        <path d={areaPath} fill="rgba(255,255,255,0.04)" />
        <path d={topLine} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        <path d={botLine} fill="none" stroke={accentColor} strokeWidth="0.6" strokeDasharray="2 3" />
        <line x1={cx} y1={pad} x2={cx} y2={height - pad}
          stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="1 3" />
        <line x1={pad} y1={cy} x2={width - pad} y2={cy}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="1 3" />
        <circle cx={cx} cy={cy} r="2.5" fill="none" stroke={accentColor} strokeWidth="0.6" />
        <circle cx={cx} cy={cy} r="0.8" fill={accentColor} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="rgba(255,255,255,0.5)" opacity={d.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 2. RIDGE CHART — Layered mountain/ridge area fills
// ═══════════════════════════════════════════════════════════════════════

interface RidgeChartProps {
  series: number[][]
  width: number
  height: number
  seed?: number
  colors?: string[]
}

export function RidgeChart({
  series, width, height, seed = 2,
  colors = ['rgba(255,255,255,0.12)', 'rgba(255,180,60,0.08)', 'rgba(255,255,255,0.06)'],
}: RidgeChartProps) {
  const id = `rc-${seed}`
  const count = series.length
  const bandH = height / (count + 0.5)
  const all = series.flat()
  const min = Math.min(...all) * 0.9
  const max = Math.max(...all) * 1.1
  const range = max - min || 1

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {series.map((data, si) => {
          const baseY = (si + 1) * bandH
          const ampH = bandH * 0.85
          const pts = data.map((v, i) => {
            const x = (i / (data.length - 1)) * width
            const norm = (v - min) / range
            const y = baseY - norm * ampH
            return { x, y }
          })
          const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
          const areaPath = `${linePath} L${width},${baseY} L0,${baseY} Z`
          const color = colors[si % colors.length]
          const strokeColor = color.replace(/[\d.]+\)$/, '0.4)')
          return (
            <g key={si}>
              <path d={areaPath} fill={color} />
              <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="0.7" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 3. FAN BURST — Lines radiating from a focal point
// ═══════════════════════════════════════════════════════════════════════

interface FanBurstProps {
  values: number[]
  width: number
  height: number
  seed?: number
  accentColor?: string
}

export function FanBurst({
  values, width, height, seed = 3,
  accentColor = 'rgba(255,180,60,0.35)',
}: FanBurstProps) {
  const id = `fb-${seed}`
  const ox = width * 0.06
  const oy = height * 0.88
  const maxR = Math.sqrt(width * width + height * height) * 0.85
  const maxVal = Math.max(...values) || 1
  const angleSpan = Math.PI * 0.42
  const startAngle = -Math.PI * 0.88

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {values.map((v, i) => {
          const norm = v / maxVal
          const angle = startAngle + (i / (values.length - 1)) * angleSpan
          const len = norm * maxR * 0.8 + maxR * 0.12
          const ex = ox + Math.cos(angle) * len
          const ey = oy + Math.sin(angle) * len
          const accent = norm > 0.65
          return (
            <line key={i}
              x1={ox} y1={oy} x2={ex} y2={ey}
              stroke={accent ? accentColor : 'rgba(255,255,255,0.1)'}
              strokeWidth={accent ? 0.9 : 0.35}
            />
          )
        })}
        <circle cx={ox} cy={oy} r="1.5" fill="rgba(255,255,255,0.3)" />
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 4. CONCENTRIC RADAR — Concentric arcs with data markers
// ═══════════════════════════════════════════════════════════════════════

interface ConcentricRadarProps {
  values: { label: string; value: number; max: number }[]
  size: number
  seed?: number
}

export function ConcentricRadar({
  values, size, seed = 4,
}: ConcentricRadarProps) {
  const id = `cr-${seed}`
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 6
  const n = values.length
  const ringGap = maxR / (n + 1)

  return (
    <svg width={size} height={size} className="block">
      {/* Background rings */}
      {Array.from({ length: n + 1 }, (_, i) => (
        <circle key={`bg${i}`} cx={cx} cy={cy} r={ringGap * (i + 1)}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      ))}
      {/* Cross lines */}
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy}
        stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR}
        stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      {/* Data arcs */}
      {values.map((v, i) => {
        const r = ringGap * (i + 1.5)
        const norm = Math.min(1, v.value / (v.max || 1))
        const arcLen = norm * Math.PI * 1.5
        const sa = -Math.PI / 2
        const ea = sa + arcLen
        const x1 = cx + Math.cos(sa) * r
        const y1 = cy + Math.sin(sa) * r
        const x2 = cx + Math.cos(ea) * r
        const y2 = cy + Math.sin(ea) * r
        const large = arcLen > Math.PI ? 1 : 0
        const accent = norm > 0.55
        const col = accent ? 'rgba(255,180,60,0.45)' : 'rgba(255,255,255,0.22)'
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none" stroke={col} strokeWidth={1.2} />
            <circle cx={x2} cy={y2} r="1.5"
              fill={accent ? 'rgba(255,180,60,0.65)' : 'rgba(255,255,255,0.35)'} />
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 5. THIN VERTICAL BARS
// ═══════════════════════════════════════════════════════════════════════

interface ThinVerticalBarsProps {
  data: number[]
  width: number
  height: number
  seed?: number
  accentThreshold?: number
  /** Optional bar labels (shown below each bar) */
  labels?: string[]
  /** Optional Y-axis unit label */
  unit?: string
}

export function ThinVerticalBars({
  data, width, height, seed = 5,
  accentThreshold = 0.65,
  labels,
  unit,
}: ThinVerticalBarsProps) {
  const id = `tvb-${seed}`
  const maxVal = Math.max(...data) || 1
  const hasLabels = labels && labels.length > 0
  const labelH = hasLabels ? 14 : 0
  const plotH = height - labelH - 2
  const gap = width / data.length
  const barW = Math.max(1, gap * 0.55)

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        <line x1="0" y1={plotH} x2={width} y2={plotH}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
        {data.map((v, i) => {
          const norm = v / maxVal
          const h = norm * (plotH - 4)
          const x = i * gap + gap / 2 - barW / 2
          const accent = norm > accentThreshold
          return (
            <g key={i}>
              <rect x={x} y={plotH - h} width={barW} height={h}
                fill={accent ? 'rgba(255,180,60,0.45)' : 'rgba(255,255,255,0.18)'} />
              {/* Value on top */}
              {norm > 0.3 && (
                <text x={i * gap + gap / 2} y={plotH - h - 2}
                  textAnchor="middle" fill="rgba(255,255,255,0.3)"
                  fontSize="5.5" fontFamily="'DM Mono', monospace">
                  {v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0)}
                </text>
              )}
              {/* Label below bar */}
              {hasLabels && labels[i] && (
                <text x={i * gap + gap / 2} y={plotH + 10}
                  textAnchor="middle" fill="rgba(255,255,255,0.25)"
                  fontSize="6" fontFamily="'Rajdhani', sans-serif" fontWeight="600"
                  letterSpacing="0.05em">
                  {labels[i].length > Math.floor(gap / 4.5)
                    ? labels[i].slice(0, Math.floor(gap / 4.5)) + '..'
                    : labels[i]}
                </text>
              )}
            </g>
          )
        })}
        {/* Unit label */}
        {unit && (
          <text x={2} y={8} fill="rgba(255,255,255,0.15)"
            fontSize="6" fontFamily="'DM Mono', monospace">
            {unit}
          </text>
        )}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 6. PERSPECTIVE GRID — 3D receding grid with height data
// ═══════════════════════════════════════════════════════════════════════

interface PerspectiveGridProps {
  data: number[]
  width: number
  height: number
  seed?: number
  rows?: number
}

export function PerspectiveGrid({
  data, width, height, seed = 6, rows = 5,
}: PerspectiveGridProps) {
  const id = `pg-${seed}`
  const maxVal = Math.max(...data) || 1
  const vanishY = height * 0.12
  const baseY = height * 0.92
  const cols = data.length

  const rowLines: { y: number; scale: number; opacity: number }[] = []
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1)
    const y = baseY - (baseY - vanishY) * t * t
    const scale = 1 - t * 0.65
    rowLines.push({ y, scale, opacity: 0.06 + (1 - t) * 0.14 })
  }

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {rowLines.map((row, ri) => {
          const lx = width * (1 - row.scale) / 2
          const rx = width - lx
          return (
            <g key={ri}>
              <line x1={lx} y1={row.y} x2={rx} y2={row.y}
                stroke={`rgba(255,255,255,${row.opacity.toFixed(2)})`} strokeWidth="0.3" />
              {data.map((_, ci) => {
                const x = lx + (ci / (cols - 1)) * (rx - lx)
                return (
                  <line key={ci} x1={x} y1={row.y - 1} x2={x} y2={row.y + 1}
                    stroke={`rgba(255,255,255,${(row.opacity * 0.4).toFixed(2)})`} strokeWidth="0.3" />
                )
              })}
            </g>
          )
        })}
        {/* Data bars on front row */}
        {data.map((v, i) => {
          const norm = v / maxVal
          const lx = width * (1 - rowLines[0].scale) / 2
          const rx = width - lx
          const x = lx + (i / (cols - 1)) * (rx - lx)
          const barH = norm * (baseY - vanishY) * 0.32
          const accent = norm > 0.55
          return (
            <rect key={`d${i}`} x={x - 1.5} y={rowLines[0].y - barH}
              width={3} height={barH}
              fill={accent ? 'rgba(255,180,60,0.3)' : 'rgba(255,255,255,0.13)'} />
          )
        })}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 7. LARGE PERCENT READOUT — big number with trend indicator
// ═══════════════════════════════════════════════════════════════════════

interface LargePercentReadoutProps {
  value: number
  label: string
  subValue?: string
  trend?: 'up' | 'down' | 'flat'
  alert?: boolean
}

export function LargePercentReadout({
  value, label, subValue, trend, alert = false,
}: LargePercentReadoutProps) {
  const numColor = alert ? 'rgba(255,180,60,0.85)' : 'rgba(255,255,255,0.8)'
  const trendChar = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2014'
  const trendCol = trend === 'up' ? 'rgba(120,220,120,0.5)' :
    trend === 'down' ? 'rgba(255,160,60,0.5)' : 'rgba(255,255,255,0.15)'

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '2rem',
        fontWeight: 500,
        color: numColor,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', marginLeft: 1 }}>%</span>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '0.45rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase' as const,
        }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {subValue && (
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.55rem',
              color: 'rgba(255,255,255,0.35)',
            }}>{subValue}</span>
          )}
          {trend && (
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.5rem',
              color: trendCol,
            }}>{trendChar}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 8. SEGMENTED HORIZONTAL BARS — stacked bar strips
// ═══════════════════════════════════════════════════════════════════════

interface SegmentedHorizontalBarsProps {
  bars: { label: string; value: number; max: number }[]
  width: number
  height: number
}

export function SegmentedHorizontalBars({
  bars, width, height,
}: SegmentedHorizontalBarsProps) {
  const barH = Math.min(7, (height - 4) / bars.length - 4)
  const labelW = 56  // wider for full region names
  const valW = 28
  const barAreaW = width - labelW - valW - 4

  return (
    <svg width={width} height={height} className="block">
      {bars.map((bar, i) => {
        const y = 3 + i * (barH + 5)
        const norm = Math.min(1, bar.value / (bar.max || 1))
        const filledW = norm * barAreaW
        const high = norm > 0.7
        return (
          <g key={i}>
            <text x={labelW - 3} y={y + barH * 0.85}
              textAnchor="end"
              fill="rgba(255,255,255,0.25)" fontSize="6.5"
              fontFamily="'Rajdhani', sans-serif" fontWeight="600" letterSpacing="0.08em">
              {bar.label}
            </text>
            <rect x={labelW} y={y} width={barAreaW} height={barH}
              fill="rgba(255,255,255,0.03)" rx="0.5" />
            <rect x={labelW} y={y} width={filledW} height={barH}
              fill={high ? 'rgba(255,180,60,0.3)' : 'rgba(255,255,255,0.12)'} rx="0.5" />
            {[0.25, 0.5, 0.75].map(t => (
              <line key={t} x1={labelW + t * barAreaW} y1={y}
                x2={labelW + t * barAreaW} y2={y + barH}
                stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
            ))}
            <text x={labelW + barAreaW + 3} y={y + barH * 0.85}
              fill="rgba(255,255,255,0.35)" fontSize="6"
              fontFamily="'DM Mono', monospace">
              {bar.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 9. CIRCULAR GAUGE — donut arc with ticks and value
// ═══════════════════════════════════════════════════════════════════════

interface CircularGaugeProps {
  value: number
  max: number
  label: string
  unit?: string
  size: number
  alert?: boolean
}

export function CircularGauge({
  value, max, label, unit = '%', size, alert = false,
}: CircularGaugeProps) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8
  const norm = Math.min(1, value / (max || 1))
  const sa = Math.PI * 0.75
  const totalArc = Math.PI * 1.5
  const ea = sa + norm * totalArc

  const arc = (s: number, e: number) => {
    const x1 = cx + Math.cos(s) * r
    const y1 = cy + Math.sin(s) * r
    const x2 = cx + Math.cos(e) * r
    const y2 = cy + Math.sin(e) * r
    const large = (e - s) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const accentCol = alert ? 'rgba(255,180,60,0.6)' : 'rgba(255,255,255,0.35)'
  const valCol = alert ? 'rgba(255,180,60,0.85)' : 'rgba(255,255,255,0.75)'

  const ticks = Array.from({ length: 13 }, (_, i) => {
    const a = sa + (i / 12) * totalArc
    return {
      x1: cx + Math.cos(a) * (r - 3),
      y1: cy + Math.sin(a) * (r - 3),
      x2: cx + Math.cos(a) * (r + 2),
      y2: cy + Math.sin(a) * (r + 2),
    }
  })

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} className="block">
        <path d={arc(sa, sa + totalArc)} fill="none" stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5" strokeLinecap="round" />
        <path d={arc(sa, ea)} fill="none" stroke={accentCol}
          strokeWidth="2.5" strokeLinecap="round" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
        ))}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={valCol} fontSize="11" fontFamily="'DM Mono', monospace" fontWeight="500">
          {value}{unit}
        </text>
      </svg>
      <span style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '0.45rem',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase' as const,
        marginTop: -2,
      }}>{label}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 10. MOUNTAIN SILHOUETTE — multi-peak filled area
// ═══════════════════════════════════════════════════════════════════════

interface MountainSilhouetteProps {
  data: number[]
  width: number
  height: number
  seed?: number
  color?: string
  secondaryData?: number[]
}

export function MountainSilhouette({
  data, width, height, seed = 10,
  color = 'rgba(255,255,255,0.1)',
  secondaryData,
}: MountainSilhouetteProps) {
  const id = `ms-${seed}`
  const all = [...data, ...(secondaryData || [])]
  const maxVal = Math.max(...all) || 1

  const buildPath = (d: number[]) => {
    // Smooth by interpolating between points
    const smooth: { x: number; y: number }[] = []
    for (let i = 0; i < d.length - 1; i++) {
      for (let t = 0; t < 4; t++) {
        const frac = t / 4
        const val = d[i] * (1 - frac) + d[i + 1] * frac
        const x = ((i * 4 + t) / ((d.length - 1) * 4)) * width
        const y = height - (val / maxVal) * (height - 4) - 2
        smooth.push({ x, y })
      }
    }
    smooth.push({ x: width, y: height - (d[d.length - 1] / maxVal) * (height - 4) - 2 })

    const linePts = smooth.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const areaPts = `${linePts} L${width},${height} L0,${height} Z`
    return { linePts, areaPts }
  }

  const primary = buildPath(data)

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {secondaryData && (() => {
          const sec = buildPath(secondaryData)
          return (
            <>
              <path d={sec.areaPts} fill={color.replace(/[\d.]+\)$/, '0.05)')} />
              <path d={sec.linePts} fill="none" stroke={color.replace(/[\d.]+\)$/, '0.15)')} strokeWidth="0.4" />
            </>
          )
        })()}
        <path d={primary.areaPts} fill={color} />
        <path d={primary.linePts} fill="none" stroke={color.replace(/[\d.]+\)$/, '0.35)')} strokeWidth="0.6" />
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 11. DOT-BAR STRIP — alternating dots and bars
// ═══════════════════════════════════════════════════════════════════════

interface DotBarStripProps {
  events: { position: number; magnitude: number }[]
  width: number
  height: number
  seed?: number
  span: number
}

export function DotBarStrip({
  events, width, height, seed = 11, span,
}: DotBarStripProps) {
  const id = `dbs-${seed}`
  const midY = height / 2
  const maxMag = Math.max(...events.map(e => e.magnitude), 0.01)

  return (
    <svg width={width} height={height} className="block">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        <line x1="0" y1={midY} x2={width} y2={midY}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
        {events.map((ev, i) => {
          const x = (ev.position / (span || 1)) * width
          const norm = ev.magnitude / maxMag
          const barH = norm * (height * 0.38)
          const high = norm > 0.6
          const col = high ? 'rgba(255,180,60,0.5)' : 'rgba(255,255,255,0.25)'

          if (i % 2 === 0) {
            return (
              <rect key={i} x={x - 1} y={midY - barH} width={2} height={barH} fill={col} />
            )
          }
          return (
            <circle key={i} cx={x} cy={midY - barH * 0.7}
              r={0.8 + norm * 1.5} fill={col} opacity={0.3 + norm * 0.4} />
          )
        })}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STAT READOUT — simple label + value
// ═══════════════════════════════════════════════════════════════════════

interface StatReadoutProps {
  label: string
  value: string
  unit?: string
  alert?: boolean
}

export function StatReadout({ label, value, unit, alert = false }: StatReadoutProps) {
  return (
    <div className="fdp-stat">
      <div className="fdp-stat-label">{label}</div>
      <div className="fdp-stat-row">
        <span className="fdp-stat-value"
          style={alert ? { color: 'rgba(255,180,60,0.85)' } : undefined}>
          {value}
          {unit && <span className="fdp-stat-unit">{unit}</span>}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TREND INDICATOR
// ═══════════════════════════════════════════════════════════════════════

export function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'worsening' }) {
  const symbol = trend === 'improving' ? '\u2191' :
    trend === 'declining' || trend === 'worsening' ? '\u2193' : '\u2014'
  const color = trend === 'improving' ? 'rgba(120,220,120,0.4)' :
    trend === 'declining' || trend === 'worsening' ? 'rgba(255,160,60,0.4)' :
    'rgba(255,255,255,0.15)'
  return <span className="fdp-trend" style={{ color }}>{symbol}</span>
}
