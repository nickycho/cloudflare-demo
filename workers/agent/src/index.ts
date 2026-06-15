import { Agent } from 'agents'

type Env = {
  VIDEO_PROCESSING_AGENT: DurableObjectNamespace
  AI: Ai
  VECTORIZE: VectorizeIndex
  DB: D1Database
  STREAM_ACCOUNT_ID: string
  STREAM_API_TOKEN: string
  AI_GATEWAY_URL: string
}

export class VideoProcessingAgent extends Agent<Env> {
  async processVideo(videoId: string, streamVideoId: string): Promise<void> {
    // Phase 5 實作：Whisper → 摘要 → Vectorize → 更新 D1
    console.log(`Processing video ${videoId}`)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    const id = env.VIDEO_PROCESSING_AGENT.idFromName(videoId)
    const agent = env.VIDEO_PROCESSING_AGENT.get(id)
    // 非同步觸發，不等待
    agent.fetch(new Request('http://internal/process', {
      method: 'POST',
      body: JSON.stringify({ videoId, streamVideoId }),
    }))
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
