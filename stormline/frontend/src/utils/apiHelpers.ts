import type { Hurricane, Coverage } from '../state/useStore'

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function normalizeTrack(track: unknown): Hurricane['track'] {
  if (Array.isArray(track)) {
    return track.filter(
      (point): point is Hurricane['track'][number] =>
        !!point &&
        typeof point === 'object' &&
        typeof (point as { lat?: unknown }).lat === 'number' &&
        typeof (point as { lon?: unknown }).lon === 'number'
    )
  }
  if (typeof track === 'string') {
    try {
      const parsed = JSON.parse(track)
      return normalizeTrack(parsed)
    } catch {
      return []
    }
  }
  return []
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return normalizeStringArray(parsed)
    } catch {
      return value ? [value] : []
    }
  }
  return []
}

export function normalizeHurricane(raw: unknown): Hurricane | null {
  if (!raw || typeof raw !== 'object') return null

  const h = raw as Record<string, unknown>
  if (typeof h.id !== 'string' || typeof h.name !== 'string') return null

  return {
    id: h.id,
    name: h.name,
    year: Number(h.year) || 0,
    max_category: Number(h.max_category) || 0,
    track: normalizeTrack(h.track),
    affected_countries: normalizeStringArray(h.affected_countries),
    estimated_population_affected: Number(h.estimated_population_affected) || 0,
    impact_events: Array.isArray(h.impact_events) ? (h.impact_events as Hurricane['impact_events']) : undefined,
  }
}

export function normalizeHurricanes(raw: unknown): Hurricane[] {
  return ensureArray<unknown>(raw)
    .map(normalizeHurricane)
    .filter((hurricane): hurricane is Hurricane => hurricane !== null)
}

export function normalizeCoverage(raw: unknown): Coverage[] {
  return ensureArray<unknown>(raw)
    .filter((item): item is Coverage => !!item && typeof item === 'object' && typeof (item as Coverage).hurricane_id === 'string')
}

export function isJsonArrayResponse(data: unknown): data is unknown[] {
  return Array.isArray(data)
}
