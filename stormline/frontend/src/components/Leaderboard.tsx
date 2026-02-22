import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

interface LeaderboardEntry {
  rank: number
  player_name: string
  score: number
}

interface LeaderboardData {
  date: string
  entries: LeaderboardEntry[]
}

interface LeaderboardProps {
  isOpen: boolean
  onClose: () => void
  lastScore?: number | null
  onScoreSubmitted?: () => void
}

export default function Leaderboard({ isOpen, onClose, lastScore, onScoreSubmitted }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard()
    }
  }, [isOpen])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/leaderboard/daily`, { params: { limit: 10 } })
      setData(res.data)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setData({ date: new Date().toISOString().slice(0, 10), entries: [] })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitScore = async () => {
    if (lastScore == null || lastScore < 0) return
    setSubmitting(true)
    setSubmitSuccess(null)
    try {
      await axios.post(`${API_BASE}/leaderboard/submit`, {
        player_name: playerName.trim() || 'Anonymous',
        score: lastScore
      })
      setSubmitSuccess('Score submitted!')
      setPlayerName('')
      fetchLeaderboard()
      onScoreSubmitted?.()
    } catch (error) {
      console.error('Error submitting score:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-black/95 border border-white/[0.06] rounded-xl p-6 z-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-rajdhani">Daily Leaderboard</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/60 text-2xl">×</button>
        </div>
        <p className="text-xs text-white/40 mb-4 font-rajdhani">
          Resets every day. Complete simulations to add to your score.
        </p>
        {data && (
          <p className="text-xs text-white/50 mb-3 font-rajdhani">Today: {data.date}</p>
        )}

        {/* Submit score section - only if lastScore provided */}
        {lastScore != null && lastScore >= 0 && (
          <div className="mb-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded">
            <div className="text-sm font-semibold text-white/60 mb-2 font-rajdhani">
              Submit your score: {Math.round(lastScore).toLocaleString()}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="flex-1 bg-black/60 border border-white/[0.06] rounded px-3 py-2 text-white/60 text-sm font-rajdhani placeholder-white/30"
              />
              <button
                onClick={handleSubmitScore}
                disabled={submitting}
                className="px-4 py-2 rounded bg-white/[0.12] hover:bg-white/[0.15] text-white/70 text-sm font-semibold disabled:opacity-50 font-rajdhani"
              >
                {submitting ? '...' : 'Submit'}
              </button>
            </div>
            {submitSuccess && (
              <div className="text-white/40 text-xs mt-2 font-rajdhani">{submitSuccess}</div>
            )}
          </div>
        )}

        {/* Leaderboard list */}
        {loading ? (
          <div className="text-center py-8 text-white/40 font-rajdhani">Loading...</div>
        ) : data && data.entries.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.entries.map((e) => (
              <div
                key={`${e.player_name}-${e.rank}`}
                className="flex items-center justify-between p-2 rounded bg-white/[0.03] border border-white/[0.04]"
              >
                <span className="font-rajdhani text-white/50 w-6">#{e.rank}</span>
                <span className="text-white/60 font-rajdhani flex-1">{e.player_name}</span>
                <span className="font-rajdhani font-bold">{Math.round(e.score).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40 font-rajdhani">
            No scores yet today. Complete a simulation and submit to be first!
          </div>
        )}
      </div>
    </>
  )
}
