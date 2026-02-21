// This component would integrate with Deck.gl or Mapbox for 2D overlays
// For MVP, we'll create a simple placeholder that can be enhanced later
import { useStore } from '../state/useStore'

export default function CoverageChoropleth() {
  const { showCoverageOverlay, showSeverityOverlay, coverage, selectedHurricane } = useStore()
  
  if (!showCoverageOverlay && !showSeverityOverlay) {
    return null
  }
  
  // This is a placeholder - in a full implementation, this would render
  // a 2D map overlay using Deck.gl or Mapbox GL JS
  // For now, we'll just show a legend/indicator
  
  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-cyan-500/30 p-3 rounded glow-cyan z-10">
      <div className="text-sm font-semibold mb-2 text-glow-cyan">Overlay Active</div>
      {showSeverityOverlay && (
        <div className="text-xs mb-1 text-cyan-200">
          <span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded glow"></span>
          Severity Index
        </div>
      )}
      {showCoverageOverlay && (
        <div className="text-xs text-cyan-200">
          <span className="inline-block w-3 h-3 bg-cyan-500 mr-1 rounded glow-cyan"></span>
          Coverage Ratio
        </div>
      )}
      <div className="text-xs text-cyan-300/70 mt-2">
        {selectedHurricane ? `Showing: ${selectedHurricane.name}` : 'All hurricanes'}
      </div>
    </div>
  )
}
