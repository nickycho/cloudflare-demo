import { Hono } from 'hono'
import { sessionMiddleware } from '../middleware/session'
import type { Env } from '../index'

const aiRouter = new Hono<{ Bindings: Env; Variables: { user: import('@demo/shared').SessionUser } }>()

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct'

aiRouter.post('/ask', sessionMiddleware, async (c) => {
  const { question, videoId } = await c.req.json<{ question: string; videoId: string }>()
  if (!question || !videoId) return c.json({ error: 'Missing fields' }, 400)

  // Step 1: 將問題轉為 embedding
  const embResult = await c.env.AI.run(EMBEDDING_MODEL, { text: [question] }) as { data: number[][] }
  const queryVector = embResult.data[0]

  // Step 2: Vectorize 語意搜索（限定此影片的 chunks）
  const results = await c.env.VECTORIZE.query(queryVector, {
    topK: 5,
    filter: { video_id: videoId },
    returnMetadata: 'all',
  })

  const context = results.matches
    .map((m) => (m.metadata as { chunk_text: string }).chunk_text)
    .join('\n\n')

  if (!context) return c.json({ data: { answer: '找不到相關內容，請嘗試其他問題。' } })

  // Step 3: Workers AI LLM 回答
  const llmResult = await c.env.AI.run(LLM_MODEL, {
    messages: [
      { role: 'system', content: '你是一個學習助理，根據以下影片內容片段，以繁體中文回答問題。只根據提供的內容回答，不要捏造資訊。' },
      { role: 'user', content: `影片內容片段：\n${context}\n\n問題：${question}` },
    ],
  }) as { response: string }

  return c.json({ data: { answer: llmResult.response, sources: results.matches.length } })
})

export { aiRouter }
