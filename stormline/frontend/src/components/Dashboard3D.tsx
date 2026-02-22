import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import MiniGlobePreview from './MiniGlobePreview'

interface DashboardOption {
  id: 'search' | 'browse' | 'disparity'
  title: string
  subtitle: string
  color: string
}

const options: DashboardOption[] = [
  {
    id: 'search',
    title: 'SEARCH',
    subtitle: 'Find Specific Hurricanes',
    color: '#334488'
  },
  {
    id: 'browse',
    title: 'BROWSE',
    subtitle: 'Explore Historical Events',
    color: '#443366'
  },
  {
    id: 'disparity',
    title: 'FUNDING',
    subtitle: 'Global Disparity Analysis',
    color: '#553333'
  }
]

const VARIANT_MAP: Record<string, 'search' | 'browse' | 'heatmap'> = {
  search: 'search',
  browse: 'browse',
  disparity: 'heatmap',
}

const GLOBE_POSITIONS: [number, number, number][] = [
  [-2.8, 0, 0],
  [0, 0, 0],
  [2.8, 0, 0],
]

function ThreeScene({ onSelect }: { onSelect: (id: 'search' | 'browse' | 'disparity') => void }) {
  const [selectedId, setSelectedId] = useState<'search' | 'browse' | 'disparity' | null>(null)

  const handleSelect = (id: 'search' | 'browse' | 'disparity') => {
    setSelectedId(id)
    setTimeout(() => onSelect(id), 300)
  }

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 4]} intensity={0.15} color="#2244ff" distance={10} />
      <pointLight position={[-3, 1, 2]} intensity={0.1} color="#9900ff" distance={12} />

      {options.map((option, index) => (
        <MiniGlobePreview
          key={option.id}
          variant={VARIANT_MAP[option.id]}
          position={GLOBE_POSITIONS[index]}
          isSelected={selectedId === option.id}
          onClick={() => handleSelect(option.id)}
        />
      ))}
    </>
  )
}

interface Dashboard3DProps {
  onEnter: () => void
  onSelectOption: (option: 'search' | 'browse' | 'disparity') => void
  isLoading: boolean
}

export default function Dashboard3D({ onSelectOption, isLoading }: Dashboard3DProps) {
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => setShowButton(true), 1000)
    }
  }, [isLoading])

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
          <ThreeScene onSelect={onSelectOption} />
        </Canvas>
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none">
        {/* Title */}
        <div className="text-center space-y-4 mb-24">
          <h1 className="text-7xl font-bold text-white font-rajdhani tracking-wider" style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.15)'
          }}>
            HURRICARE
          </h1>
          <p className="text-xl text-white/50 font-rajdhani tracking-widest">
            Humanitarian Response Simulation
          </p>
        </div>

        {/* Option Labels */}
        {!isLoading && (
          <div className="absolute bottom-32 left-0 right-0 pointer-events-none">
            <div className="flex justify-around px-16">
              {options.map((option) => (
                <div key={option.id} className="text-center w-48">
                  <div className="text-lg font-rajdhani font-bold text-white/80 tracking-wider">{option.title}</div>
                  <div className="text-sm text-white/40 font-rajdhani">{option.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-xl font-rajdhani text-white/50 tracking-widest">
            Initializing System...
          </div>
        )}

        {showButton && (
          <div className="absolute bottom-8 text-center pointer-events-auto">
            <p className="text-white/30 font-rajdhani text-sm">Click on a globe to continue</p>
          </div>
        )}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.5) 100%)',
        zIndex: 5
      }} />
    </div>
  )
}
