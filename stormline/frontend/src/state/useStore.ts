import { create } from 'zustand'

export interface Hurricane {
  id: string
  name: string
  year: number
  max_category: number
  track: Array<{ lat: number; lon: number; wind: number }>
  affected_countries: string[]
  estimated_population_affected: number
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
}))
