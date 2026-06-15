import { api } from '@/lib/api'
import { CourseCard } from '@/components/CourseCard'
import type { Course, ApiResponse } from '@demo/shared'

export const revalidate = 300

export default async function HomePage() {
  const res = await api.get<ApiResponse<Course[]>>('/courses')
  const courseList = res.data ?? []
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
