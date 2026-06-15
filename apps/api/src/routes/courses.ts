import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { courses, videos } from '../db/schema'
import { sessionMiddleware, adminMiddleware } from '../middleware/session'
import type { Env } from '../index'
import type { SessionUser } from '@demo/shared'

const coursesRouter = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>()

function nanoid() { return crypto.randomUUID().replace(/-/g, '') }

// GET /courses — KV 快取優先（僅回傳 published）
coursesRouter.get('/', async (c) => {
  const cached = await c.env.SESSIONS.get('cache:courses')
  if (cached) return c.json({ data: JSON.parse(cached) })
  const db = drizzle(c.env.DB)
  const list = await db.select().from(courses).where(eq(courses.status, 'published')).all()
  await c.env.SESSIONS.put('cache:courses', JSON.stringify(list), { expirationTtl: 300 })
  return c.json({ data: list })
})

// GET /courses/:id — 含影片列表
coursesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const cacheKey = `cache:course:${id}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) return c.json({ data: JSON.parse(cached) })
  const db = drizzle(c.env.DB)
  const course = await db.select().from(courses).where(eq(courses.id, id)).get()
  if (!course) return c.json({ error: 'Not found' }, 404)
  if (course.status === 'draft') return c.json({ error: 'Not found' }, 404)
  const videoList = await db.select().from(videos).where(eq(videos.course_id, id)).all()
  const result = { ...course, videos: videoList }
  await c.env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 })
  return c.json({ data: result })
})

// POST /courses — Admin only
coursesRouter.post('/', sessionMiddleware, adminMiddleware, async (c) => {
  const { title, description } = await c.req.json<{ title: string; description: string }>()
  if (!title) return c.json({ error: 'Missing title' }, 400)
  const db = drizzle(c.env.DB)
  const id = nanoid()
  const now = Date.now()
  await db.insert(courses).values({ id, title, description: description ?? '', status: 'draft', created_at: now, updated_at: now })
  await c.env.SESSIONS.delete('cache:courses')
  return c.json({ data: { id, title } }, 201)
})

// PUT /courses/:id — Admin only
coursesRouter.put('/:id', sessionMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Partial<{ title: string; description: string; status: 'draft' | 'published'; thumbnail_key: string }>>()
  const db = drizzle(c.env.DB)
  await db.update(courses).set({ ...body, updated_at: Date.now() }).where(eq(courses.id, id))
  await c.env.SESSIONS.delete('cache:courses')
  await c.env.SESSIONS.delete(`cache:course:${id}`)
  return c.json({ data: { ok: true } })
})

export { coursesRouter }
