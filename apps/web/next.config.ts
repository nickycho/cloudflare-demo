// apps/web/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cloudflarestream.com' },
      { hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
}

export default nextConfig
