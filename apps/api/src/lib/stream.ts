export interface StreamUploadResponse {
  uid: string
  uploadURL: string
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
        'Upload-Metadata': `name ${btoa(videoName)}`,
      },
    },
  )
  if (!res.ok) throw new Error(`Stream API error: ${res.status}`)
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
