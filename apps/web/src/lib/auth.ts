import { api } from './api'
import type { SessionUser } from '@demo/shared'

export async function login(email: string, password: string, turnstileToken: string): Promise<SessionUser> {
  const res = await api.post<{ data: SessionUser }>('/auth/login', { email, password, turnstileToken })
  return res.data
}

export async function register(email: string, password: string, name: string, turnstileToken: string): Promise<void> {
  await api.post('/auth/register', { email, password, name, turnstileToken })
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {})
}
