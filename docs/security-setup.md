# 安全層設定

## WAF 自訂規則（Cloudflare Dashboard → Security → WAF → Custom rules）

### 規則 1：封鎖惡意 User-Agent
- Expression: `(http.user_agent contains "sqlmap") or (http.user_agent contains "nikto")`
- Action: Block

### 規則 2：登入/註冊路由限速
- Expression: `(http.request.uri.path matches "^/auth/(login|register)$")`
- Action: Rate limit → 10 requests per minute per IP

## Bot Management（Dashboard → Security → Bots）

- 啟用 Bot Fight Mode
- 為影片端點加入規則：
  - Expression: `(http.request.uri.path matches "^/videos/") and (cf.bot_management.score lt 30)`
  - Action: Challenge

## API Shield Schema Validation（Dashboard → Security → API Shield）

上傳以下 OpenAPI Schema 進行請求格式驗證。
