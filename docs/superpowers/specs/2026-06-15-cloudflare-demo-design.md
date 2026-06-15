# Cloudflare Demo — 影音知識學習平台 設計文件

**日期：** 2026-06-15  
**狀態：** 已審核

---

## 概述

一個以「影音知識學習平台」為主題的全棧 Demo 應用，目的是透過實際業務邏輯學習 Cloudflare 開發者平台的各項功能。單一管理員負責上傳課程影片，學員可觀看影片、即時留言、並對影片內容提問 AI。

**涵蓋的 Cloudflare 服務：**
Pages、Workers、Durable Objects、Agents SDK、D1、KV、R2、Vectorize、Workers AI、AI Gateway、Cloudflare Stream、Cloudflare Images、Turnstile、WAF、API Shield、Bot Management、Cloudflare Access / Tunnel

---

## 架構

### Monorepo 結構（pnpm workspace）

```
cloudflare-demo/
├── apps/
│   ├── web/          # Next.js → Cloudflare Pages
│   └── api/          # Hono → Cloudflare Workers
├── workers/
│   ├── realtime/     # Durable Objects（WebSocket 留言室）
│   └── agent/        # Agents SDK（AI 自動處理 Pipeline）
└── packages/
    └── shared/       # 共享 TypeScript 型別與工具函式
```

### Package 職責與對應服務

| Package | 部署目標 | Cloudflare 服務 |
|---|---|---|
| `apps/web` | Cloudflare Pages | Pages, Images |
| `apps/api` | Cloudflare Workers | Workers, D1, KV, R2, Vectorize, Workers AI, Stream, Turnstile |
| `workers/realtime` | Workers + DO | Durable Objects |
| `workers/agent` | Cloudflare Workers | Agents SDK, Workers AI, AI Gateway, Vectorize, D1 |

---

## 資料模型

### D1（SQLite）

```sql
-- 使用者
users (id TEXT PK, email TEXT UNIQUE, password_hash TEXT, name TEXT,
       role TEXT CHECK(role IN ('admin','student')), created_at INTEGER)

-- 課程
courses (id TEXT PK, title TEXT, description TEXT,
         thumbnail_key TEXT,  -- R2 key
         status TEXT CHECK(status IN ('draft','published')),
         created_at INTEGER, updated_at INTEGER)

-- 影片
videos (id TEXT PK, course_id TEXT FK, title TEXT, order INTEGER,
        stream_video_id TEXT,  -- Cloudflare Stream
        status TEXT CHECK(status IN ('processing','ready')),
        summary TEXT,          -- Agent 生成
        transcript TEXT,       -- Whisper 生成
        created_at INTEGER)

-- 報名
enrollments (user_id TEXT, course_id TEXT, enrolled_at INTEGER,
             PRIMARY KEY (user_id, course_id))

-- 觀看進度
watch_progress (user_id TEXT, video_id TEXT, progress_sec INTEGER,
                completed BOOLEAN, last_watched_at INTEGER,
                PRIMARY KEY (user_id, video_id))
```

### KV

| Key 格式 | 內容 | TTL |
|---|---|---|
| `session:{token}` | 使用者 JSON | 7 天 |
| `course:{id}` | 課程詳情 JSON | 5 分鐘 |

### R2（cloudflare-demo-bucket）

| Key 格式 | 用途 |
|---|---|
| `thumbnails/{course_id}.jpg` | 課程縮圖 |
| `uploads/{video_id}/original` | 影片上傳暫存 |

### Vectorize（video-content index）

每個影片逐字稿切分為 chunk，各自 embedding 後寫入：
- vector：transcript chunk embedding
- metadata：`{ video_id, course_id, chunk_text }`

---

## API 設計

### apps/api — Hono on Workers（base: `/api`）

#### 認證
| Method | Path | 說明 |
|---|---|---|
| POST | `/auth/register` | 建立帳號，Turnstile 驗證 |
| POST | `/auth/login` | 驗證密碼，寫入 KV session |
| POST | `/auth/logout` | 刪除 KV session |

#### 課程
| Method | Path | 說明 |
|---|---|---|
| GET | `/courses` | 課程列表（KV 快取 → D1） |
| GET | `/courses/:id` | 課程詳情 + 影片列表 |
| POST | `/courses` | 建立課程（Admin） |
| PUT | `/courses/:id` | 更新課程（Admin） |

#### 影片
| Method | Path | 說明 |
|---|---|---|
| POST | `/videos/upload-url` | 取得 R2 presigned URL（Admin） |
| POST | `/videos/:id/publish` | 上傳完成 → 觸發 Agent |
| GET | `/videos/:id` | Stream signed token + D1 資料 |

#### 學習
| Method | Path | 說明 |
|---|---|---|
| POST | `/enrollments` | 學員報名課程 |
| PUT | `/progress/:video_id` | 更新觀看進度 |
| POST | `/ai/ask` | RAG 問答（Vectorize + Workers AI） |
| GET | `/images/:key` | R2 + Cloudflare Images 轉換 |

### workers/realtime — Durable Objects

| Protocol | Path | 說明 |
|---|---|---|
| WebSocket | `/room/:video_id` | 影片留言室（每影片一個 DO 實例） |

DO Storage 保存最近 50 則留言，連線時一次推送給新加入者。

### workers/agent — Agents SDK

