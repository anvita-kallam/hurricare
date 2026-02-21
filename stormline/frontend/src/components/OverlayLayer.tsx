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
    
    if (!selectedHurricane.track || selectedHurricane.track.length === 0) {
      return []
    }
    
    const trackPoints = selectedHurricane.track
    const overlays: Array<{
      lat: number
      lon: number
      color: string
      opacity: number
      type: 'severity' | 'coverage'
      admin1: string
    }> = []
    
    relevantCoverage.forEach((cov, idx) => {
      // Base position from hurricane track
      const trackIdx = Math.floor((idx / relevantCoverage.length) * trackPoints.length)
      const trackPoint = trackPoints[trackIdx]
      
      // Severity overlay: positioned where the crisis/need is (closer to track, offset by severity)
      if (showSeverityOverlay) {
        const severity = cov.severity_index || 0
        // Position severity based on need - closer to track, with offset based on severity
        const severityLatOffset = (idx % 3 - 1) * 2.5 + (severity * 1.5) // Need is near the crisis
        const severityLonOffset = (Math.floor(idx / 3) % 3 - 1) * 2.5
        
        const severityCoords = {
          lat: trackPoint.lat + severityLatOffset,
          lon: trackPoint.lon + severityLonOffset
        }
        
        const redIntensity = Math.floor(100 + severity * 155)
        overlays.push({
          ...severityCoords,
          color: `rgb(${redIntensity}, 0, 0)`,
          opacity: 0.5 + (severity * 0.4),
          type: 'severity',
          admin1: cov.admin1
        })
      }
      
      // Coverage overlay: positioned where funding went (different offset to show mismatch)
      if (showCoverageOverlay) {
        const coverageRatio = Math.min(1, Math.max(0, cov.coverage_ratio || 0))
        // Position coverage offset from severity to show mismatch
        // Lower coverage = further from need location (showing funding didn't reach where needed)
        const coverageLatOffset = (idx % 3 - 1) * 2.5 - (1 - coverageRatio) * 3 // Funding may be offset from need
        const coverageLonOffset = (Math.floor(idx / 3) % 3 - 1) * 2.5 + (1 - coverageRatio) * 3
        
        const coverageCoords = {
          lat: trackPoint.lat + coverageLatOffset,
          lon: trackPoint.lon + coverageLonOffset
        }
        
        const blueIntensity = Math.floor(100 + coverageRatio * 155)
        overlays.push({
          ...coverageCoords,
          color: `rgb(0, 0, ${blueIntensity})`,
          opacity: 0.5 + (coverageRatio * 0.4),
          type: 'coverage',
          admin1: cov.admin1
        })
      }
    })
    
    return overlays
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
        // Only render if we have valid coordinates
        if (!data.lat || !data.lon || isNaN(data.lat) || isNaN(data.lon)) {
          return null
        }
        
        // Check for intersections only when both overlays are active
        let finalColor = data.color
        let finalOpacity = data.opacity
        
        if (showSeverityOverlay && showCoverageOverlay) {
          // Find the corresponding overlay of the other type for the same region
          const otherOverlay = overlayData.find(
            (d, i) => i !== idx && d.admin1 === data.admin1 && d.type !== data.type
          )
          
          // If both overlays exist for the same region and they're close, show purple intersection
          if (otherOverlay) {
            const distance = Math.sqrt(
              Math.pow(data.lat - otherOverlay.lat, 2) + 
              Math.pow(data.lon - otherOverlay.lon, 2)
            )
            // If overlays are close (within 5 degrees), show intersection as purple
            if (distance < 5) {
              finalColor = '#9b59b6' // Purple for intersection
              finalOpacity = 0.7
            }
            // Otherwise, keep original color (red for severity, blue for coverage)
          }
        }
        
        return (
          <RegionOverlay
            key={`${data.type}-${data.admin1}-${idx}`}
            centerLat={data.lat}
            centerLon={data.lon}
            color={finalColor}
            opacity={finalOpacity}
          />
        )
      })}
    </group>
  )
}
