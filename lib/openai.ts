import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as { openai: OpenAI | undefined };

export const openai =
  globalForOpenAI.openai ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai;

export interface CharacterSuggestion {
  name: string;
  description: string;
}

export function buildCoverPrompt(
  bookTitle: string,
  bookDescription: string | null,
  userAddition?: string,
): string {
  const parts: string[] = [
    `Design a visually striking book cover for "${bookTitle}".`,
  ];

  if (bookDescription?.trim()) {
    const synopsis =
      bookDescription.length > 400
        ? bookDescription.slice(0, 400) + "…"
        : bookDescription;
    parts.push(`The book synopsis: ${synopsis}`);
  }

  parts.push(
    "Requirements: the image must work as a front book cover — include strong focal imagery, mood-appropriate color palette, and composition that leaves space for a title at the top and an author name at the bottom. Do NOT render any text, lettering, or typography on the cover.",
  );

  if (userAddition?.trim()) {
    parts.push(`User direction: ${userAddition.trim()}`);
  }

  return parts.join(" ");
}

export function buildCharacterImagePrompt(
  description: string,
  userPrompt?: string,
) {
  // const parts: string[] = [
  //   `Design a visually striking image for "${description}". The image should be generated for a portrait of a book character, try to make the image in the style of a portrait with a front view`,
  // ];

  const parts: string[] = [
    "Generate basic portrait minimalistic image with minimal details",
  ];

  if (userPrompt?.trim()) {
    parts.push(`User direction: ${userPrompt.trim()}`);
  }

  return parts.join(" ");
}

export async function generateImage(
  prompt: string,
): Promise<{ base64: string; revisedPrompt: string } | { error: string }> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536",
      quality: "medium",
      // response_format: "b64_json",
      n: 1,
    });

    const data = response.data ?? [];
    const b64 = data[0]?.b64_json;
    if (!b64) {
      throw new Error("No image data returned from OpenAI");
    }

    return {
      base64: b64,
      revisedPrompt:
        (data[0] as { revised_prompt?: string }).revised_prompt ?? prompt,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("[generateImage] error:", error);
      return { error: error.message };
    }
    return { error: "An unknown error occurred" };
  }
}

export async function extractCharacters(
  bookTitle: string,
  bookDescription: string,
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
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      characters?: CharacterSuggestion[];
    };
    const characters = parsed.characters;

    if (!Array.isArray(characters)) return [];

    return characters.filter(
      (c) => typeof c.name === "string" && c.name.trim().length > 0,
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[extractCharacters] error:", error);
    }
    return [];
  }
}
