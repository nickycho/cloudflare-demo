# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概觀

Cloudflare 全平台的影片學習平台 demo。pnpm monorepo，所有元件都跑在 Cloudflare Workers/Pages 上，串接 D1、KV、R2、Workers AI、Vectorize、Stream、Durable Objects、Turnstile。

## 指令

根目錄（pnpm workspace）：

```bash
pnpm dev:api        # 啟動 api worker（wrangler dev，預設 :8787）
pnpm dev:web        # 啟動 Next.js 前端（next dev）
pnpm dev:realtime   # 啟動 realtime worker
pnpm dev:agent      # 啟動 agent worker
pnpm build          # 遞迴 build 所有 workspace
pnpm typecheck      # 遞迴 typecheck
```

api（`apps/api`）：

```bash
pnpm --filter api test                  # vitest（@cloudflare/vitest-pool-workers）
pnpm --filter api test -- <file>        # 跑單一測試檔
pnpm --filter api db:migrate:local      # 套用 D1 migration 到本地
pnpm --filter api db:migrate:remote     # 套用 D1 migration 到 remote
pnpm --filter api deploy                # wrangler deploy
```

各 worker/app 都用 `wrangler deploy` 部署；web 用 `pnpm --filter web deploy`（先 `opennextjs-cloudflare build` 再 `wrangler pages deploy`）。

## 架構

四個可獨立部署的單元，各有自己的 `wrangler.toml`：

- **`apps/api`** — Hono on Workers，REST API。入口 `src/index.ts` 掛載 `routes/`（auth、courses、videos、ai、enrollments）。資料層用 Drizzle ORM 操作 D1（schema 在 `src/db/schema.ts`，migration 在 `src/db/migrations/`）。
- **`apps/web`** — Next.js 15 (App Router, React 19)，透過 `@opennextjs/cloudflare` 部署為 Cloudflare Worker。
- **`workers/agent`** — 影片處理 pipeline。基於 `agents` SDK 的 Durable Object `VideoProcessingAgent`。
- **`workers/realtime`** — WebSocket 即時聊天室。Durable Object `ChatRoom`，每支影片一間房（`idFromName(videoId)`）。
- **`packages/shared`** (`@demo/shared`) — 跨單元共用 TypeScript 型別（`User`、`Course`、`Video`、`SessionUser` 等），直接 import `src/types.ts`。**新增 entity 時，schema.ts 與 types.ts 要同步維護。**

### 影片處理 pipeline

1. Admin 經 `POST /videos/upload-url` 取得 Cloudflare Stream 的 TUS 上傳 URL（無 `STREAM_ACCOUNT_ID` 時走本地 mock，直接建立 `ready` 影片）。
2. 上傳完成後 `POST /videos/:id/publish` → api 以 fetch 呼叫 `AGENT_WORKER_URL`。
3. `VideoProcessingAgent.processVideo` 非同步執行：Stream 下載音訊 → Whisper 轉文字 → LLM 生成摘要 → chunk 切分後寫入 Vectorize → 更新 D1 影片狀態為 `ready`。
4. `POST /ai/ask` 做 RAG：問題轉 embedding → Vectorize 依 `video_id` 過濾語意搜尋 → 組 context 餵給 LLM。

Workers AI 模型集中為常數：embedding `@cf/baai/bge-base-en-v1.5`、LLM `@cf/meta/llama-3.1-8b-instruct`、語音 `@cf/openai/whisper`。

### 認證與 session

- 自建 session：登入後在 KV（`SESSIONS` binding）存 `session:<token>`，以 `session` cookie 傳遞。密碼用 PBKDF2（`routes/auth.ts`）。
- api 端用 `middleware/session.ts`：`sessionMiddleware`（驗 session）、`adminMiddleware`（驗 admin role）、`accessMiddleware`（驗 Cloudflare Access JWT）。
- web 端用 `src/middleware.ts` 保護 `/admin` 與 `/me`（無 cookie 導向 login）。
- 註冊/登入用 Turnstile 防機器人（`lib/turnstile.ts` 做 siteverify）。

### web ↔ api 通訊（重要陷阱）

`apps/web/src/lib/api.ts` 的 `request()` 依執行環境分流：

- **瀏覽器端**：fetch 公開 API URL（`NEXT_PUBLIC_API_URL`），帶 `credentials: 'include'`。
- **server-side (SSR)**：透過 `API` **service binding** 呼叫 api worker，而非公開 URL。

原因：同 zone 的 Worker-to-Worker 走公開 URL 子請求會被 Cloudflare 擋（error 1042）。新增 SSR 取資料邏輯時務必沿用 service binding 路徑，不要直接用公開 URL fetch。

## 慣例

- 所有 worker 啟用 `nodejs_compat`，`compatibility_date = "2025-01-01"`。
- ID 用 `crypto.randomUUID().replace(/-/g, '')`（程式內以 `nanoid()` 命名）。
- 時間戳一律存 epoch 毫秒（integer）。
- api 回應統一 `{ data }` 或 `{ error }`（見 `ApiResponse<T>`）。
- 多處設計成「無雲端設定時走本地 mock」，方便本地開發（如 Stream upload、Vectorize 查詢 fallback）。
- `wrangler.toml` 內的 secret 類 `[vars]`（如 `TURNSTILE_SECRET_KEY`、`STREAM_API_TOKEN`）留空，實際值用 `.dev.vars`（本地）或 `wrangler secret`（remote）。
