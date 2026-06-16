import type { Metadata } from 'next'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Cloudflare Demo — 影音學習平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
