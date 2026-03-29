"use client"

import { useState, useTransition } from "react"
import { deleteCharacter } from "@/lib/actions/characters"
import type { CharacterWithCreator } from "@/lib/actions/characters"
import { CharacterForm } from "@/components/character-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface CharacterCardProps {
  character: CharacterWithCreator
  currentUserId?: string
  onGenerateImage?: (characterId: string) => void
}

export function CharacterCard({ character, currentUserId, onGenerateImage }: CharacterCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  const isOwner = currentUserId === character.createdById

  if (isDeleted) return null

  function handleDelete() {
    setErrorMsg(null)
    startDeleteTransition(async () => {
      const result = await deleteCharacter(character.id)
      if ("error" in result) {
        setErrorMsg(result.error)
      } else {
        setIsDeleted(true)
      }
    })
  }

  if (isEditing) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Edit Character</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
          <CharacterForm
            bookId={character.bookId}
            existingCharacter={{
              id: character.id,
              name: character.name,
              description: character.description,
            }}
            onSuccess={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold text-sm">{character.name}</span>
          {character.description && (
            <p className="text-sm text-muted-foreground">{character.description}</p>
          )}
          <span className="text-xs text-muted-foreground">
            Added by {character.createdBy.name}
          </span>
          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {onGenerateImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onGenerateImage(character.id)}
            >
              🎨 Generate Image
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
