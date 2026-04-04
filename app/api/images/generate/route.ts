import { NextRequest, NextResponse } from "next/server"
import { generateBookImage } from "@/lib/actions/images"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { bookId, characterId, userPrompt } = body

  if (!bookId) {
    return NextResponse.json({ error: "bookId required" }, { status: 400 })
  }

  const result = await generateBookImage(bookId, { characterId, userPrompt })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result)
}
