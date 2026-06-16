import { api } from '@/lib/api'
import { StreamPlayer } from '@/components/StreamPlayer'
import { LiveComments } from '@/components/LiveComments'
import { AISummary } from '@/components/AISummary'
import { AIChat } from '@/components/AIChat'
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
      ) : video.status === 'ready' ? (
        <p style={{ color: '#64748b', padding: '16px', background: '#f8fafc', borderRadius: 8 }}>
          影片已就緒，但本地開發模式下無法播放（需設定 Cloudflare Stream 憑證）
        </p>
      ) : (
        <p style={{ color: '#64748b' }}>影片處理中，請稍候...</p>
      )}
      {video.summary && <AISummary summary={video.summary} />}
      <AIChat videoId={vid} />
      <LiveComments
        videoId={vid}
        realtimeUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? 'ws://localhost:8788'}
      />
    </main>
  )
}
