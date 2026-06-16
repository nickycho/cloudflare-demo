'use client'
import { useState, useEffect } from 'react'
import { VideoUploader } from '@/components/VideoUploader'
import { ProcessingStatus } from '@/components/ProcessingStatus'
import { api } from '@/lib/api'
import type { Course, ApiResponse } from '@demo/shared'

export default function AdminPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [processingIds, setProcessingIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const fetchCourses = () => {
    api.get<ApiResponse<Course[]>>('/courses/admin')
      .then(r => setCourses(r.data ?? []))
      .catch(err => setError(err instanceof Error ? err.message : '載入失敗，請確認帳號有 admin 權限'))
  }

  useEffect(() => { fetchCourses() }, [])

  const createCourse = async () => {
    if (!newCourseTitle) return
    const res = await api.post<ApiResponse<{ id: string; title: string }>>('/courses', { title: newCourseTitle, description: '' })
    setNewCourseTitle('')
    fetchCourses()
    setSelectedCourseId(res.data!.id)
  }

  const togglePublish = async (course: Course) => {
    const newStatus = course.status === 'published' ? 'draft' : 'published'
    await api.put(`/courses/${course.id}`, { status: newStatus })
    fetchCourses()
  }

  const handleUploaded = (videoId: string) => {
    setProcessingIds(prev => [...prev, videoId])
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>管理後台</h1>
      {error && <p style={{ color: 'red', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>{error}</p>}

      <section>
        <h2>建立課程</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newCourseTitle}
            onChange={e => setNewCourseTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCourse()}
            placeholder="課程標題"
          />
          <button onClick={createCourse}>建立</button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>課程列表</h2>
        {courses.length === 0 && <p style={{ color: '#94a3b8' }}>尚無課程</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {courses.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 0' }}>{c.title}</td>
                <td style={{ padding: '8px 0' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: c.status === 'published' ? '#dcfce7' : '#f1f5f9',
                    color: c.status === 'published' ? '#16a34a' : '#64748b',
                  }}>
                    {c.status === 'published' ? '已發布' : '草稿'}
                  </span>
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <button onClick={() => togglePublish(c)} style={{ fontSize: 13 }}>
                    {c.status === 'published' ? '下架' : '發布'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>上傳影片</h2>
        <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
          <option value="">選擇課程</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {selectedCourseId && <VideoUploader courseId={selectedCourseId} onUploaded={handleUploaded} />}
      </section>

      {processingIds.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>處理狀態</h2>
          {processingIds.map(id => <ProcessingStatus key={id} videoId={id} />)}
        </section>
      )}
    </main>
  )
}
