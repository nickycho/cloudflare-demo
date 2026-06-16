import { Hono } from 'hono'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'

const aiRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct'

aiRouter.post('/ask', sessionMiddleware, async (c) => {
  const { question, videoId } = await c.req.json<{ question: string; videoId: string }>()
  if (!question || !videoId) return c.json({ error: 'Missing fields' }, 400)

  let context = ''
  let sources = 0

  try {
    // Step 1: 將問題轉為 embedding
    const embResult = await c.env.AI.run(EMBEDDING_MODEL, { text: [question] }) as { data: number[][] }
    const queryVector = embResult.data[0]

    // Step 2: Vectorize 語意搜索（本地開發不支援，直接 fallback）
    const results = await c.env.VECTORIZE.query(queryVector, {
      topK: 5,
      filter: { video_id: videoId },
      returnMetadata: 'all',
    })
    context = results.matches
      .map((m) => (m.metadata as { chunk_text: string }).chunk_text)
      .join('\n\n')
    sources = results.matches.length
  } catch (err) {
    console.error('[ai/ask] embedding/vectorize failed:', err)
  }

  try {
    const systemPrompt = context
      ? '你是一個學習助理，根據以下影片內容片段，以繁體中文回答問題。只根據提供的內容回答，不要捏造資訊。'
      : '你是一個學習助理，請以繁體中文回答問題。目前沒有影片逐字稿可參考，請根據一般知識回答。'
    const userContent = context
      ? `影片內容片段：\n${context}\n\n問題：${question}`
      : question

    const llmResult = await c.env.AI.run(LLM_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }) as { response: string }

    return c.json({ data: { answer: llmResult.response, sources } })
  } catch (err) {
    console.error('[ai/ask] LLM failed:', err)
    return c.json({ error: 'AI 服務暫時無法使用，請稍後再試' }, 503)
  }
})

export { aiRouter }
