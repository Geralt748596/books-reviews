"use client"

import { useState, useTransition } from "react"
import { suggestCharacters, addCharacter } from "@/lib/actions/characters"
import type { CharacterSuggestion } from "@/lib/openai"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface CharacterSuggestionsProps {
  bookId: string
  onCharacterAdded?: () => void
}

export function CharacterSuggestions({ bookId, onCharacterAdded }: CharacterSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CharacterSuggestion[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())
  const [isSuggesting, startSuggestionTransition] = useTransition()

  function handleSuggest() {
    setErrorMsg(null)
    setSuggestions(null)

    startSuggestionTransition(async () => {
      const result = await suggestCharacters(bookId)

      if (Array.isArray(result)) {
        setSuggestions(result)
      } else if ("error" in result) {
        setErrorMsg(result.error)
      }
    })
  }

  async function handleAdd(suggestion: CharacterSuggestion) {
    const key = suggestion.name
    setAddingIds((prev) => new Set(prev).add(key))

    const result = await addCharacter(bookId, {
      name: suggestion.name,
      description: suggestion.description || undefined,
    })

    setAddingIds((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })

    if ("character" in result) {
      setAddedNames((prev) => new Set(prev).add(key))
      toast.success("Character added!")
      onCharacterAdded?.()
    } else if ("error" in result) {
      // If character already exists, mark it as added too
      if (result.error === "Character already exists") {
        setAddedNames((prev) => new Set(prev).add(key))
      } else {
        setErrorMsg(result.error)
        toast.error(result.error)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleSuggest}
        disabled={isSuggesting}
        className="self-start"
      >
        {isSuggesting ? "Analyzing..." : "Suggest Characters with AI"}
      </Button>

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {suggestions !== null && (
        <div className="flex flex-col gap-2">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No characters could be identified from this book&apos;s description.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                AI Suggestions ({suggestions.length})
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map((suggestion) => {
                  const isAdding = addingIds.has(suggestion.name)
                  const isAdded = addedNames.has(suggestion.name)

                  return (
                    <Card key={suggestion.name} size="sm">
                      <CardContent className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-sm">{suggestion.name}</span>
                          {suggestion.description && (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {suggestion.description}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isAdded ? "secondary" : "outline"}
                          onClick={() => handleAdd(suggestion)}
                          disabled={isAdding || isAdded}
                          className="shrink-0"
                        >
                          {isAdding ? "Adding..." : isAdded ? "Added" : "Add"}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
