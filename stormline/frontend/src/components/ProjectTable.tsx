import { useState, useMemo } from 'react'
import { useStore } from '../state/useStore'

type SortField = 'project_id' | 'cluster' | 'budget_usd' | 'beneficiaries' | 'budget_per_beneficiary'
type SortDirection = 'asc' | 'desc'

export default function ProjectTable() {
  const { projects, flaggedProjects, selectedHurricane } = useStore()
  const [sortField, setSortField] = useState<SortField>('project_id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterCluster, setFilterCluster] = useState<string>('')
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false)
  
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => 
      !selectedHurricane || p.hurricane_id === selectedHurricane.id
    )
    
    if (filterCluster) {
      filtered = filtered.filter(p => p.cluster === filterCluster)
    }
    
    if (showOnlyFlagged) {
      const flaggedIds = new Set(flaggedProjects.map(fp => fp.project_id))
      filtered = filtered.filter(p => flaggedIds.has(p.project_id))
    }
    
    return filtered
  }, [projects, selectedHurricane, filterCluster, showOnlyFlagged, flaggedProjects])
  
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]
      
      if (sortField === 'budget_per_beneficiary') {
        aVal = a.beneficiaries > 0 ? a.budget_usd / a.beneficiaries : 0
        bVal = b.beneficiaries > 0 ? b.budget_usd / b.beneficiaries : 0
      }
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filteredProjects, sortField, sortDirection])
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }
  
  const clusters = useMemo(() => {
    const unique = new Set(projects.map(p => p.cluster))
    return Array.from(unique).sort()
  }, [projects])
  
  const flaggedIds = new Set(flaggedProjects.map(fp => fp.project_id))
  
  const getFlagInfo = (projectId: string) => {
    return flaggedProjects.find(fp => fp.project_id === projectId)
  }
  
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 h-full flex flex-col glow-cyan">
      <h2 className="text-xl font-bold mb-4 text-glow-cyan font-orbitron">Project Analysis</h2>
      
      <div className="mb-4 flex gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1 text-cyan-200">Filter by Cluster</label>
          <select
            value={filterCluster}
            onChange={(e) => setFilterCluster(e.target.value)}
            className="border border-cyan-500/30 rounded px-2 py-1 bg-black/60 text-cyan-200 focus:border-cyan-400 focus:glow-cyan"
          >
            <option value="" className="bg-black">All Clusters</option>
            {clusters.map(cluster => (
              <option key={cluster} value={cluster} className="bg-black">{cluster}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="flagged-only"
            checked={showOnlyFlagged}
            onChange={(e) => setShowOnlyFlagged(e.target.checked)}
            className="w-4 h-4 accent-cyan-500"
          />
          <label htmlFor="flagged-only" className="text-sm text-cyan-200">Show only flagged</label>
        </div>
        
        <div className="text-sm text-cyan-300/80">
          Showing {sortedProjects.length} of {projects.length} projects
        </div>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="bg-cyan-500/20 border-b border-cyan-500/30 sticky top-0">
            <tr>
              <th 
                className="px-2 py-2 text-left cursor-pointer text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition"
                onClick={() => handleSort('project_id')}
              >
                Project ID {sortField === 'project_id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-2 py-2 text-left cursor-pointer text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition"
                onClick={() => handleSort('cluster')}
              >
                Cluster {sortField === 'cluster' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-2 py-2 text-right cursor-pointer text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition"
                onClick={() => handleSort('budget_usd')}
              >
                Budget (USD) {sortField === 'budget_usd' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-2 py-2 text-right cursor-pointer text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition"
                onClick={() => handleSort('beneficiaries')}
              >
                Beneficiaries {sortField === 'beneficiaries' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-2 py-2 text-right cursor-pointer text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition"
                onClick={() => handleSort('budget_per_beneficiary')}
              >
                $/Beneficiary {sortField === 'budget_per_beneficiary' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-2 py-2 text-left text-cyan-200">Pooled Fund</th>
              <th className="px-2 py-2 text-left text-cyan-200">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((project) => {
              const flagInfo = getFlagInfo(project.project_id)
              const budgetPerBeneficiary = project.beneficiaries > 0 
                ? project.budget_usd / project.beneficiaries 
                : 0
              
              return (
                <tr
                  key={project.project_id}
                  className={`border-b border-cyan-500/10 hover:bg-cyan-500/10 transition ${
                    flagInfo ? (flagInfo.flag_type === 'high_outlier' ? 'bg-red-500/20' : 'bg-yellow-500/20') : ''
                  }`}
                >
                  <td className="px-2 py-2 text-cyan-200">{project.project_id}</td>
                  <td className="px-2 py-2 text-cyan-300">{project.cluster}</td>
                  <td className="px-2 py-2 text-right text-cyan-200">
                    ${project.budget_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-2 py-2 text-right text-cyan-200">
                    {project.beneficiaries.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right text-cyan-200">
                    ${budgetPerBeneficiary.toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    {project.pooled_fund ? (
                      <span className="text-green-400 font-semibold glow-green">Yes</span>
                    ) : (
                      <span className="text-cyan-400/60">No</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {flagInfo && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        flagInfo.flag_type === 'high_outlier' 
                          ? 'bg-red-500/30 text-red-300 glow' 
                          : 'bg-yellow-500/30 text-yellow-300 glow'
                      }`}>
                        {flagInfo.flag_type === 'high_outlier' ? 'High' : 'Low'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
