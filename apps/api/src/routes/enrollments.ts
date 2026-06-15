import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { enrollments, watchProgress, courses } from '../db/schema'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'

const enrollmentsRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

// POST /enrollments — 學員報名課程
enrollmentsRouter.post('/', sessionMiddleware, async (c) => {
  const { courseId } = await c.req.json<{ courseId: string }>()
  if (!courseId) return c.json({ error: 'Missing courseId' }, 400)
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  await db.insert(enrollments)
    .values({ user_id: user.id, course_id: courseId, enrolled_at: Date.now() })
    .onConflictDoNothing()
  return c.json({ data: { ok: true } }, 201)
})

// PUT /enrollments/progress/:videoId — 更新觀看進度
enrollmentsRouter.put('/progress/:videoId', sessionMiddleware, async (c) => {
  const videoId = c.req.param('videoId')
  const { progressSec, completed } = await c.req.json<{ progressSec: number; completed: boolean }>()
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  await db.insert(watchProgress)
    .values({
      user_id: user.id,
      video_id: videoId,
      progress_sec: progressSec,
      completed: completed ?? false,
      last_watched_at: Date.now(),
    })
    .onConflictDoUpdate({
      target: [watchProgress.user_id, watchProgress.video_id],
      set: { progress_sec: progressSec, completed: completed ?? false, last_watched_at: Date.now() },
    })
  return c.json({ data: { ok: true } })
})

// GET /enrollments/me — 學員已報名的課程
enrollmentsRouter.get('/me', sessionMiddleware, async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const enrolled = await db
    .select({ course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.course_id, courses.id))
    .where(eq(enrollments.user_id, user.id))
    .all()
  return c.json({ data: enrolled.map(r => r.course) })
})

export { enrollmentsRouter }
