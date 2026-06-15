import { createMiddleware } from 'hono/factory'
import type { SessionUser } from '@demo/shared'
import type { Env } from '../index'

export const sessionMiddleware = createMiddleware<{
  Bindings: Env
  Variables: { user: SessionUser }
}>(async (c, next) => {
  const token = getCookie(c, 'session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const raw = await c.env.SESSIONS.get(`session:${token}`)
  if (!raw) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', JSON.parse(raw) as SessionUser)
  await next()
})

export const adminMiddleware = createMiddleware<{
  Bindings: Env
  Variables: { user: SessionUser }
}>(async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await next()
})

function getCookie(c: { req: { header: (key: string) => string | undefined } }, name: string): string | undefined {
  const cookie = c.req.header('cookie') ?? ''
  return cookie.split(';').map(p => p.trim()).find(p => p.startsWith(`${name}=`))?.split('=')[1]
}
