import { api } from '@/lib/api'
import { VideoList } from '@/components/VideoList'
import type { Course, Video, ApiResponse } from '@demo/shared'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let data: (Course & { videos: Video[] }) | null = null
  try {
    const res = await api.get<ApiResponse<Course & { videos: Video[] }>>(`/courses/${id}`)
    data = res.data ?? null
  } catch { notFound() }
  if (!data) notFound()
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>{data.title}</h1>
      <p>{data.description}</p>
      <h2>課程內容</h2>
      <VideoList courseId={id} videos={data.videos} />
    </main>
  )
}
