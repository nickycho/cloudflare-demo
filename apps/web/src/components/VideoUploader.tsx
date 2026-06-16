'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@demo/shared'

interface UploadUrlResponse {
  videoId: string
  streamVideoId: string
  uploadURL: string
}

interface Props {
  courseId: string
  onUploaded: (videoId: string) => void
}

export function VideoUploader({ courseId, onUploaded }: Props) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file || !title) { setError('請填入標題並選擇影片檔案'); return }
    setUploading(true)
    setError('')
    try {
      const res = await api.post<ApiResponse<UploadUrlResponse>>('/videos/upload-url', { courseId, title, fileSize: file.size })
      const { videoId, uploadURL } = res.data!

      // 使用 XHR PATCH 實作 TUS 上傳至 Stream
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PATCH', uploadURL)
        xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')
        xhr.setRequestHeader('Tus-Resumable', '1.0.0')
        xhr.setRequestHeader('Upload-Offset', '0')
        xhr.setRequestHeader('Upload-Length', String(file.size))
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.send(file)
      })

      // 通知 API 上傳完成，觸發 Agent
      await api.post(`/videos/${videoId}/publish`, {})
      onUploaded(videoId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3>上傳新影片</h3>
      <div>
        <label>影片標題<input value={title} onChange={e => setTitle(e.target.value)} style={{ display: 'block', width: '100%' }} /></label>
      </div>
      <div style={{ marginTop: 8 }}>
        <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {uploading && <progress value={progress} max={100} style={{ display: 'block', width: '100%', marginTop: 8 }} />}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleUpload} disabled={uploading} style={{ marginTop: 8 }}>
        {uploading ? `上傳中... ${progress}%` : '開始上傳'}
      </button>
    </div>
  )
}
