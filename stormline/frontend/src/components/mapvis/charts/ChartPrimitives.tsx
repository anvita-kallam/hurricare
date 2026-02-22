/**
 * Signal-intelligence chart primitives for Funding Disparity panels.
 *
 * Every chart is a multi-layer signal visualization:
 * - Ghost lines, variance envelopes, jitter points, prediction tails
 * - Particle point-fields for uncertainty/dispersion
 * - Edge-fade via SVG gradient masks — panel is a window, not the dataset
 * - Density > readability. Shape > explanation.
 * - No single clean lines. No easy parsing.
 */

// ─── Deterministic noise ─────────────────────────────────────────────────

function seededNoise(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297
  return (x - Math.floor(x)) * 2 - 1 // -1 to 1
}

function seededUnit(seed: number, i: number): number {
  const x = Math.sin(seed * 7919 + i * 104729) * 104729
  return x - Math.floor(x) // 0 to 1
}

// ─── SVG Edge-fade definitions (reusable) ─────────────────────────────────

function EdgeFadeDefs({ id, direction = 'horizontal' }: { id: string; direction?: 'horizontal' | 'vertical' | 'both' }) {
  return (
    <defs>
      {(direction === 'horizontal' || direction === 'both') && (
        <linearGradient id={`${id}-hfade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="8%" stopColor="white" stopOpacity="1" />
          <stop offset="88%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      )}
      {(direction === 'vertical' || direction === 'both') && (
        <linearGradient id={`${id}-vfade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
          <stop offset="15%" stopColor="white" stopOpacity="1" />
          <stop offset="85%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.5" />
        </linearGradient>
      )}
      <mask id={`${id}-mask`}>
        <rect width="100%" height="100%" fill={
          direction === 'both' ? `url(#${id}-hfade)` :
          direction === 'horizontal' ? `url(#${id}-hfade)` :
          `url(#${id}-vfade)`
        } />
      </mask>
    </defs>
  )
}

// ─── Signal Line Chart ───────────────────────────────────────────────────
// Multi-layer: primary + ghost lines + variance envelope + jitter + prediction tail

interface SignalLineChartProps {
  series: number[][]
  width: number
  height: number
  colors?: string[]
  seed?: number
  showVariance?: boolean
  showGhosts?: boolean
  showJitter?: boolean
  showPrediction?: boolean
}

export function SignalLineChart({
  series,
  width,
  height,
  colors = ['rgba(255,255,255,0.6)', 'rgba(255,180,60,0.45)'],
  seed = 42,
  showVariance = true,
  showGhosts = true,
  showJitter = true,
  showPrediction = true,
}: SignalLineChartProps) {
  const pad = { top: 2, right: -2, bottom: 2, left: -2 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const chartId = `slc-${seed}-${width}`

  const allValues = series.flat()
  const min = Math.min(...allValues) - (Math.max(...allValues) - Math.min(...allValues)) * 0.15
  const max = Math.max(...allValues) + (Math.max(...allValues) - Math.min(...allValues)) * 0.15
  const range = max - min || 1

  const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * w
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h

  const buildPath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  // Generate ghost lines (shifted variants of each series)
  const ghostLines: { path: string; color: string; opacity: number }[] = []
  if (showGhosts) {
    series.forEach((data, si) => {
      for (let g = 0; g < 3; g++) {
        const ghostData = data.map((v, i) => v + seededNoise(seed + si * 100 + g * 31, i) * range * 0.06)
        ghostLines.push({
          path: buildPath(ghostData),
          color: colors[si % colors.length],
          opacity: 0.08 + g * 0.03,
        })
      }
    })
  }

  // Variance envelopes
  const envelopes: { upper: string; lower: string; color: string }[] = []
  if (showVariance) {
    series.forEach((data, si) => {
      const variance = data.map((v, i) => {
        const localVar = Math.abs(seededNoise(seed + si * 200, i * 3)) * range * 0.1 + range * 0.02
        return localVar
      })
      const upperPoints = data.map((v, i) => ({ x: toX(i, data.length), y: toY(v + variance[i]) }))
      const lowerPoints = data.map((v, i) => ({ x: toX(i, data.length), y: toY(v - variance[i]) }))
      const envPath = upperPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        + ' ' + lowerPoints.reverse().map((p, i) => `${i === 0 ? 'L' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
      envelopes.push({ upper: envPath, lower: envPath, color: colors[si % colors.length] })
    })
  }

  // Jitter points (scattered samples along curve)
  const jitterPoints: { x: number; y: number; r: number; opacity: number; color: string }[] = []
  if (showJitter) {
    series.forEach((data, si) => {
      const color = colors[si % colors.length]
      for (let j = 0; j < data.length * 3; j++) {
        const idx = seededUnit(seed + si * 300 + j, j * 7) * (data.length - 1)
        const floorIdx = Math.floor(idx)
        const ceilIdx = Math.min(floorIdx + 1, data.length - 1)
        const frac = idx - floorIdx
        const baseVal = data[floorIdx] * (1 - frac) + data[ceilIdx] * frac
        const jit = seededNoise(seed + si * 400 + j, j * 13) * range * 0.08
        jitterPoints.push({
          x: toX(idx, data.length),
          y: toY(baseVal + jit),
          r: 0.6 + seededUnit(seed + j, j) * 0.8,
          opacity: 0.12 + seededUnit(seed + j * 3, j) * 0.18,
          color,
        })
      }
    })
  }

  // Prediction tails (dashed extension beyond data)
  const predictionPaths: { path: string; color: string }[] = []
  if (showPrediction) {
    series.forEach((data, si) => {
      const last = data[data.length - 1]
      const secondLast = data[data.length - 2]
      const slope = last - secondLast
      const predPoints = Array.from({ length: 4 }, (_, i) => ({
        x: toX(data.length - 1 + i + 1, data.length + 4),
        y: toY(last + slope * (i + 1) + seededNoise(seed + si * 500, i) * range * 0.04),
      }))
      const predPath = `M${toX(data.length - 1, data.length).toFixed(1)},${toY(last).toFixed(1)} ` +
        predPoints.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      predictionPaths.push({ path: predPath, color: colors[si % colors.length] })
    })
  }

  // Faint grid (minimal)
  const gridLines = [0.25, 0.5, 0.75].map(f => ({
    y: pad.top + h * f,
    x1: pad.left,
    x2: pad.left + w,
  }))

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {/* Faint grid */}
        {gridLines.map((g, i) => (
          <line key={i} x1={g.x1} y1={g.y} x2={g.x2} y2={g.y}
            stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="1 6" />
        ))}
        {/* Variance envelopes */}
        {envelopes.map((env, i) => (
          <path key={`env-${i}`} d={env.upper} fill={env.color} opacity="0.04" />
        ))}
        {/* Ghost lines */}
        {ghostLines.map((gl, i) => (
          <path key={`ghost-${i}`} d={gl.path} fill="none" stroke={gl.color}
            strokeWidth="0.5" opacity={gl.opacity} />
        ))}
        {/* Jitter points */}
        {jitterPoints.map((p, i) => (
          <circle key={`jit-${i}`} cx={p.x} cy={p.y} r={p.r}
            fill={p.color} opacity={p.opacity} />
        ))}
        {/* Prediction tails */}
        {predictionPaths.map((pp, i) => (
          <path key={`pred-${i}`} d={pp.path} fill="none" stroke={pp.color}
            strokeWidth="0.7" strokeDasharray="2 3" opacity="0.2" />
        ))}
        {/* Primary lines */}
        {series.map((data, si) => (
          <path key={`main-${si}`} d={buildPath(data)} fill="none"
            stroke={colors[si % colors.length]} strokeWidth="1" />
        ))}
      </g>
    </svg>
  )
}

// ─── Particle Field Chart ────────────────────────────────────────────────
// Point-cloud distribution: jittered dots forming shape over time
// Represents uncertainty, dispersion, instability

interface ParticleFieldProps {
  data: number[]
  width: number
  height: number
  seed?: number
  color?: string
  particleCount?: number
  showMeanLine?: boolean
  showSecondary?: number[]
}

export function ParticleField({
  data,
  width,
  height,
  seed = 99,
  color = 'rgba(255,255,255,0.5)',
  particleCount = 120,
  showMeanLine = true,
  showSecondary,
}: ParticleFieldProps) {
  const pad = { top: 2, right: -2, bottom: 2, left: -2 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const chartId = `pf-${seed}-${width}`

  const allVals = [...data, ...(showSecondary || [])]
  const min = Math.min(...allVals) - (Math.max(...allVals) - Math.min(...allVals)) * 0.2
  const max = Math.max(...allVals) + (Math.max(...allVals) - Math.min(...allVals)) * 0.2
  const range = max - min || 1

  const toX = (t: number) => pad.left + (t / (data.length - 1)) * w
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h

  // Generate particles: clustered around the data curve with dispersion
  const particles: { x: number; y: number; r: number; opacity: number }[] = []
  for (let p = 0; p < particleCount; p++) {
    const t = seededUnit(seed + p, p * 7) * (data.length - 1)
    const floorT = Math.floor(t)
    const ceilT = Math.min(floorT + 1, data.length - 1)
    const frac = t - floorT
    const baseVal = data[floorT] * (1 - frac) + data[ceilT] * frac
    const dispersion = seededNoise(seed + p * 3, p * 11) * range * 0.15
    const xJit = seededNoise(seed + p * 5, p) * w * 0.015

    particles.push({
      x: toX(t) + xJit,
      y: toY(baseVal + dispersion),
      r: 0.5 + seededUnit(seed + p * 2, p) * 1.2,
      opacity: 0.06 + seededUnit(seed + p * 4, p) * 0.2,
    })
  }

  // Mean line path
  const meanPath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  // Secondary ghost signal
  const secondaryPath = showSecondary
    ? showSecondary.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
    : null

  // Rolling variance band
  const varianceBand = data.map((v, i) => {
    const localSpread = Math.abs(seededNoise(seed + 800 + i, i * 5)) * range * 0.08 + range * 0.03
    return { upper: toY(v + localSpread), lower: toY(v - localSpread), x: toX(i) }
  })
  const bandPath = varianceBand.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.upper.toFixed(1)}`).join(' ')
    + ' ' + [...varianceBand].reverse().map((p, i) => `${i === 0 ? 'L' : 'L'}${p.x.toFixed(1)},${p.lower.toFixed(1)}`).join(' ') + ' Z'

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {/* Faint grid */}
        {[0.33, 0.66].map(f => (
          <line key={f} x1={pad.left} y1={pad.top + h * f} x2={pad.left + w} y2={pad.top + h * f}
            stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="1 8" />
        ))}
        {/* Variance band */}
        <path d={bandPath} fill={color} opacity="0.04" />
        {/* Particles */}
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.opacity} />
        ))}
        {/* Secondary signal */}
        {secondaryPath && (
          <path d={secondaryPath} fill="none" stroke={color} strokeWidth="0.5" opacity="0.15" strokeDasharray="3 4" />
        )}
        {/* Mean line */}
        {showMeanLine && (
          <path d={meanPath} fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
        )}
      </g>
    </svg>
  )
}

