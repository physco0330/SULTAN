/* Minimal API client. All calls go through Vite proxy: /api -> http://localhost:4001
 * When the backend is offline every service falls back to its local mock. */

import { bumpDataVersion } from '@/utils/liveSync'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'sultan-admin-token'

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const token = getAdminToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const data = await res.json()
      if (data.error) message = data.error
    } catch {
      /* keep fallback message */
    }
    throw new ApiError(message, res.status)
  }
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && !path.includes('/admin/auth/') && path !== '/admin/me') {
    bumpDataVersion()
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export function isApiOffline(err: unknown): boolean {
  return err instanceof TypeError
}