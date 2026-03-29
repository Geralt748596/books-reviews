import OpenAI from "openai"

const globalForOpenAI = globalThis as unknown as { openai: OpenAI | undefined }

export const openai =
  globalForOpenAI.openai ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai

export interface CharacterSuggestion {
  name: string
  description: string
}

export function buildImagePrompt(
  bookTitle: string,
  characterName?: string,
  characterDescription?: string,
  userAddition?: string
): string {
  let prompt: string
  if (characterName) {
    prompt = `An artistic illustration of ${characterName} from the book "${bookTitle}".`
    if (characterDescription) prompt += ` ${characterDescription}.`
    prompt += " Style: digital art, character portrait, book illustration."
  } else {
    prompt = `An artistic illustration representing the book "${bookTitle}". Style: digital art, book cover aesthetic.`
  }
  if (userAddition?.trim()) {
    prompt += ` Additional details: ${userAddition.trim()}`
  }
  return prompt
}

export async function generateImage(
  prompt: string
): Promise<{ base64: string; revisedPrompt: string }> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    quality: "medium",
  })

  const data = response.data ?? []
  const b64 = data[0]?.b64_json
  if (!b64) {
    throw new Error("No image data returned from OpenAI")
  }

  return {
    base64: b64,
    revisedPrompt: (data[0] as { revised_prompt?: string }).revised_prompt ?? prompt,
  }
}

export async function extractCharacters(
  bookTitle: string,
  bookDescription: string
): Promise<CharacterSuggestion[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a literary assistant. Extract the main characters from a book description. Return a JSON object with a "characters" array, where each item has "name" (string) and "description" (string) fields. Only include characters explicitly mentioned or strongly implied in the description. If no characters are identifiable, return {"characters": []}.',
        },
        {
          role: "user",
          content: `Book title: ${bookTitle}\n\nDescription: ${bookDescription}\n\nExtract the main characters from this book description as JSON.`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(content) as { characters?: CharacterSuggestion[] }
    const characters = parsed.characters

    if (!Array.isArray(characters)) return []

    return characters.filter(
      (c) => typeof c.name === "string" && c.name.trim().length > 0
    )
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[extractCharacters] error:", error)
    }
    return []
  }
}
