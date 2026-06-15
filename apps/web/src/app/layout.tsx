import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cloudflare Demo — 影音學習平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
