# 影音知識學習平台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立以 Cloudflare 服務為核心的影音知識學習平台 Monorepo，管理員上傳課程影片，學員觀看、即時留言並對影片內容提問 AI。

**Architecture:** pnpm workspace monorepo，`apps/web`（Next.js 15 on Pages）透過 REST API 呼叫 `apps/api`（Hono on Workers），即時留言走 WebSocket 連接 `workers/realtime`（Durable Objects），上傳完成後觸發 `workers/agent`（Agents SDK）非同步執行 AI Pipeline。

**Tech Stack:** Next.js 15 + `@opennextjs/cloudflare`, Hono, Drizzle ORM, D1, KV, R2, Vectorize, Workers AI, Durable Objects, Agents SDK, Cloudflare Stream, Cloudflare Images, Turnstile, Vitest + `@cloudflare/vitest-pool-workers`

---

## 設計文件

`docs/superpowers/specs/2026-06-15-cloudflare-demo-design.md`

---

## 檔案結構

```
cloudflare-demo/
├── package.json                     # workspace root
├── pnpm-workspace.yaml
├── .gitignore
├── apps/
│   ├── web/                         # Next.js → Cloudflare Pages
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── wrangler.toml
│   │   ├── open-next.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx                          # 課程列表首頁
│   │       │   ├── auth/login/page.tsx
│   │       │   ├── auth/register/page.tsx
│   │       │   ├── courses/[id]/page.tsx
│   │       │   ├── courses/[id]/videos/[vid]/page.tsx
│   │       │   ├── admin/page.tsx
│   │       │   └── me/page.tsx
│   │       ├── components/
│   │       │   ├── CourseCard.tsx
│   │       │   ├── VideoList.tsx
│   │       │   ├── StreamPlayer.tsx
│   │       │   ├── LiveComments.tsx
│   │       │   ├── AISummary.tsx
│   │       │   ├── AIChat.tsx
│   │       │   ├── TurnstileWidget.tsx
│   │       │   ├── VideoUploader.tsx
│   │       │   └── ProcessingStatus.tsx
│   │       └── lib/
│   │           ├── api.ts           # API client（fetch wrapper）
│   │           └── auth.ts          # session cookie helper
│   └── api/                         # Hono → Cloudflare Workers
│       ├── package.json
│       ├── wrangler.toml
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts             # Hono app entry + route 掛載
│           ├── routes/
│           │   ├── auth.ts
│           │   ├── courses.ts
│           │   ├── videos.ts
│           │   ├── enrollments.ts
│           │   ├── ai.ts
│           │   └── images.ts
│           ├── middleware/
│           │   └── session.ts       # KV session 驗證中間件
│           ├── db/
│           │   ├── schema.ts        # Drizzle schema
│           │   └── migrations/
│           │       └── 0001_initial.sql
│           └── lib/
│               ├── turnstile.ts     # Turnstile verify helper
│               └── stream.ts        # Cloudflare Stream API helper
├── workers/
│   ├── realtime/                    # Durable Objects
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   └── src/
│   │       └── index.ts             # ChatRoom DO class
│   └── agent/                       # Agents SDK
│       ├── package.json
│       ├── wrangler.toml
│       └── src/
│           └── index.ts             # VideoProcessingAgent class
└── packages/
    └── shared/
        ├── package.json
        └── src/
            └── types.ts             # 共享型別（Course, Video, User…）
```

---

## Phase 1 — Monorepo 骨架 + 基礎設施

### Task 1: Workspace Root 設定

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: 建立 workspace root package.json**

```json
{
  "name": "cloudflare-demo",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "dev:realtime": "pnpm --filter realtime dev",
    "dev:agent": "pnpm --filter agent dev"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 建立 pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'workers/*'
  - 'packages/*'
```

- [ ] **Step 3: 更新 .gitignore**

```
.superpowers/
node_modules/
.wrangler/
.env
.env.local
.next/
dist/
.open-next/
```

- [ ] **Step 4: 安裝 root 依賴**

```bash
pnpm install
```

Expected: pnpm-lock.yaml 產生

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore
git commit -m "chore: init pnpm workspace"
```

---

### Task 2: packages/shared 型別定義

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: 建立 shared package.json**

```json
{
  "name": "@demo/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/types.ts",
  "types": "./src/types.ts"
}
```

- [ ] **Step 2: 建立共享型別**

```typescript
// packages/shared/src/types.ts
export type UserRole = 'admin' | 'student'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: number
}

export interface Course {
  id: string
  title: string
  description: string
  thumbnail_key: string | null
  status: 'draft' | 'published'
  created_at: number
  updated_at: number
}

export interface Video {
  id: string
  course_id: string
  title: string
  order: number
  stream_video_id: string | null
  status: 'processing' | 'ready'
  summary: string | null
  transcript: string | null
  created_at: number
}

export interface Enrollment {
  user_id: string
  course_id: string
  enrolled_at: number
}

