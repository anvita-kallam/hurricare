import { useMemo } from 'react'
import { useStore, FlaggedProject } from '../state/useStore'

export default function FlaggedProjects() {
  const { flaggedProjects, selectedHurricane } = useStore()
  
  const filtered = useMemo(() => {
    if (!selectedHurricane) return flaggedProjects
    return flaggedProjects.filter(fp => fp.hurricane_id === selectedHurricane.id)
  }, [flaggedProjects, selectedHurricane])
  
  const highOutliers = filtered.filter(fp => fp.flag_type === 'high_outlier')
  const lowOutliers = filtered.filter(fp => fp.flag_type === 'low_outlier')
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Flagged Projects</h2>
      
      <div className="mb-4 text-sm text-gray-600">
        Found {filtered.length} flagged projects
        {selectedHurricane && ` for ${selectedHurricane.name}`}
      </div>
      
      <div className="overflow-auto flex-1 space-y-4">
        {highOutliers.length > 0 && (
          <div>
            <h3 className="font-semibold text-red-700 mb-2">
              High Outliers ({highOutliers.length})
            </h3>
            <div className="space-y-2">
              {highOutliers.map((project) => (
                <FlaggedProjectCard key={project.project_id} project={project} />
              ))}
            </div>
          </div>
        )}
        
        {lowOutliers.length > 0 && (
          <div>
            <h3 className="font-semibold text-yellow-700 mb-2">
              Low Outliers ({lowOutliers.length})
            </h3>
            <div className="space-y-2">
              {lowOutliers.map((project) => (
                <FlaggedProjectCard key={project.project_id} project={project} />
              ))}
            </div>
          </div>
        )}
        
        {filtered.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            No flagged projects found
          </div>
        )}
      </div>
    </div>
  )
}

function FlaggedProjectCard({ project }: { project: FlaggedProject }) {
  return (
    <div className={`border-l-4 p-3 rounded ${
      project.flag_type === 'high_outlier' 
        ? 'border-red-500 bg-red-50' 
        : 'border-yellow-500 bg-yellow-50'
    }`}>
      <div className="font-semibold text-sm mb-1">{project.project_id}</div>
      <div className="text-xs text-gray-600 mb-2">
        {project.cluster} • {project.admin1}, {project.country}
      </div>
      <div className="text-xs mb-2">
        <span className="font-medium">Budget:</span> ${project.budget_usd.toLocaleString()} • 
        <span className="font-medium"> Beneficiaries:</span> {project.beneficiaries.toLocaleString()} • 
        <span className="font-medium"> $/Beneficiary:</span> ${project.budget_per_beneficiary.toFixed(2)}
      </div>
      <div className="text-xs text-gray-700 italic">
        {project.explanation}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Z-score: {project.z_score.toFixed(2)}
      </div>
    </div>
  )
}
