/**
 * BeginGameOverlay — Phase B entry point.
 *
 * After the simulation completes, the user sees the post-simulation map,
 * 2.5D affected countries visualization, and the "Begin Game" button.
 */

import { useState, useMemo } from 'react'
import { useStore } from '../state/useStore'
import TypewriterText from './TypewriterText'
import { playButtonPress, playHover } from '../audio/SoundEngine'
import AffectedAreaHeightMap from './shared/AffectedAreaHeightMap'

export default function BeginGameOverlay() {
  const { setGamePhase, setGameFlowStep, selectedHurricane, coverage } = useStore()
  const [pressed, setPressed] = useState(false)

  const handleBeginGame = () => {
    playButtonPress()
    setPressed(true)
    setTimeout(() => {
      setGameFlowStep(1)
      setGamePhase('game-flow')
    }, 400)
  }

  // Build 2.5D height map data from affected regions
  const heightMapData = useMemo(() => {
    if (!selectedHurricane) return []
    const regionCoverage = coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .sort((a, b) => (b.severity_index || 0) - (a.severity_index || 0))
      .slice(0, 8)
    return regionCoverage.map(c => ({
      region: c.admin1,
      severity: Math.min((c.severity_index || 5) / 10, 1),
      metric: Math.min((c.coverage_ratio || 0.5), 1),
      valueLabel: c.admin1,
    }))
  }, [selectedHurricane, coverage])

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-end pb-12 pointer-events-none">
      {/* 2.5D Affected Countries Visualization */}
      {heightMapData.length > 0 && (
        <div className="pointer-events-none mb-8" style={{
          background: 'linear-gradient(180deg, rgba(0,0,2,0.7) 0%, rgba(0,0,4,0.8) 50%, rgba(0,0,3,0.7) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '16px 20px 12px',
          borderRadius: '8px',
          backdropFilter: 'blur(12px)',
        }}>
          <div className="text-center mb-3">
            <div className="text-white/60 font-rajdhani text-sm tracking-[0.25em] uppercase">
              Affected Regions
            </div>
            {selectedHurricane && (
              <div className="text-white/90 font-rajdhani font-bold text-xl tracking-wider mt-1">
                {selectedHurricane.name} ({selectedHurricane.year})
              </div>
            )}
          </div>
          <AffectedAreaHeightMap
            data={heightMapData}
            width={500}
            height={160}
            theme="severity"
            animated
          />
        </div>
      )}

      {/* Begin Game button */}
      <button
        onClick={handleBeginGame}
        onMouseEnter={() => playHover()}
        className={`
          pointer-events-auto
          begin-game-btn
          px-14 py-5
          font-rajdhani font-bold text-xl tracking-[0.2em] uppercase
          text-white/90 hover:text-white
          bg-white/[0.06] hover:bg-white/[0.1]
          border border-white/[0.15] hover:border-white/[0.3]
          backdrop-blur-sm
          transition-all duration-500
          ${pressed ? 'begin-game-btn-pressed scale-95 opacity-0' : ''}
        `}
      >
        <TypewriterText text="Begin Game" emphasis="headline" delayMs={800} charIntervalMs={60} />
      </button>
    </div>
  )
}
