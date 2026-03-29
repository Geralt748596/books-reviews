"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { generateBookImage } from "@/lib/actions/images"
import type { GeneratedImageWithRelations } from "@/lib/actions/images"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface ImageGeneratorProps {
  bookId: string
  characters: { id: string; name: string }[]
  defaultCharacterId?: string
}

export function ImageGenerator({ bookId, characters, defaultCharacterId }: ImageGeneratorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [characterId, setCharacterId] = useState<string | null>(() => {
    return searchParams.get("character") ?? defaultCharacterId ?? null
  })
  const [userPrompt, setUserPrompt] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GeneratedImageWithRelations | null>(null)

  useEffect(() => {
    const charFromUrl = searchParams.get("character")
    if (charFromUrl) {
      setCharacterId(charFromUrl)
    }
  }, [searchParams])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPreview(null)

    startTransition(async () => {
      const result = await generateBookImage(bookId, {
        characterId: characterId ?? undefined,
        userPrompt: userPrompt || undefined,
      })

      if ("error" in result) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setPreview(result.image)
        toast.success("Image generated!")
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h4 className="font-medium">Generate AI Image</h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Character (optional)</Label>
          <Select
            value={characterId ?? ""}
            onValueChange={(v) => setCharacterId(v === "" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Generate for whole book" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Generate for whole book</SelectItem>
              {characters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-prompt">Additional details (optional)</Label>
          <Input
            id="user-prompt"
            placeholder="e.g. wearing a red cloak, dark forest background..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            disabled={isPending}
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Generating... (may take 30–60s)" : "Generate Image"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {preview && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground font-medium">Generated image:</p>
          <img
            src={preview.blobUrl}
            alt={preview.prompt}
            className="w-full max-w-sm rounded-lg shadow-md object-cover"
          />
          <p className="text-xs text-muted-foreground line-clamp-2">{preview.prompt}</p>
        </div>
      )}
    </div>
  )
}
