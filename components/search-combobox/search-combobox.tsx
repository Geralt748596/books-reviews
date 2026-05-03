"use client";

import React from "react";
import { SearchIcon, BookOpenIcon, UserIcon, LoaderIcon } from "lucide-react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { findBooksOrCharacters } from "@/lib/actions/books";
import type { BookResultType, CharacterResultType } from "@/lib/types/actions";
import { useDebounce } from "use-debounce";

type SearchResult = BookResultType | CharacterResultType;

type SearchGroup = {
  label: string;
  items: SearchResult[];
};

interface SearchComboboxProps {
  onSelectBook?: (book: BookResultType) => void;
  onSelectCharacter?: (character: CharacterResultType) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;
const MIN_SYMBOLS_FOR_SEARCH = 3;

export function SearchCombobox({
  onSelectBook,
  onSelectCharacter,
  placeholder = "Search books or characters…",
  className,
}: SearchComboboxProps) {
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [isPending, setIsPending] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [debouncedValue] = useDebounce(inputValue, DEBOUNCE_MS);

  React.useEffect(() => {
    const q = debouncedValue.trim();
    if (!q || q.length < MIN_SYMBOLS_FOR_SEARCH) {
      setGroups([]);
      setIsPending(false);
      return;
    }

    let cancelled = false;
    setIsPending(true);

    findBooksOrCharacters(q).then((results) => {
      if (cancelled) return;

      const books = results.filter(
        (r): r is BookResultType => r.type === "book",
      );
      const characters = results.filter(
        (r): r is CharacterResultType => r.type === "character",
      );

      const next: SearchGroup[] = [];
      if (books.length > 0) next.push({ label: "Books", items: books });
      if (characters.length > 0)
        next.push({ label: "Characters", items: characters });

      setGroups(next);
      setIsPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue]);

  function handleInputChange(value: string) {
    setInputValue(value);
    if (!value.trim()) {
      setGroups([]);
      setIsPending(false);
    } else if (value.trim().length >= MIN_SYMBOLS_FOR_SEARCH) {
      setIsPending(true);
    }
  }

  function handleValueChange(value: SearchResult | null) {
    if (!value) return;
    if (value.type === "book") onSelectBook?.(value);
    else onSelectCharacter?.(value);
  }

  return (
    <Combobox
      items={groups}
      filter={null}
      onInputValueChange={handleInputChange}
      onValueChange={handleValueChange}
      itemToStringValue={(item: SearchResult) =>
        item.type === "book" ? item.title : item.name
      }
    >
      <ComboboxInput
        placeholder={placeholder}
        showTrigger={false}
        className={className}
      >
        <InputGroupAddon align="inline-start">
          {isPending ? <LoaderIcon className="animate-spin" /> : <SearchIcon />}
        </InputGroupAddon>
      </ComboboxInput>

      <ComboboxContent alignOffset={-24} sideOffset={10}>
        <ComboboxEmpty>
          {isPending ? "Searching…" : "Nothing found."}
        </ComboboxEmpty>
        <ComboboxList>
          {(group: SearchGroup, index: number) => (
            <ComboboxGroup key={group.label} items={group.items}>
              {index > 0 && <ComboboxSeparator />}
              <ComboboxLabel>{group.label}</ComboboxLabel>
              <ComboboxCollection>
                {(item: SearchResult) => (
                  <ComboboxItem key={item.id} value={""}>
                    {item.type === "book" ? (
                      <BookItem item={item} />
                    ) : (
                      <CharacterItem item={item} />
                    )}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function BookItem({ item }: { item: BookResultType }) {
  return (
    <div className="flex items-center gap-2">
      <BookOpenIcon className="shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate font-medium">{item.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.authors}
        </div>
      </div>
    </div>
  );
}

function CharacterItem({ item }: { item: CharacterResultType }) {
  return (
    <div className="flex items-center gap-2">
      <UserIcon className="shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.books[0].title}
        </div>
      </div>
    </div>
  );
}
