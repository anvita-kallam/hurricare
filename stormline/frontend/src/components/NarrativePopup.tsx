import { useEffect, useState } from 'react'
import TypewriterText from './TypewriterText'
// Sound removed — only hover/click sounds kept

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
    setTimeout(() => {
      setIsVisible(true)
    }, 100)

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
    info: 'border-white/[0.08] bg-white/[0.03] text-white/60',
    warning: 'border-white/[0.08] bg-white/[0.03] text-white/60',
    success: 'border-white/[0.08] bg-white/[0.03] text-white/60',
    story: 'border-white/[0.08] bg-white/[0.03] text-white/60'
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
          <h3 className="text-2xl font-bold font-rajdhani">
            <TypewriterText text={title} emphasis="headline" delayMs={200} charIntervalMs={40} />
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold transition"
          >
            ×
          </button>
        </div>
        <p className="text-lg font-rajdhani leading-relaxed whitespace-pre-line">
          <TypewriterText text={message} emphasis="normal" delayMs={600} charIntervalMs={12} />
        </p>
        {autoClose > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/[0.15] hover:bg-white/[0.2] rounded font-rajdhani transition"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
