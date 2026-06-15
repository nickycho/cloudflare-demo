// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types'
import { auth } from './routes/auth'

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
  origin: ['http://localhost:3000', 'https://your-pages-domain.pages.dev'],
  credentials: true,
}))

app.get('/health', (c) => c.json({ ok: true }))

app.route('/auth', auth)

export default app
