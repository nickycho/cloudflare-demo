import { api } from '@/lib/api'
import { StreamPlayer } from '@/components/StreamPlayer'
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
      ) : (
        <p>影片處理中，請稍候...</p>
      )}
      {video.summary && (
        <section style={{ marginTop: 24 }}>
          <h2>AI 摘要</h2>
          <p>{video.summary}</p>
        </section>
      )}
    </main>
  )
}
