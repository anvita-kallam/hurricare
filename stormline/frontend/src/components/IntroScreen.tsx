import { useState, useEffect } from 'react'

interface IntroScreenProps {
  onEnter: () => void
  isLoading: boolean
}

export default function IntroScreen({ onEnter, isLoading }: IntroScreenProps) {
  const [showButton, setShowButton] = useState(false)
  const [loadingText, setLoadingText] = useState('Loading Simulation...')
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (isLoading) {
      // Animate loading dots
      const interval = setInterval(() => {
        setDots(prev => {
          if (prev.length >= 3) return ''
          return prev + '.'
        })
      }, 500)
      return () => clearInterval(interval)
    } else {
      // Show button after a brief delay
      setTimeout(() => setShowButton(true), 1000)
    }
  }, [isLoading])

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Galaxy Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Deep space gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-cyan-900/20" />
        
        {/* Animated stars layer 1 - White stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20% 30%, white, transparent),
            radial-gradient(2px 2px at 60% 70%, white, transparent),
            radial-gradient(1px 1px at 50% 50%, white, transparent),
            radial-gradient(1px 1px at 80% 10%, white, transparent),
            radial-gradient(2px 2px at 90% 60%, white, transparent),
            radial-gradient(1px 1px at 33% 80%, white, transparent),
            radial-gradient(2px 2px at 10% 40%, white, transparent),
            radial-gradient(1px 1px at 70% 20%, white, transparent),
            radial-gradient(1px 1px at 15% 60%, white, transparent),
            radial-gradient(2px 2px at 45% 25%, white, transparent),
            radial-gradient(1px 1px at 75% 85%, white, transparent),
            radial-gradient(2px 2px at 25% 75%, white, transparent)
          `,
          backgroundSize: '200px 200px',
          backgroundRepeat: 'repeat',
          opacity: 1.0,
          animation: 'sparkle 20s linear infinite'
        }} />
        
        {/* Animated stars layer 2 - Colored stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(1px 1px at 30% 50%, rgba(6, 182, 212, 0.8), transparent),
            radial-gradient(1px 1px at 70% 30%, rgba(168, 85, 247, 0.6), transparent),
            radial-gradient(2px 2px at 50% 70%, rgba(6, 182, 212, 0.7), transparent),
            radial-gradient(1px 1px at 10% 20%, rgba(168, 85, 247, 0.5), transparent),
            radial-gradient(2px 2px at 90% 80%, rgba(6, 182, 212, 0.6), transparent),
            radial-gradient(1px 1px at 40% 90%, rgba(168, 85, 247, 0.7), transparent)
          `,
          backgroundSize: '300px 300px',
          backgroundRepeat: 'repeat',
          opacity: 0.9,
          animation: 'sparkle 15s linear infinite reverse'
        }} />

        {/* Galaxy spiral effect */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, rgba(168, 85, 247, 0.6) 0%, rgba(6, 182, 212, 0.5) 30%, transparent 70%)`,
          opacity: 0.5,
          animation: 'rotate 60s linear infinite'
        }} />
        
        {/* Additional nebula effect */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 60% 40% at 20% 30%, rgba(6, 182, 212, 0.5) 0%, transparent 50%),
                       radial-gradient(ellipse 50% 60% at 80% 70%, rgba(168, 85, 247, 0.5) 0%, transparent 50%)`,
          opacity: 0.4,
          animation: 'pulse 8s ease-in-out infinite'
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <div className="text-center space-y-8">
          {/* Title */}
          <h1 className="text-7xl font-bold text-glow-cyan font-orbitron mb-4 animate-pulse">
            STORMLINE
          </h1>
          
          {/* Subtitle */}
          <p className="text-2xl text-cyan-300 font-exo mb-12">
            Humanitarian Response Simulation
          </p>

          {/* Loading or Button */}
          {isLoading ? (
            <div className="space-y-4">
              <div className="text-3xl font-orbitron text-glow-cyan">
                {loadingText}{dots}
              </div>
              <div className="flex justify-center">
                <div className="w-64 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 animate-pulse"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            </div>
          ) : showButton ? (
            <button
              onClick={onEnter}
              className="px-12 py-4 text-2xl font-orbitron font-bold text-black bg-gradient-to-r from-cyan-400 to-purple-500 rounded-lg glow-cyan hover:from-cyan-300 hover:to-purple-400 transition-all duration-300 transform hover:scale-110 animate-pulse"
            >
              ENTER GAME
            </button>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.6; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </div>
  )
}
