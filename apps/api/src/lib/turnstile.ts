export async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  // 本地開發跳過驗證
  if (!secretKey) return true
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  })
  const data = await res.json<{ success: boolean }>()
  return data.success
}
