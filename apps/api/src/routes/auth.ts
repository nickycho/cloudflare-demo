import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'
import { verifyTurnstile } from '../lib/turnstile'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'
import type { SessionUser } from '@demo/shared'

const auth = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>()

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256,
  )
  const hashArray = Array.from(new Uint8Array(bits))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256,
  )
  const computed = new Uint8Array(bits)
  const expected = new Uint8Array(hashHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  let match = true
  for (let i = 0; i < computed.length; i++) {
    if (computed[i] !== expected[i]) match = false
  }
  return match
}

auth.post('/register', async (c) => {
  const { email, password, name, turnstileToken } = await c.req.json<{
    email: string; password: string; name: string; turnstileToken: string
  }>()
  if (!email || !password || !name) return c.json({ error: 'Missing fields' }, 400)
  const ok = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY)
  if (!ok) return c.json({ error: 'Invalid captcha' }, 400)
  const db = drizzle(c.env.DB)
  const existing = await db.select().from(users).where(eq(users.email, email)).get()
  if (existing) return c.json({ error: 'Email already in use' }, 409)
  const id = nanoid()
  const password_hash = await hashPassword(password)
  await db.insert(users).values({ id, email, name, password_hash, role: 'student', created_at: Date.now() })
  return c.json({ data: { id, email, name } }, 201)
})

auth.post('/login', async (c) => {
  const { email, password, turnstileToken } = await c.req.json<{
    email: string; password: string; turnstileToken: string
  }>()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)
  const ok = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY)
  if (!ok) return c.json({ error: 'Invalid captcha' }, 400)
  const db = drizzle(c.env.DB)
  const user = await db.select().from(users).where(eq(users.email, email)).get()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)
  const token = nanoid()
  const sessionUser: SessionUser = { id: user.id, email: user.email, name: user.name, role: user.role }
  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify(sessionUser), { expirationTtl: 60 * 60 * 24 * 7 })
  c.header('Set-Cookie', `session=${token}; HttpOnly; SameSite=None; Path=/; Max-Age=${60 * 60 * 24 * 7}; Secure`)
  return c.json({ data: { ...sessionUser, token } })
})

auth.get('/me', sessionMiddleware, async (c) => {
  return c.json({ data: c.get('user') })
})

auth.post('/logout', async (c) => {
  const token = getCookie(c, 'session')
  if (token) await c.env.SESSIONS.delete(`session:${token}`)
  c.header('Set-Cookie', 'session=; HttpOnly; SameSite=None; Path=/; Max-Age=0; Secure')
  return c.json({ data: { ok: true } })
})

// Dev-only：將已存在的使用者提升為 admin（只在 TURNSTILE_SECRET_KEY 未設定時可用）
auth.post('/dev/make-admin', async (c) => {
  if (c.env.TURNSTILE_SECRET_KEY) return c.json({ error: 'Not available in production' }, 403)
  const { email } = await c.req.json<{ email: string }>()
  if (!email) return c.json({ error: 'Missing email' }, 400)
  const db = drizzle(c.env.DB)
  const user = await db.select().from(users).where(eq(users.email, email)).get()
  if (!user) return c.json({ error: 'User not found' }, 404)
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  return c.json({ data: { ok: true, email, role: 'admin' } })
})

export { auth }
