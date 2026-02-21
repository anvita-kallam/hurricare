import { useMemo } from 'react'
import { useStore } from '../state/useStore'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Helper function to convert lat/lon to 3D coordinates on a sphere
function latLonToVector3(lat: number, lon: number, radius: number = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  
  return new THREE.Vector3(x, y, z)
}

// Generate a simple region shape around a center point
function createRegionShape(centerLat: number, centerLon: number, size: number = 3): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const radius = 1.01 // Slightly above the globe surface
  
  // Create a circular region around the center point
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2
    const lat = centerLat + Math.cos(angle) * size
    const lon = centerLon + Math.sin(angle) * size
    points.push(latLonToVector3(lat, lon, radius))
  }
  
  return points
}

function RegionOverlay({ 
  centerLat, 
  centerLon, 
  color, 
  opacity 
}: { 
  centerLat: number
  centerLon: number
  color: string
  opacity: number
}) {
  const shape = useMemo(() => {
    return createRegionShape(centerLat, centerLon)
  }, [centerLat, centerLon])
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(shape.length * 3)
    
    shape.forEach((point, i) => {
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z
    })
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    // Create indices for a filled shape
    const indices: number[] = []
    for (let i = 1; i < shape.length - 1; i++) {
      indices.push(0, i, i + 1)
    }
    geo.setIndex(indices)
    
    return geo
  }, [shape])
  
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function OverlayLayer() {
  const { showSeverityOverlay, showCoverageOverlay, selectedHurricane, coverage } = useStore()
  
  const overlayData = useMemo(() => {
    if (!selectedHurricane) return []
    
    const relevantCoverage = coverage.filter(c => c.hurricane_id === selectedHurricane.id)
    
    // Get approximate lat/lon for each region (simplified - in real app would use actual region boundaries)
    const regionCoords: Record<string, { lat: number; lon: number }> = {}
    
    // Use hurricane track to estimate region positions
    if (selectedHurricane.track && selectedHurricane.track.length > 0) {
      const trackPoints = selectedHurricane.track
      relevantCoverage.forEach((cov, idx) => {
        // Distribute regions around the hurricane track
        const trackIdx = Math.floor((idx / relevantCoverage.length) * trackPoints.length)
        const trackPoint = trackPoints[trackIdx]
        
        // Add some variation based on region index
        const latOffset = (idx % 3 - 1) * 3
        const lonOffset = (Math.floor(idx / 3) % 3 - 1) * 3
        
        regionCoords[cov.admin1] = {
          lat: trackPoint.lat + latOffset,
          lon: trackPoint.lon + lonOffset
        }
      })
    }
    
    return relevantCoverage.map(cov => {
      const coords = regionCoords[cov.admin1] || { 
        lat: selectedHurricane.track?.[0]?.lat || 0, 
        lon: selectedHurricane.track?.[0]?.lon || 0 
      }
      
      let color = '#00bcd4'
      let opacity = 0.5
      
      if (showSeverityOverlay) {
        // Red gradient based on severity (0-1 scale)
        const severity = cov.severity_index || 0
        const redIntensity = Math.floor(severity * 255)
        color = `rgb(${redIntensity}, 0, ${255 - redIntensity})`
        opacity = 0.5 + (severity * 0.4) // 0.5 to 0.9 opacity
      }
      
      if (showCoverageOverlay) {
        // Color gradient based on coverage ratio
        const coverageRatio = Math.min(1, Math.max(0, cov.coverage_ratio || 0))
        if (coverageRatio < 0.3) {
          // Very low coverage: dark red
          color = `rgb(200, 0, 0)`
        } else if (coverageRatio < 0.5) {
          // Low coverage: red to orange
          const intensity = ((coverageRatio - 0.3) / 0.2) // 0 to 1
          color = `rgb(255, ${Math.floor(intensity * 100)}, 0)`
        } else if (coverageRatio < 0.7) {
          // Medium coverage: orange to yellow
          const intensity = ((coverageRatio - 0.5) / 0.2) // 0 to 1
          color = `rgb(255, ${Math.floor(100 + intensity * 155)}, 0)`
        } else {
          // High coverage: yellow to green
          const intensity = ((coverageRatio - 0.7) / 0.3) // 0 to 1
          color = `rgb(${255 - Math.floor(intensity * 255)}, 255, ${Math.floor(intensity * 100)})`
        }
        opacity = 0.5 + (coverageRatio * 0.4) // 0.5 to 0.9 opacity
      }
      
      return {
        ...cov,
        ...coords,
        color,
        opacity
      }
    })
  }, [showSeverityOverlay, showCoverageOverlay, selectedHurricane, coverage])
  
  if (!showSeverityOverlay && !showCoverageOverlay) {
    return null
  }
  
  if (overlayData.length === 0) {
    return null
  }
  
  return (
    <group>
      {overlayData.map((data, idx) => {
        // Only render if we have valid coordinates and the overlay is enabled
        if (!data.lat || !data.lon || isNaN(data.lat) || isNaN(data.lon)) {
          return null
        }
        
        return (
          <RegionOverlay
            key={`${data.hurricane_id}-${data.admin1}-${idx}`}
            centerLat={data.lat}
            centerLon={data.lon}
            color={data.color}
            opacity={data.opacity}
          />
        )
      })}
    </group>
  )
}
