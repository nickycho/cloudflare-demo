'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => void
    }
  }
}

interface Props {
  siteKey: string
  onSuccess: (token: string) => void
}

export function TurnstileWidget({ siteKey, onSuccess }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = () => {
      if (ref.current) window.turnstile.render(ref.current, { sitekey: siteKey, callback: onSuccess })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [siteKey, onSuccess])
  return <div ref={ref} />
}
