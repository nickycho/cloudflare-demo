'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { CourseCard } from '@/components/CourseCard'
import type { Course, ApiResponse } from '@demo/shared'

export default function MePage() {
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    api.get<ApiResponse<Course[]>>('/enrollments/me').then(r => setCourses(r.data ?? []))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>我的課程</h1>
      {courses.length === 0 && <p>尚未報名任何課程</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {courses.map(c => <CourseCard key={c.id} course={c} />)}
      </div>
    </main>
  )
}