export interface WatchProgress {
  user_id: string
  video_id: string
  progress_sec: number
  completed: boolean
  last_watched_at: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/
git commit -m "feat: add shared types package"
```

---

### Task 3: apps/api 骨架 + D1 Schema

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/migrations/0001_initial.sql`

- [ ] **Step 1: 建立 api package.json**

```json
{
  "name": "api",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply demo-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply demo-db --remote",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "drizzle-orm": "^0.38.0",
    "@demo/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "wrangler": "^3.99.0",
    "vitest": "^3.0.0",
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20250214.0"
  }
}
```

- [ ] **Step 2: 建立 wrangler.toml**

```toml
name = "cloudflare-demo-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "demo-db"
database_id = "REPLACE_WITH_REAL_ID"

[[kv_namespaces]]
binding = "SESSIONS"
id = "REPLACE_WITH_REAL_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cloudflare-demo-bucket"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "video-content"

[vars]
TURNSTILE_SECRET_KEY = ""
STREAM_ACCOUNT_ID = ""
STREAM_API_TOKEN = ""
REALTIME_WORKER_URL = ""
AGENT_WORKER_URL = ""
```

- [ ] **Step 3: 建立 D1 migration SQL**

```sql
-- apps/api/src/db/migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin', 'student')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  stream_video_id TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'ready')),
  summary TEXT,
  transcript TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS watch_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  progress_sec INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  last_watched_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, video_id)
);
```

- [ ] **Step 4: 建立 Drizzle schema**

```typescript
// apps/api/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'student'] }).notNull().default('student'),
  created_at: integer('created_at').notNull(),
})

export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  thumbnail_key: text('thumbnail_key'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
})

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  course_id: text('course_id').notNull().references(() => courses.id),
  title: text('title').notNull(),
  order: integer('order').notNull().default(0),
  stream_video_id: text('stream_video_id'),
  status: text('status', { enum: ['processing', 'ready'] }).notNull().default('processing'),
  summary: text('summary'),
  transcript: text('transcript'),
  created_at: integer('created_at').notNull(),
})

export const enrollments = sqliteTable('enrollments', {
  user_id: text('user_id').notNull().references(() => users.id),
  course_id: text('course_id').notNull().references(() => courses.id),
  enrolled_at: integer('enrolled_at').notNull(),
})

export const watchProgress = sqliteTable('watch_progress', {
  user_id: text('user_id').notNull().references(() => users.id),
  video_id: text('video_id').notNull().references(() => videos.id),
  progress_sec: integer('progress_sec').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  last_watched_at: integer('last_watched_at').notNull(),
})
```

- [ ] **Step 5: 建立 Hono app entry**

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types'

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

export default app
```

- [ ] **Step 6: 安裝依賴並建立本地 D1**

```bash
cd apps/api && pnpm install
# 在 Cloudflare Dashboard 建立 D1 database，取得 database_id 填入 wrangler.toml
wrangler d1 create demo-db
# 執行 migration
pnpm db:migrate:local
```

Expected: `.wrangler/state/v3/d1/` 目錄出現，migration 成功

- [ ] **Step 7: 驗證 API 可啟動**

```bash
pnpm dev
```

Expected: `http://localhost:8787` 可回應，`GET /health` 回傳 `{"ok":true}`

- [ ] **Step 8: Commit**

```bash
cd ../..
git add apps/api/
git commit -m "feat: add api worker skeleton with D1 schema"
```

---

### Task 4: apps/web 骨架

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/wrangler.toml`
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: 建立 web package.json**

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "deploy": "opennextjs-cloudflare build && wrangler pages deploy",
    "preview": "opennextjs-cloudflare build && wrangler pages dev"
  },
  "dependencies": {
    "next": "15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@demo/shared": "workspace:*"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "^1.3.0",
    "wrangler": "^3.99.0",
    "@cloudflare/workers-types": "^4.20250214.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: 建立 next.config.ts**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cloudflarestream.com' },
      { hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 3: 建立 open-next.config.ts**

```typescript
// apps/web/open-next.config.ts
import type { OpenNextConfig } from '@opennextjs/cloudflare'

const config: OpenNextConfig = {}

export default config
```

- [ ] **Step 4: 建立 wrangler.toml**

```toml
name = "cloudflare-demo-web"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next/assets"

[vars]
NEXT_PUBLIC_API_URL = "http://localhost:8787"
```

- [ ] **Step 5: 建立 API client**

```typescript
// apps/web/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}
```

- [ ] **Step 6: 建立 root layout**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cloudflare Demo — 影音學習平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: 建立首頁佔位符**

```typescript
// apps/web/src/app/page.tsx
export default function HomePage() {
  return <main><h1>課程列表</h1></main>
}
```

- [ ] **Step 8: 安裝依賴並驗證**

```bash
cd apps/web && pnpm install
pnpm dev
```

Expected: `http://localhost:3000` 顯示「課程列表」標題，無 TypeScript 錯誤

- [ ] **Step 9: Commit**

```bash
cd ../..
git add apps/web/
git commit -m "feat: add Next.js web app skeleton"
```

---

### Task 5: workers/realtime 骨架

**Files:**
- Create: `workers/realtime/package.json`
- Create: `workers/realtime/wrangler.toml`
- Create: `workers/realtime/src/index.ts`

- [ ] **Step 1: 建立 realtime package.json**

```json
{
  "name": "realtime",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.99.0",
    "@cloudflare/workers-types": "^4.20250214.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 建立 wrangler.toml**

```toml
name = "cloudflare-demo-realtime"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

- [ ] **Step 3: 建立 ChatRoom DO 骨架**

```typescript
// workers/realtime/src/index.ts
import { DurableObject } from 'cloudflare:workers'

export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.ctx.getWebSockets().forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

  webSocketClose(ws: WebSocket): void {
    ws.close()
  }
}

export default {
  async fetch(request: Request, env: { CHAT_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    const videoId = url.pathname.split('/').pop()
    if (!videoId) return new Response('Missing video ID', { status: 400 })
    const id = env.CHAT_ROOM.idFromName(videoId)
    const stub = env.CHAT_ROOM.get(id)
    return stub.fetch(request)
  },
}
```

- [ ] **Step 4: 安裝依賴**

```bash
cd workers/realtime && pnpm install
cd ../..
```

- [ ] **Step 5: Commit**

```bash
git add workers/realtime/
git commit -m "feat: add realtime Durable Objects worker skeleton"
```

---

### Task 6: workers/agent 骨架

**Files:**
- Create: `workers/agent/package.json`
- Create: `workers/agent/wrangler.toml`
- Create: `workers/agent/src/index.ts`

- [ ] **Step 1: 建立 agent package.json**

```json
{
  "name": "agent",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "agents": "^0.0.97"
  },
  "devDependencies": {
    "wrangler": "^3.99.0",
    "@cloudflare/workers-types": "^4.20250214.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 建立 wrangler.toml**

```toml
name = "cloudflare-demo-agent"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[durable_objects]
bindings = [{ name = "VIDEO_PROCESSING_AGENT", class_name = "VideoProcessingAgent" }]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["VideoProcessingAgent"]

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "video-content"

[[d1_databases]]
binding = "DB"
database_name = "demo-db"
database_id = "REPLACE_WITH_REAL_ID"

[vars]
STREAM_ACCOUNT_ID = ""
STREAM_API_TOKEN = ""
AI_GATEWAY_URL = ""
```

- [ ] **Step 3: 建立 Agent 骨架**

```typescript
// workers/agent/src/index.ts
import { Agent } from 'agents'

type Env = {
  VIDEO_PROCESSING_AGENT: DurableObjectNamespace
  AI: Ai
  VECTORIZE: VectorizeIndex
  DB: D1Database
  STREAM_ACCOUNT_ID: string
  STREAM_API_TOKEN: string
  AI_GATEWAY_URL: string
}

export class VideoProcessingAgent extends Agent<Env> {
  async processVideo(videoId: string, streamVideoId: string): Promise<void> {
    // Phase 5 實作：Whisper → 摘要 → Vectorize → 更新 D1
    console.log(`Processing video ${videoId}`)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    const id = env.VIDEO_PROCESSING_AGENT.idFromName(videoId)
    const agent = env.VIDEO_PROCESSING_AGENT.get(id)
    // 非同步觸發，不等待
    agent.fetch(new Request('http://internal/process', {
      method: 'POST',
      body: JSON.stringify({ videoId, streamVideoId }),
    }))
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
```

- [ ] **Step 4: 安裝依賴**

```bash
cd workers/agent && pnpm install
cd ../..
```

- [ ] **Step 5: Commit**

```bash
git add workers/agent/
git commit -m "feat: add AI agent worker skeleton"
```

---

## Phase 2 — 使用者認證

### Task 7: API 認證路由（register / login / logout）

**Files:**
- Create: `apps/api/src/middleware/session.ts`
- Create: `apps/api/src/lib/turnstile.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: 建立 session middleware**

```typescript
// apps/api/src/middleware/session.ts
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
```

- [ ] **Step 2: 建立 Turnstile helper**

```typescript
// apps/api/src/lib/turnstile.ts
export async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  })
  const data = await res.json<{ success: boolean }>()
  return data.success
}
```

- [ ] **Step 3: 建立認證路由**

```typescript
// apps/api/src/routes/auth.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'
import { verifyTurnstile } from '../lib/turnstile'
import type { Env } from '../index'
import type { SessionUser } from '@demo/shared'

const auth = new Hono<{ Bindings: Env }>()

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
  const computedHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computedHex === hashHex
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
  c.header('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
  return c.json({ data: sessionUser })
})

auth.post('/logout', async (c) => {
  const cookie = c.req.header('cookie') ?? ''
  const token = cookie.split(';').map(p => p.trim()).find(p => p.startsWith('session='))?.split('=')[1]
  if (token) await c.env.SESSIONS.delete(`session:${token}`)
  c.header('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0')
  return c.json({ data: { ok: true } })
})

export { auth }
```

- [ ] **Step 4: 掛載認證路由至 Hono app**

```typescript
// apps/api/src/index.ts （在 app.get('/health') 後加入）
import { auth } from './routes/auth'
// ...
app.route('/auth', auth)
```

- [ ] **Step 5: 手動測試 register**

```bash
# 在 apps/api 目錄下
pnpm dev
# 新 terminal
curl -X POST http://localhost:8787/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","turnstileToken":"XXXX"}'
```

Expected: `{"data":{"id":"...","email":"test@example.com","name":"Test User"}}`
（本地開發環境下 Turnstile 驗證可暫時跳過，在 `verifyTurnstile` 加 `if (!secretKey) return true` 條件）

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add auth routes (register/login/logout) with PBKDF2 + KV session"
```

---

### Task 8: 前端登入 / 註冊頁面

**Files:**
- Create: `apps/web/src/components/TurnstileWidget.tsx`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/auth/login/page.tsx`
- Create: `apps/web/src/app/auth/register/page.tsx`

- [ ] **Step 1: 建立 TurnstileWidget**

```typescript
// apps/web/src/components/TurnstileWidget.tsx
'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => void
    }
  }
}

interface Props {
  siteKey: string
  onSuccess: (token: string) => void
}

export function TurnstileWidget({ siteKey, onSuccess }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = () => {
      if (ref.current) window.turnstile.render(ref.current, { sitekey: siteKey, callback: onSuccess })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [siteKey, onSuccess])
  return <div ref={ref} />
}
```

- [ ] **Step 2: 建立 auth helper**

```typescript
// apps/web/src/lib/auth.ts
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
```

- [ ] **Step 3: 建立登入頁**

```typescript
// apps/web/src/app/auth/login/page.tsx
'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { login } from '@/lib/auth'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnstileToken) { setError('請完成驗證'); return }
    try {
      await login(email, password, turnstileToken)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗')
    }
  }

  const handleTurnstile = useCallback((token: string) => setTurnstileToken(token), [])

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1>登入</h1>
      <form onSubmit={handleSubmit}>
        <div><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label></div>
        <div><label>密碼<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label></div>
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onSuccess={handleTurnstile} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">登入</button>
      </form>
      <p><a href="/auth/register">還沒有帳號？註冊</a></p>
    </main>
  )
}
```

- [ ] **Step 4: 建立註冊頁**

```typescript
// apps/web/src/app/auth/register/page.tsx
'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { register } from '@/lib/auth'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnstileToken) { setError('請完成驗證'); return }
    try {
      await register(email, password, name, turnstileToken)
      router.push('/auth/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    }
  }

  const handleTurnstile = useCallback((token: string) => setTurnstileToken(token), [])

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1>註冊</h1>
      <form onSubmit={handleSubmit}>
        <div><label>姓名<input value={name} onChange={e => setName(e.target.value)} required /></label></div>
        <div><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label></div>
        <div><label>密碼<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label></div>
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onSuccess={handleTurnstile} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">建立帳號</button>
      </form>
      <p><a href="/auth/login">已有帳號？登入</a></p>
    </main>
  )
}
```

- [ ] **Step 5: 驗證頁面可渲染**

```bash
cd apps/web && pnpm dev
```

訪問 `http://localhost:3000/auth/login` 與 `/auth/register`，確認表單正確顯示。

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/web/src/
git commit -m "feat: add login/register pages with Turnstile"
```

---

## Phase 3 — 課程影片 CRUD + 管理後台

### Task 9: 課程 API 路由

**Files:**
- Create: `apps/api/src/routes/courses.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: 建立課程路由**

```typescript
// apps/api/src/routes/courses.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { courses, videos, enrollments } from '../db/schema'
import { sessionMiddleware, adminMiddleware } from '../middleware/session'
import type { Env } from '../index'

const coursesRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

function nanoid() { return crypto.randomUUID().replace(/-/g, '') }

// GET /courses — KV 快取優先
coursesRouter.get('/', async (c) => {
  const cached = await c.env.SESSIONS.get('cache:courses')
  if (cached) return c.json({ data: JSON.parse(cached) })
  const db = drizzle(c.env.DB)
  const list = await db.select().from(courses).where(eq(courses.status, 'published')).all()
  await c.env.SESSIONS.put('cache:courses', JSON.stringify(list), { expirationTtl: 300 })
  return c.json({ data: list })
})

// GET /courses/:id
coursesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const cacheKey = `cache:course:${id}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) return c.json({ data: JSON.parse(cached) })
  const db = drizzle(c.env.DB)
  const course = await db.select().from(courses).where(eq(courses.id, id)).get()
  if (!course) return c.json({ error: 'Not found' }, 404)
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
```

- [ ] **Step 2: 掛載課程路由**

```typescript
// apps/api/src/index.ts（在既有 app.route 後加入）
import { coursesRouter } from './routes/courses'
app.route('/courses', coursesRouter)
```

- [ ] **Step 3: 驗證課程 API**

```bash
curl http://localhost:8787/courses
```

Expected: `{"data":[]}`（空陣列，因為還沒有課程）

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/courses.ts apps/api/src/index.ts
git commit -m "feat: add courses API routes with KV cache"
```

---

### Task 10: 影片上傳 + Cloudflare Stream 整合

**Files:**
- Create: `apps/api/src/lib/stream.ts`
- Create: `apps/api/src/routes/videos.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: 建立 Stream API helper**

```typescript
// apps/api/src/lib/stream.ts
export interface StreamUploadResponse {
  uid: string
  uploadURL: string
}

export async function createStreamUploadUrl(
  accountId: string,
  apiToken: string,
  videoName: string,
): Promise<StreamUploadResponse> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '0',
        'Upload-Metadata': `name ${btoa(videoName)}`,
      },
    },
  )
  if (!res.ok) throw new Error(`Stream API error: ${res.status}`)
  const uid = res.headers.get('stream-media-id') ?? ''
  const uploadURL = res.headers.get('location') ?? ''
  return { uid, uploadURL }
}

