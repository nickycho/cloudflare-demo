import { api } from '@/lib/api'
import { CourseCard } from '@/components/CourseCard'
import type { Course, ApiResponse } from '@demo/shared'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let courseList: Course[] = []
  try {
    const res = await api.get<ApiResponse<Course[]>>('/courses')
    courseList = res.data ?? []
  } catch {
    // API 無法連線時顯示空列表
  }
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>所有課程</h1>
      {courseList.length === 0 && <p>目前還沒有課程</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {courseList.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </main>
  )
}
