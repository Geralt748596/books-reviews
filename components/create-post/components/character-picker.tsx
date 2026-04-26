"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBookCharacters } from "@/lib/actions/characters";

type CharacterOption = { id: string; name: string };

interface CharacterPickerProps {
  bookId: string;
  value: string;
  onChange: (characterId: string | null) => void;
}

export function CharacterPicker({
  bookId,
  value,
  onChange,
}: CharacterPickerProps) {
  const [characters, setCharacters] = React.useState<CharacterOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!bookId) {
      setCharacters([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getBookCharacters(bookId).then((results) => {
      if (cancelled) return;
      setCharacters(results.map((c) => ({ id: c.id, name: c.name })));
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const selected = characters.find((c) => c.id === value) ?? null;

  return (
    <Select
      value={selected}
      onValueChange={(item: CharacterOption | null) =>
        onChange(item?.id ?? null)
      }
      disabled={isLoading || characters.length === 0}
      itemToStringLabel={(item: CharacterOption) => item.name}
      itemToStringValue={(item: CharacterOption) => item.id}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pick a character (optional)" />
      </SelectTrigger>
      <SelectContent>
        {characters.map((c) => (
          <SelectItem key={c.id} value={c}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