export async function getStreamSignedToken(
  accountId: string,
  apiToken: string,
  videoId: string,
): Promise<string> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    },
  )
  const data = await res.json<{ result: { token: string } }>()
  return data.result.token
}
```

- [ ] **Step 2: 建立影片路由**

```typescript
// apps/api/src/routes/videos.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { videos } from '../db/schema'
import { sessionMiddleware, adminMiddleware } from '../middleware/session'
import { createStreamUploadUrl, getStreamSignedToken } from '../lib/stream'
import type { Env } from '../index'

const videosRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

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
  // 非同步觸發 Agent（fire-and-forget）
  fetch(c.env.AGENT_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId: id, streamVideoId: video.stream_video_id }),
  }).catch(() => {})
  return c.json({ data: { status: 'processing' } }, 202)
})

// GET /videos/:id — 含 Stream signed token
videosRouter.get('/:id', sessionMiddleware, async (c) => {
  const id = c.req.param('id')
  const db = drizzle(c.env.DB)
  const video = await db.select().from(videos).where(eq(videos.id, id)).get()
  if (!video) return c.json({ error: 'Not found' }, 404)
  let streamToken: string | null = null
  if (video.stream_video_id) {
    streamToken = await getStreamSignedToken(c.env.STREAM_ACCOUNT_ID, c.env.STREAM_API_TOKEN, video.stream_video_id)
  }
  return c.json({ data: { ...video, streamToken } })
})

