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

  useEffect(() => {
    api.get<ApiResponse<Course[]>>('/courses').then(r => setCourses(r.data ?? []))
  }, [])

  const createCourse = async () => {
    if (!newCourseTitle) return
    const res = await api.post<ApiResponse<{ id: string; title: string }>>('/courses', { title: newCourseTitle, description: '' })
    const newCourse: Course = {
      id: res.data!.id,
      title: res.data!.title,
      description: '',
      thumbnail_key: null,
      status: 'draft',
      created_at: Date.now(),
      updated_at: Date.now(),
    }
    setCourses(prev => [...prev, newCourse])
    setNewCourseTitle('')
  }

  const handleUploaded = (videoId: string) => {
    setProcessingIds(prev => [...prev, videoId])
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>管理後台</h1>
      <section>
        <h2>建立課程</h2>
        <input value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} placeholder="課程標題" />
        <button onClick={createCourse}>建立</button>
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
