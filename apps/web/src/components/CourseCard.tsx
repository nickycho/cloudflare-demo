import type { Course } from '@demo/shared'
import Link from 'next/link'

export function CourseCard({ course }: { course: Course }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, margin: 8 }}>
      <Link href={`/courses/${course.id}`}>
        <h2 style={{ margin: '0 0 8px' }}>{course.title}</h2>
      </Link>
      <p style={{ color: '#64748b', margin: 0 }}>{course.description}</p>
    </div>
  )
}
