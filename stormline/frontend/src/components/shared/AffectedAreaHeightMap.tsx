/**
 * AffectedAreaHeightMap — Shared 2.5D isometric visualization
 *
 * Renders region tiles with:
 *   - Height = severity (taller = more severe)
 *   - Overlay bars = allocation / coverage / delta (context-dependent)
 *   - Optional highlight for active region
 *   - FDP-style coloring with gradients, glow, depth
 *
 * Used across Steps 1-5 to make the experience feel interactive and game-like.
 */

import { useRef, useEffect } from 'react'

export interface HeightMapRegion {
  region: string
  severity: number       // 0-1
  /** Primary metric shown as overlay bar (0-1 normalized) */
  metric?: number
  /** Optional secondary metric for comparison */
  metricB?: number
  /** Budget or value label under region */
  valueLabel?: string
}

interface AffectedAreaHeightMapProps {
  data: HeightMapRegion[]
  activeIndex?: number
  width?: number
  height?: number
  /** Color theme: 'severity' | 'coverage' | 'delta' */
  theme?: 'severity' | 'coverage' | 'delta'
  /** Show animated pulse on active tile */
  animated?: boolean
}

const THEME_COLORS = {
  severity: {
    high: [200, 200, 200],
    mid: [140, 140, 140],
    low: [80, 80, 80],
    accent: [180, 180, 180],
  },
  coverage: {
    high: [180, 180, 180],
    mid: [130, 130, 130],
    low: [90, 90, 90],
    accent: [150, 150, 150],
  },
  delta: {
    high: [190, 190, 190],
    mid: [150, 150, 150],
    low: [100, 100, 100],
    accent: [170, 170, 170],
  },
}

