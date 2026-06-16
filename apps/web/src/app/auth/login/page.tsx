'use client'
import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { login } from '@/lib/auth'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnstileToken) { setError('請完成驗證'); return }
    try {
      await login(email, password, turnstileToken)
      const redirect = searchParams.get('redirect') ?? '/'
      router.push(redirect)
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