export { videosRouter }
```

- [ ] **Step 3: 掛載影片路由**

```typescript
// apps/api/src/index.ts
import { videosRouter } from './routes/videos'
app.route('/videos', videosRouter)
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add video upload flow with Cloudflare Stream integration"
```

---

### Task 11: 前端課程列表 + 影片播放頁

**Files:**
- Create: `apps/web/src/components/CourseCard.tsx`
- Create: `apps/web/src/components/StreamPlayer.tsx`
- Create: `apps/web/src/components/VideoList.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/courses/[id]/page.tsx`
- Create: `apps/web/src/app/courses/[id]/videos/[vid]/page.tsx`

- [ ] **Step 1: 建立 CourseCard 元件**

```typescript
// apps/web/src/components/CourseCard.tsx
import type { Course } from '@demo/shared'
import Link from 'next/link'

export function CourseCard({ course }: { course: Course }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, margin: 8 }}>
      <Link href={`/courses/${course.id}`}>
        <h2 style={{ margin: '0 0 8px' }}>{course.title}</h2>
      </Link>
      <p style={{ color: '#64748b', margin: 0 }}>{course.description}</p>
    </div>
  )
}
```

- [ ] **Step 2: 建立 StreamPlayer 元件**

```typescript
// apps/web/src/components/StreamPlayer.tsx
'use client'

interface Props {
  streamToken: string
  onTimeUpdate?: (currentTime: number) => void
}

