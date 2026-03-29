import { getBookCharacters } from "@/lib/actions/characters"
import { CharacterListClient } from "@/components/character-list-client"
import { CharacterForm } from "@/components/character-form"
import { CharacterSuggestions } from "@/components/character-suggestions"
import { Separator } from "@/components/ui/separator"

interface CharacterListProps {
  bookId: string
  currentUserId?: string
}

export async function CharacterList({ bookId, currentUserId }: CharacterListProps) {
  const characters = await getBookCharacters(bookId)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">
          Characters{" "}
          {characters.length > 0 && (
            <span className="text-muted-foreground font-normal text-base">
              ({characters.length})
            </span>
          )}
        </h3>
      </div>

      <Separator />

      {/* AI Suggestions */}
      <div className="flex flex-col gap-2">
        <h4 className="font-medium text-sm">AI Character Extraction</h4>
        <CharacterSuggestions bookId={bookId} />
      </div>

      <Separator />

      {/* Add Character form (only for authenticated users) */}
      {currentUserId && (
        <>
          <div className="flex flex-col gap-3">
            <h4 className="font-medium">Add Character</h4>
            <CharacterForm bookId={bookId} />
          </div>
          <Separator />
        </>
      )}

      {/* Characters list */}
      <CharacterListClient
        characters={characters}
        currentUserId={currentUserId}
      />
    </div>
  )
}
