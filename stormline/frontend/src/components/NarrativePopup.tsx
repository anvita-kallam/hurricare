import { useEffect, useState } from 'react'

interface NarrativePopupProps {
  title: string
  message: string
  onClose: () => void
  type?: 'info' | 'warning' | 'success' | 'story'
  autoClose?: number
}

export default function NarrativePopup({ 
  title, 
  message, 
  onClose, 
  type = 'info',
  autoClose = 5000 
}: NarrativePopupProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in animation
    setTimeout(() => setIsVisible(true), 100)

    // Auto-close if specified
    if (autoClose > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300) // Wait for fade-out
      }, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  const typeStyles = {
    info: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200',
    warning: 'border-orange-500/50 bg-orange-500/10 text-orange-200',
    success: 'border-green-500/50 bg-green-500/10 text-green-200',
    story: 'border-purple-500/50 bg-purple-500/10 text-purple-200'
  }

  const typeGlow = {
    info: 'glow-cyan',
    warning: 'glow-orange',
    success: 'glow-green',
    story: 'glow-purple'
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`max-w-2xl w-full mx-4 p-8 rounded-lg border-2 ${typeStyles[type]} ${typeGlow[type]} transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold font-orbitron text-glow-cyan">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold transition"
          >
            ×
          </button>
        </div>
        <p className="text-lg font-exo leading-relaxed whitespace-pre-line">
          {message}
        </p>
        {autoClose > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-cyan-600/80 hover:bg-cyan-600 rounded font-orbitron transition"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