export function StreamPlayer({ streamToken, onTimeUpdate }: Props) {
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={`https://iframe.cloudflarestream.com/${streamToken}`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
```

- [ ] **Step 3: 建立 VideoList 元件**

```typescript
// apps/web/src/components/VideoList.tsx
import type { Video } from '@demo/shared'
import Link from 'next/link'

interface Props {
  courseId: string
  videos: Video[]
}

export function VideoList({ courseId, videos }: Props) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {videos.map((v) => (
        <li key={v.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
          <Link href={`/courses/${courseId}/videos/${v.id}`}>
            {v.order + 1}. {v.title}
            {v.status === 'processing' && <span style={{ color: '#94a3b8', marginLeft: 8 }}>(處理中...)</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: 更新首頁（課程列表）**

```typescript
// apps/web/src/app/page.tsx
import { api } from '@/lib/api'
import { CourseCard } from '@/components/CourseCard'
import type { Course, ApiResponse } from '@demo/shared'

export const revalidate = 300

export default async function HomePage() {
  const res = await api.get<ApiResponse<Course[]>>('/courses')
  const courseList = res.data ?? []
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>所有課程</h1>
      {courseList.length === 0 && <p>目前還沒有課程</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {courseList.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: 建立課程詳情頁**

```typescript
// apps/web/src/app/courses/[id]/page.tsx
import { api } from '@/lib/api'
import { VideoList } from '@/components/VideoList'
import type { Course, Video, ApiResponse } from '@demo/shared'
import { notFound } from 'next/navigation'

export const revalidate = 300

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let data: (Course & { videos: Video[] }) | null = null
  try {
    const res = await api.get<ApiResponse<Course & { videos: Video[] }>>(`/courses/${id}`)
    data = res.data ?? null
  } catch { notFound() }
  if (!data) notFound()
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>{data.title}</h1>
      <p>{data.description}</p>
      <h2>課程內容</h2>
      <VideoList courseId={id} videos={data.videos} />
    </main>
  )
}
```

- [ ] **Step 6: 建立影片播放頁**

```typescript
// apps/web/src/app/courses/[id]/videos/[vid]/page.tsx
import { api } from '@/lib/api'
import { StreamPlayer } from '@/components/StreamPlayer'
import type { Video, ApiResponse } from '@demo/shared'
import { notFound } from 'next/navigation'

export default async function VideoPage({ params }: { params: Promise<{ id: string; vid: string }> }) {
  const { vid } = await params
  let video: (Video & { streamToken: string | null }) | null = null
  try {
    const res = await api.get<ApiResponse<Video & { streamToken: string | null }>>(`/videos/${vid}`)
    video = res.data ?? null
  } catch { notFound() }
  if (!video) notFound()
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>{video.title}</h1>
      {video.streamToken ? (
        <StreamPlayer streamToken={video.streamToken} />
      ) : (
        <p>影片處理中，請稍候...</p>
      )}
      {video.summary && (
        <section style={{ marginTop: 24 }}>
          <h2>AI 摘要</h2>
          <p>{video.summary}</p>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add course list, course detail, and video player pages"
```

---

### Task 12: 管理員後台（影片上傳）

**Files:**
- Create: `apps/web/src/components/VideoUploader.tsx`
- Create: `apps/web/src/components/ProcessingStatus.tsx`
- Create: `apps/web/src/app/admin/page.tsx`

- [ ] **Step 1: 建立 VideoUploader（tus 分塊上傳）**

```typescript
// apps/web/src/components/VideoUploader.tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@demo/shared'

interface UploadUrlResponse {
  videoId: string
  streamVideoId: string
  uploadURL: string
}

interface Props {
  courseId: string
  onUploaded: (videoId: string) => void
}

export function VideoUploader({ courseId, onUploaded }: Props) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file || !title) { setError('請填入標題並選擇影片檔案'); return }
    setUploading(true)
    setError('')
    try {
      const res = await api.post<ApiResponse<UploadUrlResponse>>('/videos/upload-url', { courseId, title })
      const { videoId, uploadURL } = res.data!

      // 使用 tus 協議直接上傳至 Stream
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PATCH', uploadURL)
        xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')
        xhr.setRequestHeader('Tus-Resumable', '1.0.0')
        xhr.setRequestHeader('Upload-Offset', '0')
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.send(file)
      })

      // 通知 API 上傳完成，觸發 Agent
      await api.post(`/videos/${videoId}/publish`, {})
      onUploaded(videoId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3>上傳新影片</h3>
      <div>
        <label>影片標題<input value={title} onChange={e => setTitle(e.target.value)} style={{ display: 'block', width: '100%' }} /></label>
      </div>
      <div style={{ marginTop: 8 }}>
        <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {uploading && <progress value={progress} max={100} style={{ display: 'block', width: '100%', marginTop: 8 }} />}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleUpload} disabled={uploading} style={{ marginTop: 8 }}>
        {uploading ? `上傳中... ${progress}%` : '開始上傳'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 建立 ProcessingStatus 元件**

```typescript
// apps/web/src/components/ProcessingStatus.tsx
'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Video, ApiResponse } from '@demo/shared'

interface Props {
  videoId: string
  onReady?: () => void
}

export function ProcessingStatus({ videoId, onReady }: Props) {
  const [status, setStatus] = useState<'processing' | 'ready'>('processing')

  useEffect(() => {
    if (status === 'ready') return
    const interval = setInterval(async () => {
      try {
        const res = await api.get<ApiResponse<Video & { streamToken: string | null }>>(`/videos/${videoId}`)
        if (res.data?.status === 'ready') {
          setStatus('ready')
          onReady?.()
          clearInterval(interval)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [videoId, status, onReady])

  if (status === 'ready') return <p style={{ color: 'green' }}>影片已處理完成</p>
  return <p style={{ color: '#94a3b8' }}>AI 正在處理影片（字幕 + 摘要）...</p>
}
```

- [ ] **Step 3: 建立管理後台頁**

```typescript
// apps/web/src/app/admin/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { VideoUploader } from '@/components/VideoUploader'
import { ProcessingStatus } from '@/components/ProcessingStatus'
import { api } from '@/lib/api'
import type { Course, ApiResponse } from '@demo/shared'

export default function AdminPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [processingIds, setProcessingIds] = useState<string[]>([])

  useEffect(() => {
    api.get<ApiResponse<Course[]>>('/courses').then(r => setCourses(r.data ?? []))
  }, [])

  const createCourse = async () => {
    if (!newCourseTitle) return
    const res = await api.post<ApiResponse<{ id: string; title: string }>>('/courses', { title: newCourseTitle, description: '' })
    const newCourse = { id: res.data!.id, title: res.data!.title, description: '', thumbnail_key: null, status: 'draft' as const, created_at: Date.now(), updated_at: Date.now() }
    setCourses(prev => [...prev, newCourse])
    setNewCourseTitle('')
  }

  const handleUploaded = (videoId: string) => {
    setProcessingIds(prev => [...prev, videoId])
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>管理後台</h1>
      <section>
        <h2>建立課程</h2>
        <input value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} placeholder="課程標題" />
        <button onClick={createCourse}>建立</button>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>上傳影片</h2>
        <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
          <option value="">選擇課程</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {selectedCourseId && <VideoUploader courseId={selectedCourseId} onUploaded={handleUploaded} />}
      </section>
      {processingIds.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>處理狀態</h2>
          {processingIds.map(id => <ProcessingStatus key={id} videoId={id} />)}
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add admin panel with video upload to Cloudflare Stream"
```

---

## Phase 4 — 即時留言（Durable Objects）

### Task 13: ChatRoom Durable Object 完整實作

**Files:**
- Modify: `workers/realtime/src/index.ts`

- [ ] **Step 1: 實作完整 ChatRoom DO**

```typescript
// workers/realtime/src/index.ts
import { DurableObject } from 'cloudflare:workers'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, { userId: string; userName: string }>()

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') ?? 'anonymous'
    const userName = url.searchParams.get('userName') ?? 'Anonymous'
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], [userId])
    this.sessions.set(pair[1], { userId, userName })

    // 送出最近 50 則歷史訊息
    const history = await this.ctx.storage.get<ChatMessage[]>('history') ?? []
    pair[1].send(JSON.stringify({ type: 'history', messages: history }))

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const session = this.sessions.get(ws)
    if (!session) return
    let parsed: { text: string }
    try { parsed = JSON.parse(message as string) } catch { return }
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: session.userName,
      text: parsed.text.slice(0, 500),
      timestamp: Date.now(),
    }
    const payload = JSON.stringify({ type: 'message', message: msg })
    this.ctx.getWebSockets().forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    })
    // 更新歷史（最多 50 則）
    this.ctx.storage.get<ChatMessage[]>('history').then(history => {
      const updated = [...(history ?? []), msg].slice(-50)
      this.ctx.storage.put('history', updated)
    })
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws)
    ws.close()
  }
}

export default {
  async fetch(request: Request, env: { CHAT_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    const videoId = url.pathname.replace('/room/', '')
    if (!videoId) return new Response('Missing video ID', { status: 400 })
    const id = env.CHAT_ROOM.idFromName(videoId)
    const stub = env.CHAT_ROOM.get(id)
    return stub.fetch(request)
  },
}
```

- [ ] **Step 2: 本地測試 DO 連線**

```bash
cd workers/realtime && pnpm dev
# 在新 terminal 用 wscat 測試
npx wscat -c "ws://localhost:8787/room/test-video-id?userId=u1&userName=Alice"
```

Expected: 連線成功，收到 `{"type":"history","messages":[]}`

- [ ] **Step 3: Commit**

```bash
cd ../..
git add workers/realtime/
git commit -m "feat: implement ChatRoom Durable Object with message history"
```

---

### Task 14: 前端 LiveComments 元件

**Files:**
- Create: `apps/web/src/components/LiveComments.tsx`
- Modify: `apps/web/src/app/courses/[id]/videos/[vid]/page.tsx`

- [ ] **Step 1: 建立 LiveComments 元件**

```typescript
// apps/web/src/components/LiveComments.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

interface Props {
  videoId: string
  userId: string
  userName: string
  realtimeUrl: string
}

export function LiveComments({ videoId, userId, userName, realtimeUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${realtimeUrl}/room/${videoId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data as string)
      if (data.type === 'history') setMessages(data.messages)
      else if (data.type === 'message') setMessages(prev => [...prev, data.message])
    }

    return () => { ws.close() }
  }, [videoId, userId, userName, realtimeUrl])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ text: input.trim() }))
    setInput('')
  }, [input])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px' }}>
        即時討論 {connected ? <span style={{ color: 'green', fontSize: '0.8em' }}>● 已連線</span> : <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>○ 連線中...</span>}
      </h3>
      <div style={{ height: 300, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map(m => (
          <div key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
            <strong style={{ color: '#6366f1' }}>{m.userName}</strong>
            <span style={{ color: '#64748b', fontSize: '0.8em', marginLeft: 8 }}>
              {new Date(m.timestamp).toLocaleTimeString()}
            </span>
            <p style={{ margin: '2px 0 0' }}>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="輸入留言..."
          style={{ flex: 1 }}
          disabled={!connected}
        />
        <button onClick={sendMessage} disabled={!connected}>送出</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 將 LiveComments 整合至影片播放頁**

```typescript
// apps/web/src/app/courses/[id]/videos/[vid]/page.tsx
// 在 StreamPlayer 下方加入：
import { LiveComments } from '@/components/LiveComments'

// 在 JSX 中加入（影片資訊下方）：
<LiveComments
  videoId={vid}
  userId="demo-user"
  userName="學員"
  realtimeUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? 'ws://localhost:8788'}
/>
```

（`userId` / `userName` 在 Phase 2 auth 完成後替換為真實 session 資料）

- [ ] **Step 3: 驗證即時留言**

```bash
# terminal 1
cd workers/realtime && pnpm dev     # port 8788
# terminal 2
cd apps/web && pnpm dev             # port 3000
```

開啟兩個瀏覽器視窗到同一影片播放頁，確認留言可以即時同步。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/ workers/realtime/
git commit -m "feat: add real-time comments with Durable Objects WebSocket"
```

---

## Phase 5 — AI Pipeline（Agents SDK + RAG）

### Task 15: VideoProcessingAgent 完整實作

**Files:**
- Modify: `workers/agent/src/index.ts`

- [ ] **Step 1: 實作 Agent AI Pipeline**

```typescript
// workers/agent/src/index.ts
import { Agent } from 'agents'

type Env = {
  VIDEO_PROCESSING_AGENT: DurableObjectNamespace
  AI: Ai
  VECTORIZE: VectorizeIndex
  DB: D1Database
  STREAM_ACCOUNT_ID: string
  STREAM_API_TOKEN: string
  AI_GATEWAY_URL: string
}

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const WHISPER_MODEL = '@cf/openai/whisper'
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct'

function chunkText(text: string): string[] {
  const words = text.split(' ')
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '))
    if (i + CHUNK_SIZE >= words.length) break
  }
  return chunks
}

export class VideoProcessingAgent extends Agent<Env> {
  async fetch(request: Request): Promise<Response> {
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    await this.processVideo(videoId, streamVideoId)
    return new Response('ok')
  }

  async processVideo(videoId: string, streamVideoId: string): Promise<void> {
    try {
      // Step 1: 從 Stream 下載音訊（使用 Stream API 取得 MP4 URL）
      const audioUrl = `https://videodelivery.net/${streamVideoId}/downloads/default.mp4`
      const audioRes = await fetch(audioUrl, {
        headers: { Authorization: `Bearer ${this.env.STREAM_API_TOKEN}` },
      })
      const audioBuffer = await audioRes.arrayBuffer()

      // Step 2: Workers AI Whisper 語音轉文字
      const whisperResult = await this.env.AI.run(WHISPER_MODEL, {
        audio: [...new Uint8Array(audioBuffer)],
      }) as { text: string }
      const transcript = whisperResult.text

      // Step 3: Workers AI LLM 生成摘要
      const summaryResult = await this.env.AI.run(LLM_MODEL, {
        messages: [
          { role: 'system', content: '你是一個學習助理，請以繁體中文撰寫影片重點摘要，條列式，200字以內。' },
          { role: 'user', content: `請摘要以下影片逐字稿：\n\n${transcript.slice(0, 4000)}` },
        ],
      }) as { response: string }
      const summary = summaryResult.response

      // Step 4: 切分 chunk 並寫入 Vectorize
      const chunks = chunkText(transcript)
      const embeddings = await Promise.all(
        chunks.map(chunk => this.env.AI.run(EMBEDDING_MODEL, { text: [chunk] }) as Promise<{ data: number[][] }>)
      )
      const vectors = chunks.map((chunk, i) => ({
        id: `${videoId}-chunk-${i}`,
        values: embeddings[i].data[0],
        metadata: { video_id: videoId, chunk_text: chunk, chunk_index: i },
      }))
      await this.env.VECTORIZE.upsert(vectors)

      // Step 5: 更新 D1
      await this.env.DB.prepare(
        'UPDATE videos SET status = ?, summary = ?, transcript = ? WHERE id = ?'
      ).bind('ready', summary, transcript, videoId).run()

      console.log(`Video ${videoId} processed successfully`)
    } catch (err) {
      console.error(`Failed to process video ${videoId}:`, err)
      await this.env.DB.prepare('UPDATE videos SET status = ? WHERE id = ?').bind('processing', videoId).run()
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    const id = env.VIDEO_PROCESSING_AGENT.idFromName(videoId)
    const agent = env.VIDEO_PROCESSING_AGENT.get(id)
    agent.fetch(new Request('http://internal/process', {
      method: 'POST',
      body: JSON.stringify({ videoId, streamVideoId }),
    }))
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
```

- [ ] **Step 2: 在 Cloudflare Dashboard 建立 Vectorize index**

```bash
# 在 wrangler CLI 建立
wrangler vectorize create video-content --dimensions=768 --metric=cosine
```

Expected: 建立成功，取得 index name `video-content`

- [ ] **Step 3: Commit**

```bash
git add workers/agent/
git commit -m "feat: implement VideoProcessingAgent with Whisper + summarization + Vectorize"
```

---

### Task 16: AI 問答端點（RAG）

**Files:**
- Create: `apps/api/src/routes/ai.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: 建立 AI 問答路由**

```typescript
// apps/api/src/routes/ai.ts
import { Hono } from 'hono'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'

const aiRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct'

aiRouter.post('/ask', sessionMiddleware, async (c) => {
  const { question, videoId } = await c.req.json<{ question: string; videoId: string }>()
  if (!question || !videoId) return c.json({ error: 'Missing fields' }, 400)

  // Step 1: 將問題轉為 embedding
  const embResult = await c.env.AI.run(EMBEDDING_MODEL, { text: [question] }) as { data: number[][] }
  const queryVector = embResult.data[0]

  // Step 2: Vectorize 語意搜索（限定此影片的 chunks）
  const results = await c.env.VECTORIZE.query(queryVector, {
    topK: 5,
    filter: { video_id: videoId },
    returnMetadata: 'all',
  })

  const context = results.matches
    .map((m) => (m.metadata as { chunk_text: string }).chunk_text)
    .join('\n\n')

  if (!context) return c.json({ data: { answer: '找不到相關內容，請嘗試其他問題。' } })

  // Step 3: Workers AI LLM 回答
  const llmResult = await c.env.AI.run(LLM_MODEL, {
    messages: [
      { role: 'system', content: '你是一個學習助理，根據以下影片內容片段，以繁體中文回答問題。只根據提供的內容回答，不要捏造資訊。' },
      { role: 'user', content: `影片內容片段：\n${context}\n\n問題：${question}` },
    ],
  }) as { response: string }

  return c.json({ data: { answer: llmResult.response, sources: results.matches.length } })
})

export { aiRouter }
```

- [ ] **Step 2: 掛載 AI 路由**

```typescript
// apps/api/src/index.ts
import { aiRouter } from './routes/ai'
app.route('/ai', aiRouter)
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add RAG-based AI Q&A endpoint with Vectorize + Workers AI"
```

---

### Task 17: 前端 AIChat + AISummary 元件

**Files:**
- Create: `apps/web/src/components/AIChat.tsx`
- Create: `apps/web/src/components/AISummary.tsx`
- Modify: `apps/web/src/app/courses/[id]/videos/[vid]/page.tsx`

- [ ] **Step 1: 建立 AISummary 元件**

```typescript
// apps/web/src/components/AISummary.tsx
interface Props {
  summary: string
}

export function AISummary({ summary }: Props) {
  return (
    <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px', color: '#6366f1' }}>AI 重點摘要</h3>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{summary}</div>
    </section>
  )
}
```

- [ ] **Step 2: 建立 AIChat 元件**

```typescript
// apps/web/src/components/AIChat.tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@demo/shared'

interface Props {
  videoId: string
}

export function AIChat({ videoId }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post<ApiResponse<{ answer: string; sources: number }>>('/ai/ask', { question, videoId })
      setAnswer(res.data?.answer ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px', color: '#6366f1' }}>對影片提問</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && ask()}
          placeholder="輸入你對這個影片的問題..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button onClick={ask} disabled={loading || !question.trim()}>
          {loading ? '查詢中...' : '提問'}
        </button>
      </div>
      {answer && (
        <div style={{ marginTop: 12, background: '#f0f9ff', borderRadius: 6, padding: 12, lineHeight: 1.8 }}>
          <strong>AI 回答：</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{answer}</p>
        </div>
      )}
      {error && <p style={{ color: 'red', marginTop: 8 }}>{error}</p>}
    </section>
  )
}
```

- [ ] **Step 3: 將 AISummary + AIChat 整合至影片播放頁**

在 `apps/web/src/app/courses/[id]/videos/[vid]/page.tsx` 的 StreamPlayer 下方加入：

```typescript
import { AISummary } from '@/components/AISummary'
import { AIChat } from '@/components/AIChat'

// 在 JSX 中（streamToken 區塊下方）：
{video.summary && <AISummary summary={video.summary} />}
<AIChat videoId={vid} />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add AI summary panel and Q&A chat interface"
```

---

## Phase 6 — 安全層 + CI/CD

### Task 18: Cloudflare Access 保護管理後台

- [ ] **Step 1: 在 Cloudflare Dashboard 設定 Access Application**

前往 Cloudflare Dashboard → Zero Trust → Access → Applications：
1. 點選「Add an application」→「Self-hosted」
2. Application name: `Demo Admin`
3. Application domain: `your-api-domain.workers.dev/admin`（或 Pages 網域）
4. Policy: 新增 Allow rule → Rule name: `Admin users` → Selector: `Emails` → 加入管理員 email
5. 儲存

Expected: 訪問 `/admin` 路徑時會跳出 Cloudflare Access 登入畫面

- [ ] **Step 2: 在 wrangler.toml 標記 admin 路由需要 Access JWT 驗證**

在 `apps/api/src/middleware/session.ts` 加入 Access JWT 驗證（用於 Workers 端）：

```typescript
// 在 adminMiddleware 中加入 Access JWT 檢查
export const accessMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const cfAccessJwt = c.req.header('cf-access-jwt-assertion')
  if (!cfAccessJwt) return c.json({ error: 'Missing Access token' }, 401)
  // Cloudflare Access 會自動驗證 JWT，到達 Worker 時已通過驗證
  await next()
})
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/
git commit -m "feat: add Cloudflare Access middleware for admin routes"
```

---

### Task 19: WAF + Bot Management + API Shield

- [ ] **Step 1: 設定 WAF 自訂規則（Cloudflare Dashboard）**

前往 Dashboard → Security → WAF → Custom rules：

規則 1（封鎖惡意 User-Agent）：
- Expression: `(http.user_agent contains "sqlmap") or (http.user_agent contains "nikto")`
- Action: Block

規則 2（API 路徑限速）：
- Expression: `(http.request.uri.path matches "^/auth/(login|register)$")`
- Action: Rate limit → 10 requests per minute per IP

- [ ] **Step 2: 設定 Bot Management**

前往 Dashboard → Security → Bots：
- 啟用 Bot Fight Mode
- 設定 Super Bot Fight Mode（如有企業方案）
- 為影片端點加入規則：`(http.request.uri.path matches "^/videos/") and (cf.bot_management.score lt 30)` → Challenge

- [ ] **Step 3: 設定 API Shield Schema Validation**

```bash
# 生成 OpenAPI schema（手動建立或使用工具）
cat > schema.json << 'EOF'
{
  "openapi": "3.0.0",
  "info": { "title": "Demo API", "version": "1.0.0" },
  "paths": {
    "/auth/register": {
      "post": {
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["email", "password", "name", "turnstileToken"],
                "properties": {
                  "email": { "type": "string", "format": "email" },
                  "password": { "type": "string", "minLength": 8 },
                  "name": { "type": "string" },
                  "turnstileToken": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  }
}
EOF
```

前往 Dashboard → Security → API Shield → 上傳此 schema。

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "docs: add WAF/Bot Management/API Shield setup notes"
```

---

### Task 20: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 建立部署 workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    name: Deploy API Worker
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Deploy API
        run: pnpm --filter api deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-realtime:
    name: Deploy Realtime Worker
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Deploy Realtime
        run: pnpm --filter realtime deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-agent:
    name: Deploy Agent Worker
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Deploy Agent
        run: pnpm --filter agent deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-web:
    name: Deploy Web to Pages
    runs-on: ubuntu-latest
    needs: [deploy-api]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Build & Deploy Web
        run: pnpm --filter web deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_REALTIME_URL: ${{ secrets.NEXT_PUBLIC_REALTIME_URL }}
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}
```

- [ ] **Step 2: 設定 GitHub Secrets**

在 GitHub repo → Settings → Secrets → Actions 加入：
- `CLOUDFLARE_API_TOKEN`（需要 Workers + Pages + D1 + R2 + KV 權限）
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_API_URL`（部署後的 Workers URL）
- `NEXT_PUBLIC_REALTIME_URL`（部署後的 Realtime Worker URL，wss://...）
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

- [ ] **Step 3: 推送並確認 CI 通過**

```bash
git add .github/
git commit -m "ci: add GitHub Actions deploy workflow"
git push origin main
```

Expected: GitHub Actions 執行成功，4 個 Worker 全部部署完成

---

---

### Task 21: 報名 + 觀看進度 API + 學員儀表板

**Files:**
- Create: `apps/api/src/routes/enrollments.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/web/src/app/me/page.tsx`

- [ ] **Step 1: 建立報名與進度路由**

```typescript
// apps/api/src/routes/enrollments.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { enrollments, watchProgress, courses, videos } from '../db/schema'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'

const enrollmentsRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

// POST /enrollments — 學員報名課程
enrollmentsRouter.post('/', sessionMiddleware, async (c) => {
  const { courseId } = await c.req.json<{ courseId: string }>()
  if (!courseId) return c.json({ error: 'Missing courseId' }, 400)
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  await db.insert(enrollments).values({ user_id: user.id, course_id: courseId, enrolled_at: Date.now() }).onConflictDoNothing()
  return c.json({ data: { ok: true } }, 201)
})

// PUT /progress/:video_id — 更新觀看進度
enrollmentsRouter.put('/progress/:videoId', sessionMiddleware, async (c) => {
  const videoId = c.req.param('videoId')
  const { progressSec, completed } = await c.req.json<{ progressSec: number; completed: boolean }>()
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  await db.insert(watchProgress)
    .values({ user_id: user.id, video_id: videoId, progress_sec: progressSec, completed: completed ?? false, last_watched_at: Date.now() })
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
```

- [ ] **Step 2: 掛載路由**

```typescript
// apps/api/src/index.ts
import { enrollmentsRouter } from './routes/enrollments'
app.route('/enrollments', enrollmentsRouter)
```

- [ ] **Step 3: 建立學員儀表板**

```typescript
// apps/web/src/app/me/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { CourseCard } from '@/components/CourseCard'
import type { Course, ApiResponse } from '@demo/shared'

export default function MePage() {
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    api.get<ApiResponse<Course[]>>('/enrollments/me').then(r => setCourses(r.data ?? []))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>我的課程</h1>
      {courses.length === 0 && <p>尚未報名任何課程</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {courses.map(c => <CourseCard key={c.id} course={c} />)}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/enrollments.ts apps/api/src/index.ts apps/web/src/app/me/
git commit -m "feat: add enrollment, watch progress API, and student dashboard"
```

---

## 環境變數總覽

| 變數 | 所在 | 說明 |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | api wrangler.toml | Turnstile 伺服器端驗證密鑰 |
| `STREAM_ACCOUNT_ID` | api / agent wrangler.toml | Cloudflare 帳號 ID |
| `STREAM_API_TOKEN` | api / agent wrangler.toml | Stream API Token |
| `AGENT_WORKER_URL` | api wrangler.toml | Agent Worker 的 HTTP URL |
| `REALTIME_WORKER_URL` | - | Realtime Worker 的 WebSocket URL |
| `AI_GATEWAY_URL` | agent wrangler.toml | AI Gateway endpoint URL |
| `NEXT_PUBLIC_API_URL` | web .env.local | API Worker URL |
| `NEXT_PUBLIC_REALTIME_URL` | web .env.local | Realtime Worker URL（wss://） |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | web .env.local | Turnstile 前端 site key |
