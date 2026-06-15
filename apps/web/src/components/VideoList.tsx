import type { Video } from '@demo/shared'
import Link from 'next/link'

interface Props {
  courseId: string
  videos: Video[]
}

export function VideoList({ courseId, videos }: Props) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {videos.map((v) => (
        <li key={v.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
          <Link href={`/courses/${courseId}/videos/${v.id}`}>
            {v.order + 1}. {v.title}
            {v.status === 'processing' && <span style={{ color: '#94a3b8', marginLeft: 8 }}>(處理中...)</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
