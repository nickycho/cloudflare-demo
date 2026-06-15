'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

interface Props {
  videoId: string
  userId: string
  userName: string
  realtimeUrl: string
}

export function LiveComments({ videoId, userId, userName, realtimeUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${realtimeUrl}/room/${videoId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string)
        if (data.type === 'history') setMessages(data.messages)
        else if (data.type === 'message') setMessages(prev => [...prev, data.message])
      } catch {}
    }

    return () => { ws.close() }
  }, [videoId, userId, userName, realtimeUrl])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ text: input.trim() }))
    setInput('')
  }, [input])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px' }}>
        即時討論 {connected ? <span style={{ color: 'green', fontSize: '0.8em' }}>● 已連線</span> : <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>○ 連線中...</span>}
      </h3>
      <div style={{ height: 300, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map(m => (
          <div key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
            <strong style={{ color: '#6366f1' }}>{m.userName}</strong>
            <span style={{ color: '#64748b', fontSize: '0.8em', marginLeft: 8 }}>
              {new Date(m.timestamp).toLocaleTimeString()}
            </span>
            <p style={{ margin: '2px 0 0' }}>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="輸入留言..."
          style={{ flex: 1 }}
          disabled={!connected}
        />
        <button onClick={sendMessage} disabled={!connected}>送出</button>
      </div>
    </div>
  )
}
