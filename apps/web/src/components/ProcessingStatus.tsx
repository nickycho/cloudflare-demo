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
