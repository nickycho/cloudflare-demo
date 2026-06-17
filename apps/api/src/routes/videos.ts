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

// PATCH /videos/mock-upload — 本地開發用，接受 TUS PATCH 但不實際儲存
videosRouter.on(['GET', 'HEAD', 'PATCH'], '/mock-upload', (c) => {
  return new Response(null, {
    status: 204,
    headers: { 'Upload-Offset': c.req.header('Upload-Length') ?? '0' },
  })
})

// POST /videos/upload-url — Admin 取得 Stream TUS 上傳 URL
videosRouter.post('/upload-url', sessionMiddleware, adminMiddleware, async (c) => {
  const { courseId, title, fileSize } = await c.req.json<{ courseId: string; title: string; fileSize?: number }>()
  if (!courseId || !title) return c.json({ error: 'Missing fields' }, 400)

  const db = drizzle(c.env.DB)
  const id = nanoid()
  const now = Date.now()

  if (!c.env.STREAM_ACCOUNT_ID) {
    // 本地開發 mock：無 Stream 設定時，直接建立 ready 狀態影片
    const streamVideoId = nanoid()
    await db.insert(videos).values({
      id, course_id: courseId, title, order: 0,
      stream_video_id: streamVideoId, status: 'ready', created_at: now,
    })
    const origin = new URL(c.req.url).origin
    return c.json({ data: { videoId: id, streamVideoId, uploadURL: `${origin}/videos/mock-upload` } }, 201)
  }

  let uid: string, uploadURL: string
  try {
    ({ uid, uploadURL } = await createStreamUploadUrl(
      c.env.STREAM_ACCOUNT_ID,
      c.env.STREAM_API_TOKEN,
      title,
      fileSize ?? 0,
    ))
  } catch (err) {
    console.error('[videos/upload-url] Stream error:', err)
    return c.json({ error: err instanceof Error ? err.message : 'Stream upload init failed' }, 502)
  }
  await db.insert(videos).values({
    id, course_id: courseId, title, order: 0,
    stream_video_id: uid, status: 'processing', created_at: now,
  })
  return c.json({ data: { videoId: id, streamVideoId: uid, uploadURL } }, 201)
})

// POST /videos/:id/publish — 上傳完成，觸發 Agent
videosRouter.post('/:id/publish', sessionMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id')
  const db = drizzle(c.env.DB)
  const video = await db.select().from(videos).where(eq(videos.id, id)).get()
  if (!video) return c.json({ error: 'Not found' }, 404)
  // 透過 service binding 觸發 agent（內網呼叫，agent 不需公開 URL）。
  // 本地 dev 單獨跑 api 時 binding 可能不存在，故保留 guard 優雅降級。
  if (c.env.AGENT) {
    c.env.AGENT.fetch(new Request('https://agent/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id, streamVideoId: video.stream_video_id }),
    })).catch(() => {})
  }
  return c.json({ data: { status: video.status } }, 202)
})

// GET /videos/:id — 含 Stream signed token（公開端點，Stream token 本身有 access control）
videosRouter.get('/:id', async (c) => {
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
