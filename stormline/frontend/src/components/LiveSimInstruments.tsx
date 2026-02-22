/**
 * LiveSimInstruments — Phase A side instrumentation.
 *
 * Thin, minimal, non-dominant side panels that show live data while the simulation runs.
 * These are NOT dashboards. They are thin instrument strips.
 *
 * RULES:
 * - Thin and non-dominant
 * - Never cover center of screen
 * - Never stack into grids
 * - Only show: intensity, severity, funding, system signals
 * - No cards, no summaries, no text-heavy blocks
 */

import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '../state/useStore'

interface LiveSimInstrumentsProps {
  pipelineStage: string
  pipelineProgress: number
}

export default function LiveSimInstruments({ pipelineStage, pipelineProgress }: LiveSimInstrumentsProps) {
  const { selectedHurricane, coverage } = useStore()

  const regionSeverities = useMemo(() => {
    if (!selectedHurricane) return []
    return coverage
      .filter(c => c.hurricane_id === selectedHurricane.id)
      .map(c => ({
        region: c.admin1,
        severity: Math.min(c.severity_index / 10, 1),
        coverage: c.coverage_ratio,
        need: c.people_in_need,
      }))
      .sort((a, b) => b.severity - a.severity)
  }, [selectedHurricane, coverage])

  if (!selectedHurricane) return null

  return (
    <>
      {/* Left instrument strip — severity meters */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-30 w-10 flex flex-col items-center gap-1 py-4">
        {regionSeverities.slice(0, 8).map((r, i) => (
          <div key={r.region} className="relative group">
            <div
              className="w-2 rounded-full transition-all duration-500"
              style={{
                height: `${12 + r.severity * 24}px`,
                backgroundColor: r.severity > 0.7
                  ? `rgba(200, 60, 60, ${0.3 + r.severity * 0.5})`
                  : r.severity > 0.4
                    ? `rgba(200, 160, 60, ${0.3 + r.severity * 0.4})`
                    : `rgba(60, 160, 100, ${0.2 + r.severity * 0.3})`,
                transitionDelay: `${i * 80}ms`,
              }}
            />
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-black/90 border border-white/10 rounded px-2 py-1 whitespace-nowrap">
                <div className="text-white/60 font-rajdhani text-[9px]">{r.region}</div>
                <div className="text-white/40 font-mono text-[8px]">sev: {(r.severity * 10).toFixed(1)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right instrument strip — pipeline progress */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-30 w-10 flex flex-col items-center gap-2 py-4">
        {/* Progress vertical bar */}
        <div className="w-1 h-32 bg-white/[0.04] rounded-full overflow-hidden relative">
          <div
            className="absolute bottom-0 left-0 w-full bg-white/20 rounded-full transition-all duration-700"
            style={{ height: `${pipelineProgress}%` }}
          />
        </div>
        {/* Stage dots */}
        {['V', 'M', 'R', 'A', 'C'].map((label, i) => {
          const stageOrder = ['validating', 'ml_generating', 'real_loading', 'analyzing', 'complete']
          const currentIdx = stageOrder.indexOf(pipelineStage)
          const isActive = i === currentIdx
          const isPast = i < currentIdx
          return (
            <div
              key={label}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                isActive ? 'bg-white/50 scale-125' : isPast ? 'bg-white/20' : 'bg-white/[0.06]'
              }`}
              title={stageOrder[i]}
            />
          )
        })}
      </div>
    </>
  )
}
