import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { videos } from '../db/schema'
import { sessionMiddleware, adminMiddleware } from '../middleware/session'
import { createStreamUploadUrl, getStreamSignedToken } from '../lib/stream'
import type { Env } from '../index'
import type { SessionUser } from '@demo/shared'

const videosRouter = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>()

function nanoid() { return crypto.randomUUID().replace(/-/g, '') }

// POST /videos/upload-url — Admin 取得 Stream TUS 上傳 URL
videosRouter.post('/upload-url', sessionMiddleware, adminMiddleware, async (c) => {
  const { courseId, title } = await c.req.json<{ courseId: string; title: string }>()
  if (!courseId || !title) return c.json({ error: 'Missing fields' }, 400)
  const { uid, uploadURL } = await createStreamUploadUrl(
    c.env.STREAM_ACCOUNT_ID,
    c.env.STREAM_API_TOKEN,
    title,
  )
  const db = drizzle(c.env.DB)
  const id = nanoid()
  await db.insert(videos).values({
    id, course_id: courseId, title, order: 0,
    stream_video_id: uid, status: 'processing', created_at: Date.now(),
  })
  return c.json({ data: { videoId: id, streamVideoId: uid, uploadURL } }, 201)
})

// POST /videos/:id/publish — 上傳完成，觸發 Agent
videosRouter.post('/:id/publish', sessionMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id')
  const db = drizzle(c.env.DB)
  const video = await db.select().from(videos).where(eq(videos.id, id)).get()
  if (!video) return c.json({ error: 'Not found' }, 404)
  if (c.env.AGENT_WORKER_URL) {
    fetch(c.env.AGENT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id, streamVideoId: video.stream_video_id }),
    }).catch(() => {})
  }
  return c.json({ data: { status: 'processing' } }, 202)
})

// GET /videos/:id — 含 Stream signed token
videosRouter.get('/:id', sessionMiddleware, async (c) => {
  const id = c.req.param('id')
  const db = drizzle(c.env.DB)
  const video = await db.select().from(videos).where(eq(videos.id, id)).get()
  if (!video) return c.json({ error: 'Not found' }, 404)
  let streamToken: string | null = null
  if (video.stream_video_id && c.env.STREAM_ACCOUNT_ID) {
    try {
      streamToken = await getStreamSignedToken(c.env.STREAM_ACCOUNT_ID, c.env.STREAM_API_TOKEN, video.stream_video_id)
    } catch {
      // Stream API 不可用時不影響其他資訊
    }
  }
  return c.json({ data: { ...video, streamToken } })
})

export { videosRouter }
