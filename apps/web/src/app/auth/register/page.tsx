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
