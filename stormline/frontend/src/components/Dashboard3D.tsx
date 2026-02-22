import { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

interface DashboardOption {
  id: 'search' | 'browse' | 'disparity'
  title: string
  subtitle: string
  icon: string
  color: [number, number, number]
}

const options: DashboardOption[] = [
  {
    id: 'search',
    title: 'SEARCH',
    subtitle: 'Find Specific Hurricanes',
    icon: '🔍',
    color: [6, 182, 212]
  },
  {
    id: 'browse',
    title: 'BROWSE',
    subtitle: 'Explore Historical Events',
    icon: '📚',
    color: [168, 85, 247]
  },
  {
    id: 'disparity',
    title: 'FUNDING',
    subtitle: 'Global Disparity Analysis',
    icon: '💰',
    color: [239, 68, 68]
  }
]

function OptionCard({ option, onClick, isSelected }: { option: DashboardOption; onClick: () => void; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.003
      meshRef.current.rotation.y += 0.005

      // Scale on hover
      const targetScale = isSelected ? 1.3 : hovered ? 1.15 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      position={[0, 0, 0]}
    >
      <boxGeometry args={[2, 2, 0.5]} />
      <meshPhongMaterial
        color={new THREE.Color(option.color[0] / 255, option.color[1] / 255, option.color[2] / 255)}
        emissive={new THREE.Color(option.color[0] / 255, option.color[1] / 255, option.color[2] / 255)}
        emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
        wireframe={false}
      />
    </mesh>
  )
}

function ThreeScene({ onSelect }: { onSelect: (id: 'search' | 'browse' | 'disparity') => void }) {
  const [selectedId, setSelectedId] = useState<'search' | 'browse' | 'disparity' | null>(null)

  const handleSelect = (id: 'search' | 'browse' | 'disparity') => {
    setSelectedId(id)
    setTimeout(() => onSelect(id), 300)
  }

  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#06b6d4" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#a855f7" />

      <Stars radius={300} depth={50} count={5000} factor={4} />

      <group>
        {options.map((option, index) => {
          const angle = (index / options.length) * Math.PI * 2
          const x = Math.cos(angle) * 3
          const z = Math.sin(angle) * 3
          return (
            <group key={option.id} position={[x, 0, z]}>
              <OptionCard
                option={option}
                onClick={() => handleSelect(option.id)}
                isSelected={selectedId === option.id}
              />
            </group>
          )
        })}
      </group>
    </Canvas>
  )
}

interface Dashboard3DProps {
  onEnter: () => void
  onSelectOption: (option: 'search' | 'browse' | 'disparity') => void
  isLoading: boolean
}

export default function Dashboard3D({ onEnter, onSelectOption, isLoading }: Dashboard3DProps) {
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => setShowButton(true), 1000)
    }
  }, [isLoading])

  const handleOptionSelect = (id: 'search' | 'browse' | 'disparity') => {
    onSelectOption(id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0">
        <ThreeScene onSelect={handleOptionSelect} />
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none">
        {/* Title */}
        <div className="text-center space-y-8 mb-24">
          <h1 className="text-7xl font-bold text-glow-cyan font-orbitron animate-pulse">
            HURRICARE
          </h1>
          <p className="text-2xl text-cyan-300 font-exo">
            Humanitarian Response Simulation
          </p>
        </div>

        {/* Option Labels */}
        {!isLoading && (
          <div className="absolute bottom-32 left-0 right-0 pointer-events-none">
            <div className="flex justify-around px-16">
              {options.map((option) => (
                <div key={option.id} className="text-center">
                  <div className="text-5xl mb-2">{option.icon}</div>
                  <div className="text-xl font-orbitron font-bold text-cyan-300">{option.title}</div>
                  <div className="text-sm text-cyan-400 font-exo">{option.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading or Info Text */}
        {isLoading && (
          <div className="text-2xl font-orbitron text-glow-cyan">
            Initializing System...
          </div>
        )}

        {showButton && (
          <div className="absolute bottom-8 text-center pointer-events-auto">
            <p className="text-cyan-300 font-exo text-sm mb-4">Click on an option to continue</p>
          </div>
        )}
      </div>

      {/* Vignette Effect */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
        zIndex: 5
      }} />
    </div>
  )
}
