"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { CharacterCard } from "@/components/character-card"
import type { CharacterWithCreator } from "@/lib/actions/characters"

interface CharacterListClientProps {
  characters: CharacterWithCreator[]
  currentUserId?: string
}

export function CharacterListClient({
  characters,
  currentUserId,
}: CharacterListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleGenerateImage(characterId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "ai-images")
    params.set("character", characterId)
    router.push(`?${params.toString()}`)
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <p className="text-lg">No characters yet</p>
        <p className="text-sm">Add one or use AI suggestions!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          currentUserId={currentUserId}
          onGenerateImage={handleGenerateImage}
        />
      ))}
    </div>
  )
}
