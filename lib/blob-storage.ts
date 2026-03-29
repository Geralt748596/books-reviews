import { put } from "@vercel/blob"

export async function uploadImageToBlob(base64: string, path: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64")
  const blob = await put(path, buffer, {
    access: "public",
    contentType: "image/png",
  })
  return blob.url
}