// ─── Signal Area Chart ───────────────────────────────────────────────────
// Area with multiple layered fills, noise underlayer, edge-fade

interface SignalAreaChartProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  showNoise?: boolean
}

export function SignalAreaChart({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.5)',
  seed = 77,
  showNoise = true,
}: SignalAreaChartProps) {
  const pad = { top: 2, right: -2, bottom: 2, left: -2 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const chartId = `sac-${seed}-${width}`

  const min = Math.min(...data) - (Math.max(...data) - Math.min(...data)) * 0.1
  const max = Math.max(...data) + (Math.max(...data) - Math.min(...data)) * 0.1
  const range = max - min || 1

  const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * w
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h

  const mainPath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const areaPath = `${mainPath} L${toX(data.length - 1, data.length).toFixed(1)},${(pad.top + h).toFixed(1)} L${toX(0, data.length).toFixed(1)},${(pad.top + h).toFixed(1)} Z`

  // Ghost variant
  const ghostData = data.map((v, i) => v + seededNoise(seed + 50, i) * range * 0.08)
  const ghostPath = ghostData.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const ghostArea = `${ghostPath} L${toX(data.length - 1, data.length).toFixed(1)},${(pad.top + h).toFixed(1)} L${toX(0, data.length).toFixed(1)},${(pad.top + h).toFixed(1)} Z`

  // Noise underlayer points
  const noisePoints: { x: number; y: number; r: number; opacity: number }[] = []
  if (showNoise) {
    for (let n = 0; n < 60; n++) {
      const t = seededUnit(seed + n, n * 3) * (data.length - 1)
      const floor = Math.floor(t)
      const ceil = Math.min(floor + 1, data.length - 1)
      const frac = t - floor
      const baseV = data[floor] * (1 - frac) + data[ceil] * frac
      // Only below the curve
      const below = seededUnit(seed + n * 5, n) * (baseV - min) * 0.6
      noisePoints.push({
        x: toX(t, data.length),
        y: toY(min + below + seededNoise(seed + n * 7, n) * range * 0.05),
        r: 0.4 + seededUnit(seed + n * 2, n) * 0.6,
        opacity: 0.05 + seededUnit(seed + n * 4, n) * 0.1,
      })
    }
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {/* Ghost area */}
        <path d={ghostArea} fill={color} opacity="0.03" />
        {/* Main area */}
        <path d={areaPath} fill={color} opacity="0.06" />
        {/* Noise particles */}
        {noisePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.opacity} />
        ))}
        {/* Ghost line */}
        <path d={ghostPath} fill="none" stroke={color} strokeWidth="0.5" opacity="0.12" />
        {/* Primary line */}
        <path d={mainPath} fill="none" stroke={color} strokeWidth="0.8" />
      </g>
    </svg>
  )
}

