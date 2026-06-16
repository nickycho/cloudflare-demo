// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types'
import { auth } from './routes/auth'
import { coursesRouter } from './routes/courses'
import { videosRouter } from './routes/videos'
import { aiRouter } from './routes/ai'
import { enrollmentsRouter } from './routes/enrollments'

export type Env = {
  DB: D1Database
  SESSIONS: KVNamespace
  BUCKET: R2Bucket
  AI: Ai
  VECTORIZE: VectorizeIndex
  TURNSTILE_SECRET_KEY: string
  STREAM_ACCOUNT_ID: string
  STREAM_API_TOKEN: string
  REALTIME_WORKER_URL: string
  AGENT_WORKER_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (origin.startsWith('http://localhost:')) return origin
    if (origin.endsWith('.pages.dev')) return origin
    return null
  },
  credentials: true,
}))

app.get('/health', (c) => c.json({ ok: true }))

app.route('/auth', auth)
app.route('/courses', coursesRouter)
app.route('/videos', videosRouter)
app.route('/ai', aiRouter)
app.route('/enrollments', enrollmentsRouter)

export default app
