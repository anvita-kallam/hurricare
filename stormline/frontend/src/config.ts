function normalizeApiBase(raw: string | undefined): string {
  const fallback = 'http://localhost:8000'
  if (!raw?.trim()) return fallback

  let url = raw.trim().replace(/\/+$/, '')

  if (/^https?:\/\//i.test(url)) return url

  const host = url.replace(/^\/+/, '')
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return `http://${host}`
  }

  // Railway/public hosts need a scheme or axios treats the value as a relative path
  return `https://${host}`
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL)
