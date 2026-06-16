// Server-side fetch goes through the API service binding to avoid
// Cloudflare error 1042 (same-zone Worker-to-Worker subrequest via public URL).
// Browser fetches use the public API URL with credentials.

async function serverFetch(path: string, options?: RequestInit): Promise<Response> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare')
  const { env } = getCloudflareContext()
  const apiBinding = (env as Record<string, unknown>).API as
    | { fetch: (input: Request) => Promise<Response> }
    | undefined
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
  const req = new Request(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  // Fall back to direct fetch when the binding is missing (e.g. local dev)
  if (apiBinding) return apiBinding.fetch(req)
  return fetch(req)
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isServer = typeof window === 'undefined'
  let res: Response
  if (isServer) {
    res = await serverFetch(path, options)
  } else {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  }
  let json: Record<string, unknown>
  try {
    json = await res.json()
  } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  if (!res.ok) throw new Error((json.error as string) ?? 'Request failed')
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}
