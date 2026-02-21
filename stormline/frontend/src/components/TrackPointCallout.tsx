import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

interface TrackPointCalloutProps {
  position: Vector3
  windSpeed: number
  category: number
  lat: number
  lon: number
  visible: boolean
  opacity: number
}

export default function TrackPointCallout({
  position,
  windSpeed,
  category,
  lat,
  lon,
  visible,
  opacity
}: TrackPointCalloutProps) {
  const { camera } = useThree()
  
  if (!visible || opacity < 0.1) return null
  
  const formatLatLon = (coord: number) => {
    const abs = Math.abs(coord)
    const deg = Math.floor(abs)
    const min = Math.floor((abs - deg) * 60)
    const dir = coord >= 0 ? (coord === lat ? 'N' : 'E') : (coord === lat ? 'S' : 'W')
    return `${deg}°${min}'${dir}`
  }
  
  return (
    <Html
      position={position}
      center
      distanceFactor={2}
      style={{
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      <div
        className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-2 min-w-[180px] max-w-[220px]"
        style={{
          boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
          transform: 'scale(0.7)'
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-300 font-exo">Wind Speed</span>
            <span className="text-sm font-bold text-white font-orbitron">
              {Math.round(windSpeed)} mph
            </span>
          </div>
          
          {category > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-cyan-300 font-exo">Category</span>
              <span className="text-sm font-bold text-red-400 font-orbitron">
                Cat {category}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-cyan-400/70 font-exo">
            <span>{formatLatLon(lat)}</span>
            <span>{formatLatLon(lon)}</span>
          </div>
        </div>
      </div>
    </Html>
  )
}
