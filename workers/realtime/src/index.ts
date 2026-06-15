import { DurableObject } from 'cloudflare:workers'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, { userId: string; userName: string }>()

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') ?? 'anonymous'
    const userName = url.searchParams.get('userName') ?? 'Anonymous'
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], [userId])
    this.sessions.set(pair[1], { userId, userName })

    // 送出最近 50 則歷史訊息給新連線
    const history = await this.ctx.storage.get<ChatMessage[]>('history') ?? []
    pair[1].send(JSON.stringify({ type: 'history', messages: history }))

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const session = this.sessions.get(ws)
    if (!session) return
    let parsed: { text: string }
    try { parsed = JSON.parse(message as string) } catch { return }
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: session.userName,
      text: parsed.text.slice(0, 500),
      timestamp: Date.now(),
    }
    const payload = JSON.stringify({ type: 'message', message: msg })
    this.ctx.getWebSockets().forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    })
    // 更新歷史（最多 50 則）
    this.ctx.storage.get<ChatMessage[]>('history').then(history => {
      const updated = [...(history ?? []), msg].slice(-50)
      this.ctx.storage.put('history', updated)
    })
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws)
    ws.close()
  }
}

export default {
  async fetch(request: Request, env: { CHAT_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    const videoId = url.pathname.replace('/room/', '')
    if (!videoId) return new Response('Missing video ID', { status: 400 })
    const id = env.CHAT_ROOM.idFromName(videoId)
    const stub = env.CHAT_ROOM.get(id)
    return stub.fetch(request)
  },
}
