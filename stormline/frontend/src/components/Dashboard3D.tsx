import { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Starfield from './mapvis/Starfield'
import GlobeShell from './mapvis/GlobeShell'

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

function FloatingCard({ option, position, onClick, isSelected }: {
  option: DashboardOption
  position: [number, number, number]
  onClick: () => void
  isSelected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const baseY = position[1]

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    // Gentle floating motion — no pulsing/breathing
    meshRef.current.position.y = baseY + Math.sin(clock.elapsedTime * 0.8 + position[0]) * 0.05
    meshRef.current.rotation.y += 0.003

    // Subtle scale on select only
    const targetScale = isSelected ? 1.15 : 1.0
    const cur = meshRef.current.scale.x
    meshRef.current.scale.setScalar(cur + (targetScale - cur) * 0.1)
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1.6, 2.0, 0.15]} />
      <meshBasicMaterial
        color={option.color}
        transparent
        opacity={isSelected ? 0.9 : hovered ? 0.7 : 0.5}
        toneMapped={false}
      />
    </mesh>
  )
}

function CardBorder({ position, isSelected }: {
  position: [number, number, number]
  isSelected: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const baseY = position[1]

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = baseY + Math.sin(clock.elapsedTime * 0.8 + position[0]) * 0.05
    ref.current.rotation.y += 0.003
    const targetScale = isSelected ? 1.15 : 1.0
    const cur = ref.current.scale.x
    ref.current.scale.setScalar(cur + (targetScale - cur) * 0.1)
  })

  return (
    <lineSegments ref={ref} position={position}>
      <edgesGeometry args={[new THREE.BoxGeometry(1.6, 2.0, 0.15)]} />
      <lineBasicMaterial color="#ffffff" transparent opacity={isSelected ? 0.5 : 0.15} />
    </lineSegments>
  )
}

function ThreeScene({ onSelect }: { onSelect: (id: 'search' | 'browse' | 'disparity') => void }) {
  const [selectedId, setSelectedId] = useState<'search' | 'browse' | 'disparity' | null>(null)

  const handleSelect = (id: 'search' | 'browse' | 'disparity') => {
    setSelectedId(id)
    setTimeout(() => onSelect(id), 300)
  }

  const cardPositions: [number, number, number][] = [
    [-2.8, 0, 0],
    [0, 0, 0],
    [2.8, 0, 0]
  ]

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 4]} intensity={0.15} color="#2244ff" distance={10} />
      <pointLight position={[-3, 1, 2]} intensity={0.1} color="#9900ff" distance={12} />

      {/* MapVis Starfield — consistent with globe scene */}
      <Starfield />

      {/* Small background globe for visual consistency */}
      <group position={[0, 0, -4]} scale={[0.8, 0.8, 0.8]}>
        <GlobeShell />
      </group>

      {/* Floating 3D cards */}
      {options.map((option, index) => (
        <group key={option.id}>
          <FloatingCard
            option={option}
            position={cardPositions[index]}
            onClick={() => handleSelect(option.id)}
            isSelected={selectedId === option.id}
          />
          <CardBorder
            position={cardPositions[index]}
            isSelected={selectedId === option.id}
          />
        </group>
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
            <p className="text-white/30 font-rajdhani text-sm">Click on an option to continue</p>
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
