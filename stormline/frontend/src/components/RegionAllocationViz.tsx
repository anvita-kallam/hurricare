/**
 * RegionAllocationViz — 2.5D perspective visualization of affected regions
 * Shows color-coded allocation amounts and funding levels
 */

import { useMemo } from 'react'

interface Region {
  name: string
  lat: number
  lon: number
  severity: number // 0-1
  allocation: number // funding amount
  need: number // estimated need
  population: number
}

interface RegionAllocationVizProps {
  regions: Region[]
  maxAllocation: number
  width?: number
  height?: number
}

export default function RegionAllocationViz({
  regions,
  maxAllocation,
  width = 600,
  height = 400,
}: RegionAllocationVizProps) {
  const canvas = useMemo(() => {
    const ctx = document.createElement('canvas')
    ctx.width = width
    ctx.height = height

    const canvasContext = ctx.getContext('2d')
    if (!canvasContext) return null

    // Dark background
    canvasContext.fillStyle = '#0a0a0f'
    canvasContext.fillRect(0, 0, width, height)

    // Draw regions as 3D boxes
    regions.forEach((region, idx) => {
      // Map region lat/lon to canvas position (rough projection)
      const x = ((region.lon + 180) / 360) * width
      const y = ((90 - region.lat) / 180) * height

      // Size based on population (with min/max)
      const baseSize = 40 + Math.sqrt(region.population) * 2
      const size = Math.max(30, Math.min(100, baseSize))

      // 3D perspective: higher severity = higher on screen, deeper
      const perspectiveY = y - region.severity * 30

      // Color based on allocation vs need
      const allocationRatio = region.allocation / region.need
      let hue: number
      if (allocationRatio > 0.8) {
        hue = 120 // Green: well-funded
      } else if (allocationRatio > 0.5) {
        hue = 50 // Yellow: partially funded
      } else if (allocationRatio > 0.2) {
        hue = 30 // Orange: underfunded
      } else {
        hue = 0 // Red: severely underfunded
      }

      const saturation = 70 + region.severity * 30 // More severe = more saturated
      const lightness = 45 + (1 - region.severity) * 15

      // Draw 3D box (simple isometric effect)
      const depth = region.severity * 20

      // Left face (darker)
      canvasContext.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness * 0.7}%)`
      canvasContext.fillRect(x - size / 2, perspectiveY + depth, size * 0.3, size)

      // Top face (brighter)
      canvasContext.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      canvasContext.fillRect(x - size / 2 + size * 0.3, perspectiveY, size * 0.7, depth)

      // Right face
      canvasContext.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness * 0.8}%)`
      canvasContext.fillRect(x + size * 0.5, perspectiveY + depth, size * 0.3, size)

      // Draw label
      canvasContext.fillStyle = 'rgba(255, 255, 255, 0.8)'
      canvasContext.font = '12px Rajdhani, monospace'
      canvasContext.textAlign = 'center'
      canvasContext.fillText(region.name, x, perspectiveY - 15)

      // Draw allocation amount
      const allocationDisplay = `$${(region.allocation / 1e6).toFixed(1)}M`
      canvasContext.fillStyle = 'rgba(255, 255, 255, 0.6)'
      canvasContext.font = '10px DM Mono, monospace'
      canvasContext.fillText(allocationDisplay, x, perspectiveY + size + 25)
    })

    return ctx
  }, [regions, maxAllocation, width, height])

  if (!canvas) {
    return (
      <div className="w-full h-full bg-[#0a0a0f] flex items-center justify-center">
        <span className="text-white/40 text-sm">Unable to render allocation visualization</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* Canvas rendering */}
      <img
        src={canvas.toDataURL()}
        alt="Region Allocation"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          filter: 'drop-shadow(0 0 20px rgba(68, 136, 255, 0.1))',
        }}
      />

      {/* Legend overlay */}
      <div className="absolute bottom-6 left-6 bg-black/60 border border-white/[0.08] rounded p-3 text-xs font-mono">
        <div className="text-white/60 mb-2 font-rajdhani font-bold">Funding Status</div>
        <div className="space-y-1 text-white/50">
          <div><span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>Well-funded (&gt;80%)</div>
          <div><span className="inline-block w-2 h-2 bg-yellow-500 mr-2"></span>Partial (50-80%)</div>
          <div><span className="inline-block w-2 h-2 bg-orange-500 mr-2"></span>Under (20-50%)</div>
          <div><span className="inline-block w-2 h-2 bg-red-500 mr-2"></span>Critical (&lt;20%)</div>
        </div>
      </div>
    </div>
  )
}
