'use client'

interface Props {
  streamToken: string
  onTimeUpdate?: (currentTime: number) => void
}

export function StreamPlayer({ streamToken, onTimeUpdate }: Props) {
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={`https://iframe.cloudflarestream.com/${streamToken}`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
