import { DurableObject } from 'cloudflare:workers'

export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.ctx.getWebSockets().forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

  webSocketClose(ws: WebSocket): void {
    ws.close()
  }
}

export default {
  async fetch(request: Request, env: { CHAT_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    const videoId = url.pathname.split('/').pop()
    if (!videoId) return new Response('Missing video ID', { status: 400 })
    const id = env.CHAT_ROOM.idFromName(videoId)
    const stub = env.CHAT_ROOM.get(id)
    return stub.fetch(request)
  },
}
