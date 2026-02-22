import { create } from 'zustand'

export interface ImpactEvent {
  time_hours: number
  location: {
    name: string
    lat: number
    lon: number
  }
  impact: {
    fatalities?: number
    power_outages?: number
    evacuations?: number
    damage_estimate_millions?: number
    flooding_reported?: boolean
  }
}

export interface Hurricane {
  id: string
  name: string
  year: number
  max_category: number
  track: Array<{ lat: number; lon: number; wind: number }>
  affected_countries: string[]
  estimated_population_affected: number
  impact_events?: ImpactEvent[]
}

export interface Project {
  project_id: string
  hurricane_id: string
  country: string
  admin1: string
  cluster: string
  budget_usd: number
  beneficiaries: number
  pooled_fund: boolean
  implementing_partner: string
}

export interface Coverage {
  hurricane_id: string
  admin1: string
  pooled_fund_budget: number
  estimated_need_budget: number
  coverage_ratio: number
  severity_index: number
  people_in_need: number
}

export interface FlaggedProject extends Project {
  budget_per_beneficiary: number
  flag_type: 'high_outlier' | 'low_outlier'
  explanation: string
  z_score: number
}

export interface NarrativePopup {
  title: string
  message: string
  type?: 'story' | 'info' | 'warning'
}

// Game phase controls the two-phase UI:
// 'pre-sim'      — hurricane selection, globe view
// 'sim-running'  — cinematic/simulation playing, minimal HUD
// 'sim-complete' — map-only view with "Begin Game" button
// 'game-flow'    — immersive step-by-step panel overlay
export type GamePhase = 'pre-sim' | 'sim-running' | 'sim-complete' | 'game-flow'

interface Store {
  hurricanes: Hurricane[]
  selectedHurricane: Hurricane | null
  projects: Project[]
  coverage: Coverage[]
  flaggedProjects: FlaggedProject[]
  showSeverityOverlay: boolean
  showCoverageOverlay: boolean
  autoSpin: boolean
  lastSimulationScore: number | null
  leaderboardOpen: boolean
  isCinematicPlaying: boolean
  cinematicCompleted: boolean
  narrativePopup: NarrativePopup | null
  showComparisonPage: boolean
  comparisonData: {
    userPlan: any
    mlPlan: any
    realPlan: any
    mismatchAnalysis: any
  } | null
  postSimulationMapMode: boolean

  // Game-phase state
  gamePhase: GamePhase
  gameFlowStep: number // 1-5 for immersive panels

  // Game flow allocation state (used by immersive Step 2 & 3)
  gameAllocations: Record<string, number> // region → budget total (derived from cluster allocations)
  gameClusterAllocations: Record<string, Record<string, number>> // region → cluster → amount
  gameTotalBudget: number
  gameResponseWindow: number
  isRunningPipeline: boolean
  pipelineError: string | null

  setHurricanes: (hurricanes: Hurricane[]) => void
  setSelectedHurricane: (hurricane: Hurricane | null) => void
  setProjects: (projects: Project[]) => void
  setCoverage: (coverage: Coverage[]) => void
  setFlaggedProjects: (flagged: FlaggedProject[]) => void
  toggleSeverityOverlay: () => void
  toggleCoverageOverlay: () => void
  setAutoSpin: (autoSpin: boolean) => void
  setLastSimulationScore: (score: number | null) => void
  setLeaderboardOpen: (open: boolean) => void
  setCinematicPlaying: (playing: boolean) => void
  setCinematicCompleted: (completed: boolean) => void
  setNarrativePopup: (popup: NarrativePopup | null) => void
  setShowComparisonPage: (show: boolean) => void
  setComparisonData: (data: { userPlan: any; mlPlan: any; realPlan: any; mismatchAnalysis: any } | null) => void
  setPostSimulationMapMode: (mode: boolean) => void
  setGamePhase: (phase: GamePhase) => void
  setGameFlowStep: (step: number) => void
  setGameAllocations: (allocations: Record<string, number>) => void
  updateGameAllocation: (region: string, amount: number) => void
  setGameClusterAllocations: (allocations: Record<string, Record<string, number>>) => void
  updateGameClusterAllocation: (region: string, cluster: string, amount: number) => void
  setGameTotalBudget: (budget: number) => void
  setGameResponseWindow: (hours: number) => void
  setIsRunningPipeline: (running: boolean) => void
  setPipelineError: (error: string | null) => void
}

