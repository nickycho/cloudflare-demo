import { api } from './api'
import type { SessionUser } from '@demo/shared'

const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export async function login(email: string, password: string, turnstileToken: string): Promise<SessionUser> {
  const res = await api.post<{ data: SessionUser & { token: string } }>('/auth/login', { email, password, turnstileToken })
  document.cookie = `session=${res.data.token}; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
  return res.data
}

export async function register(email: string, password: string, name: string, turnstileToken: string): Promise<void> {
  await api.post('/auth/register', { email, password, name, turnstileToken })
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {})
  document.cookie = 'session=; Path=/; Max-Age=0'
}
