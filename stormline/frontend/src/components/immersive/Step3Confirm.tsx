/**
 * Step 3 — Confirm & Run
 *
 * One focused confirmation panel.
 * Shows the user what they're about to compare.
 * Cinematic processing-like aesthetic.
 */

import { useMemo } from 'react'
import { useStore } from '../../state/useStore'

function formatBudget(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function Step3Confirm() {
  const { selectedHurricane, comparisonData } = useStore()

  const userAllocationCount = comparisonData?.userPlan?.allocations?.length || 0
  const totalBudget = comparisonData?.userPlan?.total_budget || 0
  const totalAllocated = useMemo(() => {
    if (!comparisonData?.userPlan?.allocations) return 0
    return comparisonData.userPlan.allocations.reduce(
      (sum: number, a: any) => sum + (a.budget || 0), 0
    )
  }, [comparisonData])

  const utilization = totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0

  if (!selectedHurricane || !comparisonData) return null

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="text-white/20 font-rajdhani text-[9px] tracking-[0.3em] uppercase">
          Response Plan Validated
        </div>
        <h2 className="text-white/80 font-rajdhani font-bold text-xl tracking-wider">
          Analysis Complete
        </h2>
      </div>

      {/* Confirmation display — minimal, centered */}
      <div className="flex flex-col items-center gap-6">
        {/* Budget utilization ring */}
        <div className="relative w-28 h-28">
          <svg width={112} height={112} className="transform -rotate-90">
            <circle
              cx={56} cy={56} r={48}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3}
            />
            <circle
              cx={56} cy={56} r={48}
              fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3}
              strokeDasharray={2 * Math.PI * 48}
              strokeDashoffset={2 * Math.PI * 48 * (1 - utilization / 100)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white/80 font-mono text-lg font-medium">
              {utilization.toFixed(0)}%
            </span>
            <span className="text-white/25 font-rajdhani text-[8px] tracking-widest uppercase">
              Utilized
            </span>
          </div>
        </div>

        {/* Plan summary */}
        <div className="flex gap-8">
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">{formatBudget(totalAllocated)}</div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Allocated</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">{userAllocationCount}</div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Regions</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 font-mono text-sm">
              {comparisonData.userPlan.response_window_hours || 72}h
            </div>
            <div className="text-white/20 font-rajdhani text-[9px] tracking-widest uppercase">Window</div>
          </div>
        </div>
      </div>

      {/* Processing indicators — cinematic dots */}
      <div className="flex items-center justify-center gap-3 pt-4">
        {['User Plan', 'ML Ideal', 'Historical', 'Mismatch'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/40 confirm-dot"
              style={{ animationDelay: `${i * 200}ms` }}
            />
            <span className="text-white/25 font-mono text-[9px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Subtle instruction */}
      <div className="text-center">
        <div className="text-white/15 font-mono text-[10px]">
          Proceed to view results
        </div>
      </div>
    </div>
  )
}