export const useStore = create<Store>((set) => ({
  hurricanes: [],
  selectedHurricane: null,
  projects: [],
  coverage: [],
  flaggedProjects: [],
  showSeverityOverlay: false,
  showCoverageOverlay: false,
  autoSpin: true,
  lastSimulationScore: null,
  leaderboardOpen: false,
  isCinematicPlaying: false,
  cinematicCompleted: false,
  narrativePopup: null,
  showComparisonPage: false,
  comparisonData: null,
  postSimulationMapMode: false,
  gamePhase: 'pre-sim' as GamePhase,
  gameFlowStep: 2,
  gameAllocations: {},
  gameClusterAllocations: {},
  gameTotalBudget: 50000000,
  gameResponseWindow: 72,
  isRunningPipeline: false,
  pipelineError: null,

  setHurricanes: (hurricanes) => set({ hurricanes }),
  setSelectedHurricane: (hurricane) => set({ selectedHurricane: hurricane }),
  setProjects: (projects) => set({ projects }),
  setCoverage: (coverage) => set({ coverage }),
  setFlaggedProjects: (flaggedProjects) => set({ flaggedProjects }),
  toggleSeverityOverlay: () => set((state) => ({ showSeverityOverlay: !state.showSeverityOverlay })),
  toggleCoverageOverlay: () => set((state) => ({ showCoverageOverlay: !state.showCoverageOverlay })),
  setAutoSpin: (autoSpin) => set({ autoSpin }),
  setLastSimulationScore: (lastSimulationScore) => set({ lastSimulationScore }),
  setLeaderboardOpen: (leaderboardOpen) => set({ leaderboardOpen }),
  setCinematicPlaying: (isCinematicPlaying) => set({ isCinematicPlaying }),
  setCinematicCompleted: (cinematicCompleted) => set({ cinematicCompleted }),
  setNarrativePopup: (narrativePopup) => set({ narrativePopup }),
  setShowComparisonPage: (showComparisonPage) => set({ showComparisonPage }),
  setComparisonData: (comparisonData) => set({ comparisonData }),
  setPostSimulationMapMode: (postSimulationMapMode) => set({ postSimulationMapMode }),
  setGamePhase: (gamePhase) => set({ gamePhase }),
  setGameFlowStep: (gameFlowStep) => set({ gameFlowStep }),
  setGameAllocations: (gameAllocations) => set({ gameAllocations }),
  updateGameAllocation: (region, amount) => set((state) => ({
    gameAllocations: { ...state.gameAllocations, [region]: amount }
  })),
  setGameClusterAllocations: (gameClusterAllocations) => set((state) => {
    // Derive region totals from cluster allocations
    const gameAllocations: Record<string, number> = {}
    Object.entries(gameClusterAllocations).forEach(([region, clusters]) => {
      gameAllocations[region] = Object.values(clusters).reduce((s, v) => s + (v || 0), 0)
    })
    return { gameClusterAllocations, gameAllocations }
  }),
  updateGameClusterAllocation: (region, cluster, amount) => set((state) => {
    const newCluster = {
      ...state.gameClusterAllocations,
      [region]: { ...state.gameClusterAllocations[region], [cluster]: amount }
    }
    // Derive region totals
    const gameAllocations: Record<string, number> = {}
    Object.entries(newCluster).forEach(([r, clusters]) => {
      gameAllocations[r] = Object.values(clusters).reduce((s, v) => s + (v || 0), 0)
    })
    return { gameClusterAllocations: newCluster, gameAllocations }
  }),
  setGameTotalBudget: (gameTotalBudget) => set({ gameTotalBudget }),
  setGameResponseWindow: (gameResponseWindow) => set({ gameResponseWindow }),
  setIsRunningPipeline: (isRunningPipeline) => set({ isRunningPipeline }),
  setPipelineError: (pipelineError) => set({ pipelineError }),
}))
