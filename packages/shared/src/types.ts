export type UserRole = 'admin' | 'student'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: number
}

export interface Course {
  id: string
  title: string
  description: string
  thumbnail_key: string | null
  status: 'draft' | 'published'
  created_at: number
  updated_at: number
}

export interface Video {
  id: string
  course_id: string
  title: string
  order: number
  stream_video_id: string | null
  status: 'processing' | 'ready'
  summary: string | null
  transcript: string | null
  created_at: number
}

export interface Enrollment {
  user_id: string
  course_id: string
  enrolled_at: number
}

export interface WatchProgress {
  user_id: string
  video_id: string
  progress_sec: number
  completed: boolean
  last_watched_at: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}
