export interface StreamUploadResponse {
  uid: string
  uploadURL: string
}

// btoa() 只能處理 Latin1，標題含中文等非 Latin1 字元會 throw。
// 先以 UTF-8 編碼成 bytes 再 base64，TUS Upload-Metadata 要求 base64 value。
function toBase64Utf8(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
}

export async function createStreamUploadUrl(
  accountId: string,
  apiToken: string,
  videoName: string,
  fileSize: number,
): Promise<StreamUploadResponse> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(fileSize),
        'Upload-Metadata': `name ${toBase64Utf8(videoName)}`,
      },
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stream API error: ${res.status} ${body}`)
  }
  const uid = res.headers.get('stream-media-id') ?? ''
  const uploadURL = res.headers.get('location') ?? ''
  return { uid, uploadURL }
}

export async function getStreamSignedToken(
  accountId: string,
  apiToken: string,
  videoId: string,
): Promise<string> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    },
  )
  if (!res.ok) throw new Error(`Stream API error: ${res.status}`)
  const data = await res.json<{ result: { token: string } }>()
  return data.result.token
}
