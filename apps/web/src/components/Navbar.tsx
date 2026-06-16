'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ApiResponse, SessionUser } from '@demo/shared'

export function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    api.get<ApiResponse<SessionUser>>('/auth/me')
      .then(r => setUser(r.data ?? null))
      .catch(() => setUser(null))
  }, [])

  const logout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
    router.push('/auth/login')
  }

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid #e2e8f0',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 16, textDecoration: 'none', color: '#1e293b' }}>
          影音學習平台
        </Link>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>課程</Link>
        {user?.role === 'admin' && (
          <Link href="/admin" style={{ color: '#6366f1', textDecoration: 'none', fontSize: 14 }}>管理後台</Link>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
        {user ? (
          <>
            <span style={{ color: '#475569' }}>
              {user.name}
              {user.role === 'admin' && (
                <span style={{ marginLeft: 6, background: '#6366f1', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                  admin
                </span>
              )}
            </span>
            <button
              onClick={logout}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: '#fff', color: '#64748b' }}
            >
              登出
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login" style={{ color: '#6366f1', textDecoration: 'none' }}>登入</Link>
            <Link href="/auth/register" style={{ padding: '4px 12px', borderRadius: 6, background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
              註冊
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