// ─── Signal Dot Timeline ─────────────────────────────────────────────────
// Dots with ghost rings, variance scatter, faded edges

interface SignalDotTimelineProps {
  events: { year: number; severity: number }[]
  width: number
  height: number
  seed?: number
  yearRange?: [number, number]
}

export function SignalDotTimeline({
  events,
  width,
  height,
  seed = 55,
  yearRange = [2013, 2024],
}: SignalDotTimelineProps) {
  const pad = { top: 4, right: -2, bottom: 4, left: -2 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const span = yearRange[1] - yearRange[0]
  const chartId = `sdt-${seed}-${width}`

  const toX = (year: number) => pad.left + ((year - yearRange[0]) / span) * w
  const midY = pad.top + h / 2

  // Background scatter — ambient noise
  const ambientDots: { x: number; y: number; r: number; opacity: number }[] = []
  for (let a = 0; a < 40; a++) {
    ambientDots.push({
      x: pad.left + seededUnit(seed + a, a * 3) * w,
      y: midY + seededNoise(seed + a * 2, a * 7) * h * 0.4,
      r: 0.3 + seededUnit(seed + a, a) * 0.4,
      opacity: 0.04 + seededUnit(seed + a * 5, a) * 0.06,
    })
  }

  // Connecting signal between events
  const sortedEvents = [...events].sort((a, b) => a.year - b.year)
  const signalPath = sortedEvents.length > 1
    ? sortedEvents.map((ev, i) => {
        const x = toX(ev.year)
        const y = midY + seededNoise(seed + 300 + i, i * 5) * h * 0.15
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
    : ''

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {/* Baseline */}
        <line x1={pad.left} y1={midY} x2={pad.left + w} y2={midY}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        {/* Ambient noise */}
        {ambientDots.map((d, i) => (
          <circle key={`amb-${i}`} cx={d.x} cy={d.y} r={d.r} fill="rgba(255,255,255,0.4)" opacity={d.opacity} />
        ))}
        {/* Signal path */}
        {signalPath && (
          <path d={signalPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        )}
        {/* Event dots with ghost rings */}
        {events.map((ev, i) => {
          const x = toX(ev.year)
          const r = 1.5 + ev.severity * 3
          const evColor = ev.severity > 0.7 ? 'rgba(255,160,50,0.75)' :
                          ev.severity > 0.4 ? 'rgba(255,255,255,0.45)' :
                          'rgba(255,255,255,0.2)'
          // Scatter around each event
          const scatter: { x: number; y: number; r: number; o: number }[] = []
          const scatterCount = 3 + Math.floor(ev.severity * 5)
          for (let s = 0; s < scatterCount; s++) {
            scatter.push({
              x: x + seededNoise(seed + i * 50 + s, s * 3) * 8,
              y: midY + seededNoise(seed + i * 50 + s * 2, s) * h * 0.35,
              r: 0.4 + seededUnit(seed + i * 50 + s, s) * 0.6,
              o: 0.08 + ev.severity * 0.12,
            })
          }
          return (
            <g key={i}>
              {/* Ghost ring */}
              <circle cx={x} cy={midY} r={r * 2.2} fill="none"
                stroke={evColor} strokeWidth="0.3" opacity="0.12" />
              {/* Scatter */}
              {scatter.map((sc, si) => (
                <circle key={si} cx={sc.x} cy={sc.y} r={sc.r} fill={evColor} opacity={sc.o} />
              ))}
              {/* Core dot */}
              <circle cx={x} cy={midY} r={r} fill={evColor}
                stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ─── Signal Histogram ────────────────────────────────────────────────────
// Distribution with noise particles, overlapping curves, edge-fade

interface SignalHistogramProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  secondaryData?: number[]
}

export function SignalHistogram({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.4)',
  seed = 33,
  secondaryData,
}: SignalHistogramProps) {
  const pad = { top: 2, right: -2, bottom: 2, left: -2 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const chartId = `sh-${seed}-${width}`

  const allData = [...data, ...(secondaryData || [])]
  const max = Math.max(...allData)

  const buildCurvePath = (d: number[], filled: boolean) => {
    const points = d.map((v, i) => ({
      x: pad.left + (i / (d.length - 1)) * w,
      y: pad.top + h - (v / (max || 1)) * h,
    }))
    let path = points.reduce((acc, p, i) => {
      if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`
      const prev = points[i - 1]
      const cx = (prev.x + p.x) / 2
      return acc + ` Q${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${((prev.y + p.y) / 2).toFixed(1)}`
    }, '') + ` L${points[points.length - 1].x.toFixed(1)},${points[points.length - 1].y.toFixed(1)}`

    if (filled) {
      path = `M${points[0].x.toFixed(1)},${(pad.top + h).toFixed(1)} L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} `
        + path.slice(path.indexOf('Q'))
        + ` L${points[points.length - 1].x.toFixed(1)},${(pad.top + h).toFixed(1)} Z`
    }
    return path
  }

  // Noise particles under curve
  const noiseParticles: { x: number; y: number; r: number; opacity: number }[] = []
  for (let n = 0; n < 50; n++) {
    const t = seededUnit(seed + n, n * 3) * (data.length - 1)
    const floor = Math.floor(t)
    const ceil = Math.min(floor + 1, data.length - 1)
    const frac = t - floor
    const baseH = (data[floor] * (1 - frac) + data[ceil] * frac) / (max || 1) * h
    const yPos = pad.top + h - seededUnit(seed + n * 5, n) * baseH
    noiseParticles.push({
      x: pad.left + (t / (data.length - 1)) * w + seededNoise(seed + n * 7, n) * 3,
      y: yPos,
      r: 0.3 + seededUnit(seed + n * 2, n) * 0.7,
      opacity: 0.06 + seededUnit(seed + n * 4, n) * 0.12,
    })
  }

  // Ghost variant
  const ghostData = data.map((v, i) => Math.max(0, v + seededNoise(seed + 100 + i, i) * max * 0.15))

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {/* Ghost fill */}
        <path d={buildCurvePath(ghostData, true)} fill={color} opacity="0.03" />
        {/* Main fill */}
        <path d={buildCurvePath(data, true)} fill={color} opacity="0.06" />
        {/* Secondary curve */}
        {secondaryData && (
          <>
            <path d={buildCurvePath(secondaryData, true)} fill={color} opacity="0.03" />
            <path d={buildCurvePath(secondaryData, false)} fill="none" stroke={color}
              strokeWidth="0.5" opacity="0.2" strokeDasharray="2 3" />
          </>
        )}
        {/* Noise particles */}
        {noiseParticles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.opacity} />
        ))}
        {/* Ghost stroke */}
        <path d={buildCurvePath(ghostData, false)} fill="none" stroke={color} strokeWidth="0.4" opacity="0.1" />
        {/* Primary stroke */}
        <path d={buildCurvePath(data, false)} fill="none" stroke={color} strokeWidth="0.8" />
      </g>
    </svg>
  )
}

// ─── Signal Sparkline ────────────────────────────────────────────────────
// Sparkline with ghost trail, jitter, variance hint

interface SignalSparklineProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  alert?: boolean
}

export function SignalSparkline({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.35)',
  seed = 11,
  alert = false,
}: SignalSparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const toX = (i: number) => (i / (data.length - 1)) * width
  const toY = (v: number) => height * 0.1 + (height * 0.8) - ((v - min) / range) * (height * 0.8)

  const mainPath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  // Ghost trail
  const ghostData = data.map((v, i) => v + seededNoise(seed + 10, i) * range * 0.12)
  const ghostPath = ghostData.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  // Jitter dots
  const jots: { x: number; y: number; r: number }[] = []
  for (let j = 0; j < 6; j++) {
    const t = seededUnit(seed + j, j * 3) * (data.length - 1)
    const fl = Math.floor(t)
    const cl = Math.min(fl + 1, data.length - 1)
    const fr = t - fl
    const bv = data[fl] * (1 - fr) + data[cl] * fr
    jots.push({
      x: toX(t),
      y: toY(bv + seededNoise(seed + j * 5, j) * range * 0.1),
      r: 0.4 + seededUnit(seed + j, j) * 0.4,
    })
  }

  const effectiveColor = alert ? 'rgba(255,180,60,0.5)' : color

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      {/* Ghost */}
      <path d={ghostPath} fill="none" stroke={effectiveColor} strokeWidth="0.4" opacity="0.2" />
      {/* Jitter */}
      {jots.map((j, i) => (
        <circle key={i} cx={j.x} cy={j.y} r={j.r} fill={effectiveColor} opacity="0.2" />
      ))}
      {/* Main */}
      <path d={mainPath} fill="none" stroke={effectiveColor} strokeWidth="0.8" />
      {/* Terminal dot */}
      <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r="1.2" fill={effectiveColor} />
    </svg>
  )
}

// ─── Stat With Signal Sparkline ──────────────────────────────────────────

interface StatWithSparklineProps {
  label: string
  value: string
  unit?: string
  sparkData?: number[]
  sparkColor?: string
  alert?: boolean
  seed?: number
}

export function StatWithSparkline({
  label,
  value,
  unit,
  sparkData,
  sparkColor = 'rgba(255,255,255,0.35)',
  alert = false,
  seed = 0,
}: StatWithSparklineProps) {
  return (
    <div className="fdp-stat">
      <div className="fdp-stat-label">{label}</div>
      <div className="fdp-stat-row">
        <span className="fdp-stat-value"
          style={alert ? { color: 'rgba(255,180,60,0.9)' } : undefined}>
          {value}
          {unit && <span className="fdp-stat-unit">{unit}</span>}
        </span>
        {sparkData && sparkData.length > 1 && (
          <SignalSparkline data={sparkData} width={52} height={18}
            color={sparkColor} alert={alert} seed={seed} />
        )}
      </div>
    </div>
  )
}

// ─── Trend Indicator ─────────────────────────────────────────────────────

export function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'worsening' }) {
  const symbol = trend === 'improving' ? '\u2191' :
    trend === 'declining' || trend === 'worsening' ? '\u2193' : '\u2192'
  const color = trend === 'improving' ? 'rgba(120,220,120,0.5)' :
    trend === 'declining' || trend === 'worsening' ? 'rgba(255,160,60,0.5)' :
    'rgba(255,255,255,0.25)'
  return <span className="fdp-trend" style={{ color }}>{symbol}</span>
}

// ─── Noise Band (horizontal micro-chart) ─────────────────────────────────
// Ultra-dense micro-visualization: a thin strip of signal noise

interface NoiseBandProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
}

export function NoiseBand({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.3)',
  seed = 22,
}: NoiseBandProps) {
  const mid = height / 2
  const chartId = `nb-${seed}-${width}`

  // Dense vertical lines representing signal amplitude
  const bars: { x: number; y1: number; y2: number; opacity: number }[] = []
  const step = width / (data.length - 1)
  const max = Math.max(...data)

  for (let i = 0; i < data.length; i++) {
    const amplitude = (data[i] / (max || 1)) * height * 0.4
    const jit = seededNoise(seed + i, i) * height * 0.05
    bars.push({
      x: i * step,
      y1: mid - amplitude / 2 + jit,
      y2: mid + amplitude / 2 + jit,
      opacity: 0.15 + (data[i] / (max || 1)) * 0.25,
    })
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <EdgeFadeDefs id={chartId} direction="horizontal" />
      <g mask={`url(#${chartId}-mask)`}>
        {bars.map((b, i) => (
          <line key={i} x1={b.x} y1={b.y1} x2={b.x} y2={b.y2}
            stroke={color} strokeWidth="1" opacity={b.opacity} />
        ))}
      </g>
    </svg>
  )
}
