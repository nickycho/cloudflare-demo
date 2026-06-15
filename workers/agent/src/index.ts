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

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const WHISPER_MODEL = '@cf/openai/whisper'
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct'

function chunkText(text: string): string[] {
  const words = text.split(' ')
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '))
    if (i + CHUNK_SIZE >= words.length) break
  }
  return chunks
}

export class VideoProcessingAgent extends Agent<Env> {
  async fetch(request: Request): Promise<Response> {
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    await this.processVideo(videoId, streamVideoId)
    return new Response('ok')
  }

  async processVideo(videoId: string, streamVideoId: string): Promise<void> {
    try {
      // Step 1: 從 Stream 下載音訊
      const audioUrl = `https://videodelivery.net/${streamVideoId}/downloads/default.mp4`
      const audioRes = await fetch(audioUrl, {
        headers: { Authorization: `Bearer ${this.env.STREAM_API_TOKEN}` },
      })
      const audioBuffer = await audioRes.arrayBuffer()

      // Step 2: Workers AI Whisper 語音轉文字
      const whisperResult = await this.env.AI.run(WHISPER_MODEL, {
        audio: [...new Uint8Array(audioBuffer)],
      }) as { text: string }
      const transcript = whisperResult.text

      // Step 3: Workers AI LLM 生成摘要
      const summaryResult = await this.env.AI.run(LLM_MODEL, {
        messages: [
          { role: 'system', content: '你是一個學習助理，請以繁體中文撰寫影片重點摘要，條列式，200字以內。' },
          { role: 'user', content: `請摘要以下影片逐字稿：\n\n${transcript.slice(0, 4000)}` },
        ],
      }) as { response: string }
      const summary = summaryResult.response

      // Step 4: 切分 chunk 並寫入 Vectorize
      const chunks = chunkText(transcript)
      const embeddings = await Promise.all(
        chunks.map(chunk => this.env.AI.run(EMBEDDING_MODEL, { text: [chunk] }) as Promise<{ data: number[][] }>)
      )
      const vectors = chunks.map((chunk, i) => ({
        id: `${videoId}-chunk-${i}`,
        values: embeddings[i].data[0],
        metadata: { video_id: videoId, chunk_text: chunk, chunk_index: i },
      }))
      await this.env.VECTORIZE.upsert(vectors)

      // Step 5: 更新 D1
      await this.env.DB.prepare(
        'UPDATE videos SET status = ?, summary = ?, transcript = ? WHERE id = ?'
      ).bind('ready', summary, transcript, videoId).run()

      console.log(`Video ${videoId} processed successfully`)
    } catch (err) {
      console.error(`Failed to process video ${videoId}:`, err)
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const { videoId, streamVideoId } = await request.json<{ videoId: string; streamVideoId: string }>()
    const id = env.VIDEO_PROCESSING_AGENT.idFromName(videoId)
    const agent = env.VIDEO_PROCESSING_AGENT.get(id)
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