export default function AffectedAreaHeightMap({
  data,
  activeIndex = -1,
  width = 520,
  height = 220,
  theme = 'severity',
  animated = false,
}: AffectedAreaHeightMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.clearRect(0, 0, width, height)
    if (data.length === 0) return

    const colors = THEME_COLORS[theme]
    const cols = data.length
    const tileW = Math.min(72, (width - 50) / cols)
    const tileD = tileW * 0.4
    const maxHeight = height * 0.42
    const startX = (width - cols * tileW) / 2
    const baseY = height * 0.78

    // Ground shadow
    const groundGrad = ctx.createLinearGradient(startX, baseY, startX, baseY + 10)
    groundGrad.addColorStop(0, 'rgba(255,255,255,0.02)')
    groundGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = groundGrad
    ctx.fillRect(startX - 10, baseY, cols * tileW + 20, 10)

    // Draw ground grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= cols; i++) {
      const gx = startX + i * tileW
      ctx.beginPath()
      ctx.moveTo(gx, baseY)
      ctx.lineTo(gx + tileD * 0.5, baseY - tileD)
      ctx.stroke()
    }

    // Draw tiles
    data.forEach((d, i) => {
      const x = startX + i * tileW
      const sevHeight = Math.max(10, d.severity * maxHeight)
      const isActive = i === activeIndex
      const perspOff = tileD * 0.4

      // Color based on severity
      const [r, g, b] = d.severity > 0.7
        ? colors.high
        : d.severity > 0.4
          ? colors.mid
          : colors.low
      const activeBoost = isActive ? 1.3 : 1.0
      const baseSevAlpha = isActive ? 0.85 : 0.55

      const tileLeft = x + 2
      const tileRight = tileLeft + tileW - 4
      const tileMid = (tileLeft + tileRight) / 2

      // Right face (darker)
      ctx.beginPath()
      ctx.moveTo(tileRight, baseY)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight, baseY - sevHeight)
      ctx.closePath()
      ctx.fillStyle = `rgba(${Math.floor(r * 0.45)},${Math.floor(g * 0.45)},${Math.floor(b * 0.45)},${baseSevAlpha * 0.7})`
      ctx.fill()

      // Front face — gradient
      const frontGrad = ctx.createLinearGradient(tileLeft, baseY, tileLeft, baseY - sevHeight)
      frontGrad.addColorStop(0, `rgba(${r},${g},${b},${baseSevAlpha * 0.25})`)
      frontGrad.addColorStop(0.4, `rgba(${r},${g},${b},${baseSevAlpha * 0.6})`)
      frontGrad.addColorStop(1, `rgba(${r},${g},${b},${baseSevAlpha})`)
      ctx.fillStyle = frontGrad
      ctx.fillRect(tileLeft, baseY - sevHeight, tileRight - tileLeft, sevHeight)

      // Front face subtle inner glow
      if (isActive) {
        const glowGrad = ctx.createLinearGradient(tileLeft, baseY - sevHeight, tileRight, baseY - sevHeight)
        glowGrad.addColorStop(0, 'rgba(255,255,255,0)')
        glowGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)')
        glowGrad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = glowGrad
        ctx.fillRect(tileLeft, baseY - sevHeight, tileRight - tileLeft, sevHeight)
      }

      // Top face (isometric) — brighter
      ctx.beginPath()
      ctx.moveTo(tileLeft, baseY - sevHeight)
      ctx.lineTo(tileLeft + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight + perspOff, baseY - perspOff - sevHeight)
      ctx.lineTo(tileRight, baseY - sevHeight)
      ctx.closePath()
      ctx.fillStyle = `rgba(${Math.min(255, Math.floor(r * activeBoost))},${Math.min(255, Math.floor(g * activeBoost))},${Math.min(255, Math.floor(b * activeBoost))},${baseSevAlpha * 0.9})`
      ctx.fill()

      // Contour lines on front
      ctx.strokeStyle = `rgba(255,255,255,${isActive ? 0.1 : 0.04})`
      ctx.lineWidth = 0.5
      const contours = Math.floor(sevHeight / 18)
      for (let c = 1; c <= contours; c++) {
        const cy = baseY - (c * 18)
        if (cy < baseY - sevHeight) break
        ctx.beginPath()
        ctx.moveTo(tileLeft, cy)
        ctx.lineTo(tileRight, cy)
        ctx.stroke()
      }

      // Metric overlay bars (primary)
      if (d.metric !== undefined && d.metric > 0) {
        const [ar, ag, ab] = colors.accent
        const aBarH = Math.min(d.metric * sevHeight * 0.85, sevHeight * 0.85)
        const aBarW = (tileRight - tileLeft) * 0.3
        const aBarX = tileMid - aBarW / 2 - (d.metricB !== undefined ? aBarW * 0.35 : 0)
        const intensity = Math.min(0.4 + d.metric * 0.6, 0.95)

        const aGrad = ctx.createLinearGradient(aBarX, baseY, aBarX, baseY - aBarH)
        aGrad.addColorStop(0, `rgba(${ar},${ag},${ab},${intensity * 0.4})`)
        aGrad.addColorStop(1, `rgba(${ar},${ag},${ab},${intensity})`)
        ctx.fillStyle = aGrad
        ctx.fillRect(aBarX, baseY - aBarH, aBarW, aBarH)

        if (isActive) {
          ctx.shadowColor = `rgba(${ar},${ag},${ab},0.3)`
          ctx.shadowBlur = 8
          ctx.fillRect(aBarX, baseY - aBarH, aBarW, aBarH)
          ctx.shadowBlur = 0
        }
      }

      // Metric B overlay bar (secondary — for comparison)
      if (d.metricB !== undefined && d.metricB > 0) {
        const aBarH = Math.min(d.metricB * sevHeight * 0.85, sevHeight * 0.85)
        const aBarW = (tileRight - tileLeft) * 0.3
        const aBarX = tileMid + aBarW * 0.05
        const intensity = Math.min(0.3 + d.metricB * 0.5, 0.85)

        const bGrad = ctx.createLinearGradient(aBarX, baseY, aBarX, baseY - aBarH)
        bGrad.addColorStop(0, `rgba(150,150,150,${intensity * 0.4})`)
        bGrad.addColorStop(1, `rgba(150,150,150,${intensity})`)
        ctx.fillStyle = bGrad
        ctx.fillRect(aBarX, baseY - aBarH, aBarW, aBarH)
      }

      // Active highlight border
      if (isActive) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(tileLeft - 1, baseY - sevHeight - 1, tileRight - tileLeft + 2, sevHeight + 2)
      }

      // Region label below — smart truncation
      ctx.fillStyle = isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
      ctx.font = `${isActive ? 'bold ' : ''}9px Rajdhani`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const maxLabelWidth = tileW - 4
      let label = d.region
      // Measure and truncate only if needed
      let measured = ctx.measureText(label).width
      if (measured > maxLabelWidth) {
        // Try abbreviation first (remove vowels from middle)
        while (label.length > 3 && ctx.measureText(label + '..').width > maxLabelWidth) {
          label = label.slice(0, -1)
        }
        label += '..'
      }
      ctx.fillText(label, tileMid, baseY + 6)

      // Severity value on top
      ctx.fillStyle = isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)'
      ctx.font = 'bold 9px DM Mono, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(
        `${(d.severity * 10).toFixed(1)}`,
        tileMid + perspOff * 0.3,
        baseY - sevHeight - perspOff * 0.5 - 4
      )

      // Value label (budget, coverage, etc.)
      if (d.valueLabel) {
        ctx.fillStyle = isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'
        ctx.font = '8px DM Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(d.valueLabel, tileMid, baseY + 18)
      }
    })

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '8px Rajdhani'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    // Severity block
    const [lr, lg, lb] = colors.high
    ctx.fillStyle = `rgba(${lr},${lg},${lb},0.6)`
    ctx.fillRect(6, 6, 10, 7)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('Severity (height)', 20, 6)
    // Accent block
    const [ar, ag, ab] = colors.accent
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.6)`
    ctx.fillRect(6, 18, 10, 7)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText(theme === 'coverage' ? 'Coverage' : theme === 'delta' ? 'Gap' : 'Allocation', 20, 18)
  }, [data, activeIndex, width, height, theme, animated])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  )
}
