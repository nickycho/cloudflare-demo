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
