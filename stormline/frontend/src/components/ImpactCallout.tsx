import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

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

interface ImpactCalloutProps {
  event: ImpactEvent
  position: THREE.Vector3
  visible: boolean
  opacity: number
}

export default function ImpactCallout({
  event,
  position,
  visible,
  opacity
}: ImpactCalloutProps) {
  const impactText = useMemo(() => {
    const parts: string[] = []
    
    if (event.impact.fatalities) {
      parts.push(`${event.impact.fatalities} ${event.impact.fatalities === 1 ? 'fatality' : 'fatalities'} reported`)
    }
    
    if (event.impact.power_outages) {
      const outages = event.impact.power_outages.toLocaleString()
      parts.push(`${outages} without power`)
    }
    
    if (event.impact.evacuations) {
      const evacs = event.impact.evacuations.toLocaleString()
      parts.push(`${evacs} evacuated`)
    }
    
    if (event.impact.damage_estimate_millions) {
      parts.push(`$${event.impact.damage_estimate_millions}M in damages`)
    }
    
    if (event.impact.flooding_reported) {
      parts.push('Flooding reported')
    }
    
    return parts
  }, [event.impact])
  
  if (!visible || opacity < 0.01) {
    return null
  }
  
  return (
    <mesh position={position}>
      <Html
        center
        distanceFactor={2}
        style={{
          pointerEvents: 'none',
          opacity,
          transition: 'opacity 0.3s ease-in-out',
          transform: 'scale(0.5)'
        }}
      >
        <div
          className="bg-black/90 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-1.5 text-white font-exo"
          style={{
            minWidth: '120px',
            maxWidth: '150px',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.5)',
            fontSize: '10px'
          }}
        >
          <div className="text-cyan-400 font-orbitron text-[10px] mb-0.5">
            T+{event.time_hours} {event.time_hours === 1 ? 'Hr' : 'Hrs'}
          </div>
          <div className="font-bold text-[10px] mb-0.5">{event.location.name}</div>
          <div className="text-[9px] space-y-0.5 leading-tight">
            {impactText.map((text, i) => (
              <div key={i} className="text-[9px]">{text}</div>
            ))}
          </div>
        </div>
      </Html>
    </mesh>
  )
}