由 `POST /videos/:id/publish` HTTP 呼叫觸發，依序執行：

1. 從 Stream 取得影片音訊
2. Workers AI Whisper → 生成逐字稿
3. Workers AI LLM → 生成 AI 摘要
4. Vectorize → 切分 chunk 並寫入向量索引
5. D1 → 更新 `videos.status = 'ready'`，寫入 transcript、summary

所有 AI 呼叫透過 AI Gateway 路由（快取 + 費用監控）。

---

## 前端頁面（apps/web — Next.js）

| 路徑 | 頁面 | 主要元件 |
|---|---|---|
| `/` | 課程列表首頁（SSR） | `CourseCard`（縮圖 + 標題 + 進度） |
| `/auth/login` | 登入 | `LoginForm` + `TurnstileWidget` |
| `/auth/register` | 註冊 | `RegisterForm` + `TurnstileWidget` |
| `/courses/[id]` | 課程詳情 | `VideoList`、`EnrollButton` |
| `/courses/[id]/videos/[vid]` | 影片播放 | `StreamPlayer`、`AISummary`、`AIChat`、`LiveComments` |
| `/admin` | 管理後台（Access 保護） | `CourseEditor`、`VideoUploader`、`ProcessingStatus` |
| `/me` | 學員儀表板 | `EnrolledCourses`、`WatchHistory` |

---

## 安全層

所有服務透過 Cloudflare Dashboard 設定，不需要額外程式碼：

| 服務 | 用途 |
|---|---|
| Turnstile | 登入 / 註冊表單防機器人 |
| WAF | 自訂規則阻擋惡意請求 |
| Bot Management | 防止爬蟲盜取影片資源 |
| API Shield | Schema 驗證 API 請求格式 |
| Cloudflare Access | `/admin` 後台零信任存取 |
| Cloudflare Tunnel | 本地管理服務暴露至公網（開發用） |
| AI Gateway | AI 請求快取 + 費用控管 |

---

## 部署策略

| Package | 部署方式 | 指令 |
|---|---|---|
| `apps/web` | Pages Git 整合，push 自動觸發 | `wrangler pages deploy` |
| `apps/api` | GitHub Actions | `wrangler deploy` |
| `workers/realtime` | GitHub Actions | `wrangler deploy` |
| `workers/agent` | GitHub Actions | `wrangler deploy` |

### 本地開發

```bash
pnpm --filter api dev       # wrangler dev → http://localhost:8787
pnpm --filter web dev       # next dev      → http://localhost:3000
pnpm --filter realtime dev  # DO 本地模擬
pnpm --filter agent dev     # Agent 本地觸發測試
```

---

## 實作優先順序

### Phase 1 — Monorepo 骨架 + 基礎設施
- pnpm workspace 設定
- `packages/shared` TypeScript 型別
- D1 schema + migration 腳本
- KV namespace、R2 bucket 建立
- 四個 `wrangler.toml` 設定
- **目標：** 本地 `wrangler dev` 可跑，所有 bindings 連通

### Phase 2 — 使用者認證
- `apps/api` 認證端點（register / login / logout）
- D1 users table、KV session 管理
- Turnstile 整合
- `apps/web` 登入 / 註冊頁面
- **目標：** 可以註冊、登入、登出

### Phase 3 — 課程影片 CRUD + 管理後台
- 課程 / 影片 API 端點
- R2 presigned URL 上傳流程
- Cloudflare Stream 整合（上傳 + 播放）
- 管理後台頁面（`/admin`）
- Cloudflare Images 縮圖轉換
- **目標：** 管理員可建立課程、上傳影片，學員可播放

### Phase 4 — 即時留言（Durable Objects）
- `workers/realtime` Durable Object 實作
- WebSocket 留言廣播
- `apps/web` `LiveComments` 元件
- **目標：** 影片播放頁多人即時留言

### Phase 5 — AI Pipeline（Agents SDK + RAG）
- `workers/agent` Agents SDK 實作
- Workers AI Whisper 語音轉文字
- AI 摘要生成
- Vectorize 索引建立
- AI Gateway 設定
- `apps/web` AI 摘要面板 + AI 問答介面
- **目標：** 上傳後自動生成字幕與摘要，學員可對影片內容提問

---

## 實作備註

- **Admin 路由保護：** `apps/api` 中間件從 KV session 取出 user，檢查 `role === 'admin'`，否則回傳 403
- **Turnstile 流程：** 前端嵌入 Widget 取得 token → 隨表單送出 → `apps/api` 呼叫 Cloudflare Turnstile Siteverify API 驗證
- **Agent 觸發方式：** `POST /videos/:id/publish` 非同步呼叫 `workers/agent`（fire-and-forget），立即回傳 202，前端輪詢 `GET /videos/:id` 的 status 欄位
- **Durable Object 實例 ID：** 使用 `video_id`（UUID）作為 DO name，確保每個影片對應唯一實例
- **Vectorize embedding 模型：** 使用 Workers AI `@cf/baai/bge-base-en-v1.5`（768 維），chunk 大小 500 token，overlap 50 token

---

### Phase 6 — 安全層 + CI/CD
- WAF 自訂規則
- Bot Management 設定
- API Shield schema 上傳
- Cloudflare Access / Tunnel 後台保護
- GitHub Actions wrangler deploy 流程
- **目標：** 完整部署，安全防護全部到位
