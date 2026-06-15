const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
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
