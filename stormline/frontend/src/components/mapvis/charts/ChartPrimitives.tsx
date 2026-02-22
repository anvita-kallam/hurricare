/**
 * TELEMETRY FIELD RENDERERS
 *
 * These are NOT charts. There are no line charts, area charts, or histograms.
 * Every renderer produces a FIELD of particles where:
 * - Signal is implied through density, not lines
 * - Lines only exist as faint broken guides, never primary
 * - No visible axes, no visible start/end
 * - Data fades in/out via gradient masks
 * - Multiple overlapping signals with no legend
 * - Uncertainty = dispersion. Instability = spread.
 *
 * If a panel could be described as "a line graph," it is wrong.
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
        <stop offset="6%" stopColor="white" stopOpacity="0.6" />
        <stop offset="14%" stopColor="white" stopOpacity="1" />
        <stop offset="82%" stopColor="white" stopOpacity="1" />
        <stop offset="92%" stopColor="white" stopOpacity="0.6" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-m`}>
        <rect width="100%" height="100%" fill={`url(#${id}-f)`} />
      </mask>
    </defs>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// DENSITY FIELD
// Primary telemetry renderer. Hundreds of particles forming implied curves.
// The shape of data is communicated through particle concentration.
// No explicit lines. Signal through clustering.
// ═══════════════════════════════════════════════════════════════════════

interface DensityFieldProps {
  signals: number[][]       // multiple overlapping data series
  width: number
  height: number
  seed?: number
  colors?: string[]
  particlesPerSignal?: number
  dispersion?: number       // 0-1, how scattered (uncertainty)
  showGuide?: boolean       // faint broken guide trace
}

export function DensityField({
  signals,
  width,
  height,
  seed = 42,
  colors = ['rgba(255,255,255,0.5)', 'rgba(255,180,60,0.4)', 'rgba(255,255,255,0.25)'],
  particlesPerSignal = 200,
  dispersion = 0.15,
  showGuide = false,
}: DensityFieldProps) {
  const id = `df-${seed}`
  const allVals = signals.flat()
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.2
  const max = rawMax + span * 0.2
  const range = max - min

  const toX = (t: number, len: number) => (t / (len - 1)) * width
  const toY = (v: number) => height - ((v - min) / range) * height

  const particles: { x: number; y: number; r: number; o: number; c: string }[] = []

  signals.forEach((data, si) => {
    const color = colors[si % colors.length]
    const count = Math.round(particlesPerSignal * (si === 0 ? 1 : 0.6))
    const sigDisp = dispersion * (1 + si * 0.3)

    for (let p = 0; p < count; p++) {
      const t = su(seed + si * 1000 + p, p * 7) * (data.length - 1 + 4) - 2
      const clampT = Math.max(0, Math.min(data.length - 1, t))
      const fl = Math.floor(clampT)
      const cl = Math.min(fl + 1, data.length - 1)
      const fr = clampT - fl
      const baseVal = data[fl] * (1 - fr) + data[cl] * fr

      const yDisp = sn(seed + si * 2000 + p * 3, p * 11) * range * sigDisp
      const xJit = sn(seed + si * 3000 + p * 5, p) * width * 0.012

      const distFromCenter = Math.abs(yDisp) / (range * sigDisp + 0.001)
      const densityOp = Math.max(0.02, 0.22 - distFromCenter * 0.18)

      particles.push({
        x: toX(t, data.length) + xJit,
        y: toY(baseVal + yDisp),
        r: 0.3 + su(seed + p * 2, p) * 1.0,
        o: densityOp * (si === 0 ? 1 : 0.7),
        c: color,
      })
    }
  })

  // Faint broken guide fragments (not continuous)
  const guideFragments: string[] = []
  if (showGuide && signals[0]) {
    const data = signals[0]
    const fragLen = Math.floor(data.length / 3)
    for (let f = 0; f < 2; f++) {
      const start = Math.floor(su(seed + 900, f) * fragLen) + f * fragLen
      const end = Math.min(start + fragLen - 1, data.length - 1)
      let frag = ''
      for (let i = start; i <= end; i++) {
        frag += `${i === start ? 'M' : 'L'}${toX(i, data.length).toFixed(1)},${toY(data[i]).toFixed(1)} `
      }
      guideFragments.push(frag)
    }
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {guideFragments.map((frag, i) => (
          <path key={`g${i}`} d={frag} fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5" strokeDasharray="2 6" />
        ))}
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// DISPERSION FIELD
// Dense particle cloud with varying spread representing uncertainty.
// Wider spread = more uncertainty. Tighter cluster = stable signal.
// Uses multiple "layers" of particles at different spreads.
// ═══════════════════════════════════════════════════════════════════════

interface DispersionFieldProps {
  data: number[]
  width: number
  height: number
  seed?: number
  color?: string
  count?: number
  layers?: number
  secondaryData?: number[]
}

export function DispersionField({
  data,
  width,
  height,
  seed = 77,
  color = 'rgba(255,255,255,0.45)',
  count = 280,
  layers = 3,
  secondaryData,
}: DispersionFieldProps) {
  const id = `dpf-${seed}`
  const allVals = [...data, ...(secondaryData || [])]
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.25
  const max = rawMax + span * 0.25
  const range = max - min

  const toX = (t: number) => (t / (data.length - 1 + 3)) * width
  const toY = (v: number) => height - ((v - min) / range) * height

  const particles: { x: number; y: number; r: number; o: number }[] = []

  for (let layer = 0; layer < layers; layer++) {
    const layerSpread = 0.06 + layer * 0.08
    const layerOp = 0.18 - layer * 0.04
    const layerCount = Math.round(count / layers)

    for (let p = 0; p < layerCount; p++) {
      const t = su(seed + layer * 500 + p, p * 7) * (data.length + 2) - 1
      const clampT = Math.max(0, Math.min(data.length - 1, t))
      const fl = Math.floor(clampT)
      const cl = Math.min(fl + 1, data.length - 1)
      const fr = clampT - fl
      const baseVal = data[fl] * (1 - fr) + data[cl] * fr

      const yD = sn(seed + layer * 1000 + p * 3, p * 11) * range * layerSpread
      const xJ = sn(seed + layer * 1500 + p * 5, p) * width * 0.01

      particles.push({
        x: toX(t) + xJ,
        y: toY(baseVal + yD),
        r: 0.3 + su(seed + layer * 2000 + p, p) * (0.6 + layer * 0.3),
        o: Math.max(0.02, layerOp * (1 - Math.abs(yD) / (range * layerSpread + 0.01) * 0.5)),
      })
    }
  }

  // Secondary signal particles (different density band)
  if (secondaryData) {
    for (let p = 0; p < Math.round(count * 0.3); p++) {
      const t = su(seed + 8000 + p, p * 7) * (secondaryData.length + 1) - 0.5
      const clampT = Math.max(0, Math.min(secondaryData.length - 1, t))
      const fl = Math.floor(clampT)
      const cl = Math.min(fl + 1, secondaryData.length - 1)
      const fr = clampT - fl
      const baseVal = secondaryData[fl] * (1 - fr) + secondaryData[cl] * fr
      const yD = sn(seed + 9000 + p * 3, p * 11) * range * 0.1

      particles.push({
        x: toX(t),
        y: toY(baseVal + yD),
        r: 0.2 + su(seed + 9500 + p, p) * 0.5,
        o: 0.06 + su(seed + 9600 + p, p) * 0.06,
      })
    }
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// EVENT SCATTER
// Instead of dots on a timeline: an entire field of scattered evidence.
// Events are areas of higher density. Background is ambient particle noise.
// ═══════════════════════════════════════════════════════════════════════

interface EventScatterProps {
  events: { year: number; severity: number }[]
  width: number
  height: number
  seed?: number
  yearRange?: [number, number]
}

export function EventScatter({
  events,
  width,
  height,
  seed = 55,
  yearRange = [2011, 2026],
}: EventScatterProps) {
  const id = `es-${seed}`
  const span = yearRange[1] - yearRange[0]
  const toX = (year: number) => ((year - yearRange[0]) / span) * width

  const particles: { x: number; y: number; r: number; o: number; c: string }[] = []

  // Ambient background noise across entire field
  for (let a = 0; a < 80; a++) {
    particles.push({
      x: su(seed + a, a * 3) * width,
      y: su(seed + a * 2, a * 7) * height,
      r: 0.2 + su(seed + a, a) * 0.3,
      o: 0.02 + su(seed + a * 5, a) * 0.03,
      c: 'rgba(255,255,255,0.4)',
    })
  }

  // Event clusters: each event generates a burst of particles
  events.forEach((ev, ei) => {
    const cx = toX(ev.year)
    const burstCount = 12 + Math.floor(ev.severity * 25)
    const evColor = ev.severity > 0.7 ? 'rgba(255,160,50,0.6)' :
                    ev.severity > 0.4 ? 'rgba(255,255,255,0.4)' :
                    'rgba(255,255,255,0.25)'

    for (let p = 0; p < burstCount; p++) {
      const angle = su(seed + ei * 100 + p, p * 3) * Math.PI * 2
      const dist = su(seed + ei * 200 + p, p * 7) * (12 + ev.severity * 18)
      const falloff = 1 - (dist / (30 + ev.severity * 18))

      particles.push({
        x: cx + Math.cos(angle) * dist + sn(seed + ei * 300 + p, p) * 3,
        y: height / 2 + Math.sin(angle) * dist * 0.6 + sn(seed + ei * 400 + p, p) * height * 0.15,
        r: 0.3 + su(seed + ei * 500 + p, p) * (1.0 + ev.severity * 1.2),
        o: Math.max(0.03, falloff * (0.15 + ev.severity * 0.2)),
        c: evColor,
      })
    }
  })

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// DENSITY DISTRIBUTION
// Instead of a histogram curve: particle density that implies distribution shape.
// More particles = higher value. Vertical stacking implies magnitude.
// ═══════════════════════════════════════════════════════════════════════

interface DensityDistributionProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  secondaryData?: number[]
  count?: number
}

export function DensityDistribution({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.4)',
  seed = 33,
  secondaryData,
  count = 200,
}: DensityDistributionProps) {
  const id = `dd-${seed}`
  const max = Math.max(...data, ...(secondaryData || [0]))

  const particles: { x: number; y: number; r: number; o: number; c: string }[] = []

  // Primary distribution: particles stacked proportional to data values
  for (let p = 0; p < count; p++) {
    const bin = su(seed + p, p * 7) * (data.length + 2) - 1
    const clampBin = Math.max(0, Math.min(data.length - 1, bin))
    const fl = Math.floor(clampBin)
    const cl = Math.min(fl + 1, data.length - 1)
    const fr = clampBin - fl
    const binVal = (data[fl] * (1 - fr) + data[cl] * fr) / (max || 1)

    // Only place particle if random value is below binVal (acceptance sampling)
    if (su(seed + p * 3, p) < binVal * 0.9 + 0.1) {
      const x = (bin / (data.length + 1)) * width
      const yBase = height - su(seed + p * 5, p) * height * binVal * 0.85
      const xJ = sn(seed + p * 7, p) * 4
      const yJ = sn(seed + p * 9, p) * 3

      particles.push({
        x: x + xJ,
        y: yBase + yJ,
        r: 0.3 + su(seed + p * 2, p) * 0.8,
        o: 0.06 + binVal * 0.16,
        c: color,
      })
    }
  }

  // Secondary distribution (shifted, lower opacity)
  if (secondaryData) {
    for (let p = 0; p < Math.round(count * 0.5); p++) {
      const bin = su(seed + 5000 + p, p * 7) * (secondaryData.length + 1) - 0.5
      const clampBin = Math.max(0, Math.min(secondaryData.length - 1, bin))
      const fl = Math.floor(clampBin)
      const cl = Math.min(fl + 1, secondaryData.length - 1)
      const fr = clampBin - fl
      const binVal = (secondaryData[fl] * (1 - fr) + secondaryData[cl] * fr) / (max || 1)

      if (su(seed + 5000 + p * 3, p) < binVal * 0.8 + 0.1) {
        particles.push({
          x: (bin / (secondaryData.length + 1)) * width + sn(seed + 5000 + p * 7, p) * 4,
          y: height - su(seed + 5000 + p * 5, p) * height * binVal * 0.75 + sn(seed + 5000 + p * 9, p) * 3,
          r: 0.2 + su(seed + 5000 + p * 2, p) * 0.6,
          o: 0.04 + binVal * 0.08,
          c: color,
        })
      }
    }
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL DUST
// Ultra-fine particle texture. Background noise representing baseline signal.
// Amplitude-modulated: particle vertical extent varies with data.
// ═══════════════════════════════════════════════════════════════════════

interface SignalDustProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  count?: number
}

export function SignalDust({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.3)',
  seed = 22,
  count = 150,
}: SignalDustProps) {
  const id = `sd-${seed}`
  const max = Math.max(...data)
  const mid = height / 2

  const particles: { x: number; y: number; r: number; o: number }[] = []

  for (let p = 0; p < count; p++) {
    const t = su(seed + p, p * 3) * (data.length + 3) - 1.5
    const clampT = Math.max(0, Math.min(data.length - 1, t))
    const fl = Math.floor(clampT)
    const cl = Math.min(fl + 1, data.length - 1)
    const fr = clampT - fl
    const val = (data[fl] * (1 - fr) + data[cl] * fr) / (max || 1)

    const amplitude = val * height * 0.4
    const yOff = sn(seed + p * 5, p) * amplitude

    particles.push({
      x: (t / (data.length + 2)) * width,
      y: mid + yOff + sn(seed + p * 7, p) * 2,
      r: 0.2 + su(seed + p * 2, p) * 0.5,
      o: 0.05 + val * 0.15,
    })
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STRATIFIED FIELD
// Multiple overlapping particle bands at different vertical positions.
// Each band is a different metric. They overlap and interfere.
// No axes. No labels. Just layered density.
// ═══════════════════════════════════════════════════════════════════════

interface StratifiedFieldProps {
  bands: { data: number[]; color: string; yOffset: number }[]
  width: number
  height: number
  seed?: number
  countPerBand?: number
}

export function StratifiedField({
  bands,
  width,
  height,
  seed = 88,
  countPerBand = 100,
}: StratifiedFieldProps) {
  const id = `sf-${seed}`
  const particles: { x: number; y: number; r: number; o: number; c: string }[] = []

  bands.forEach((band, bi) => {
    const max = Math.max(...band.data)
    for (let p = 0; p < countPerBand; p++) {
      const t = su(seed + bi * 1000 + p, p * 7) * (band.data.length + 2) - 1
      const clampT = Math.max(0, Math.min(band.data.length - 1, t))
      const fl = Math.floor(clampT)
      const cl = Math.min(fl + 1, band.data.length - 1)
      const fr = clampT - fl
      const val = (band.data[fl] * (1 - fr) + band.data[cl] * fr) / (max || 1)

      const baseY = height * band.yOffset
      const yDisp = sn(seed + bi * 2000 + p * 3, p * 11) * height * 0.08 * (1 + val * 0.5)

      particles.push({
        x: (t / (band.data.length + 1)) * width + sn(seed + bi * 3000 + p * 5, p) * 3,
        y: baseY + yDisp,
        r: 0.2 + su(seed + bi * 4000 + p, p) * 0.7,
        o: 0.04 + val * 0.14,
        c: band.color,
      })
    }
  })

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      <FadeMask id={id} />
      <g mask={`url(#${id}-m)`}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MICRO FIELD (for sparkline replacement)
// Tiny particle cluster inline with stats. Not a line. A field.
// ═══════════════════════════════════════════════════════════════════════

interface MicroFieldProps {
  data: number[]
  width: number
  height: number
  color?: string
  seed?: number
  alert?: boolean
}

export function MicroField({
  data,
  width,
  height,
  color = 'rgba(255,255,255,0.3)',
  seed = 11,
  alert = false,
}: MicroFieldProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const effectiveColor = alert ? 'rgba(255,180,60,0.45)' : color

  const particles: { x: number; y: number; r: number; o: number }[] = []
  const count = 24

  for (let p = 0; p < count; p++) {
    const t = su(seed + p, p * 3) * (data.length - 1 + 2) - 1
    const clampT = Math.max(0, Math.min(data.length - 1, t))
    const fl = Math.floor(clampT)
    const cl = Math.min(fl + 1, data.length - 1)
    const fr = clampT - fl
    const val = data[fl] * (1 - fr) + data[cl] * fr

    const y = height * 0.15 + (height * 0.7) - ((val - min) / range) * (height * 0.7)
    const yJ = sn(seed + p * 5, p) * height * 0.12

    particles.push({
      x: (t / (data.length + 1)) * width + sn(seed + p * 7, p) * 2,
      y: y + yJ,
      r: 0.3 + su(seed + p * 2, p) * 0.5,
      o: 0.1 + su(seed + p * 4, p) * 0.2,
    })
  }

  return (
    <svg width={width} height={height} className="block" overflow="hidden">
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r}
          fill={effectiveColor} opacity={p.o} />
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STAT WITH MICRO FIELD
// ═══════════════════════════════════════════════════════════════════════

interface StatWithFieldProps {
  label: string
  value: string
  unit?: string
  fieldData?: number[]
  alert?: boolean
  seed?: number
}

export function StatWithField({
  label,
  value,
  unit,
  fieldData,
  alert = false,
  seed = 0,
}: StatWithFieldProps) {
  return (
    <div className="fdp-stat">
      <div className="fdp-stat-label">{label}</div>
      <div className="fdp-stat-row">
        <span className="fdp-stat-value"
          style={alert ? { color: 'rgba(255,180,60,0.85)' } : undefined}>
          {value}
          {unit && <span className="fdp-stat-unit">{unit}</span>}
        </span>
        {fieldData && fieldData.length > 1 && (
          <MicroField data={fieldData} width={52} height={18}
            alert={alert} seed={seed} />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TREND (minimal)
// ═══════════════════════════════════════════════════════════════════════

export function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'worsening' }) {
  const symbol = trend === 'improving' ? '\u2191' :
    trend === 'declining' || trend === 'worsening' ? '\u2193' : '\u2014'
  const color = trend === 'improving' ? 'rgba(120,220,120,0.4)' :
    trend === 'declining' || trend === 'worsening' ? 'rgba(255,160,60,0.4)' :
    'rgba(255,255,255,0.15)'
  return <span className="fdp-trend" style={{ color }}>{symbol}</span>
}
