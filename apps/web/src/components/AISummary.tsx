interface Props {
  summary: string
}

export function AISummary({ summary }: Props) {
  return (
    <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px', color: '#6366f1' }}>AI 重點摘要</h3>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{summary}</div>
    </section>
  )
}
