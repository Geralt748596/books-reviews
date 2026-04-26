"use client";

import React from "react";
import { BookOpenIcon, LoaderIcon } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { findBook } from "@/lib/actions/books";
import { useDebounce } from "use-debounce";

type BookOption = { id: string; title: string };

interface BookPickerProps {
  value: string;
  onChange: (bookId: string) => void;
  onBookSelected?: (book: BookOption | null) => void;
}

const DEBOUNCE_MS = 300;

export function BookPicker({
  value,
  onChange,
  onBookSelected,
}: BookPickerProps) {
  const [options, setOptions] = React.useState<BookOption[]>([]);
  const [isPending, setIsPending] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [debouncedValue] = useDebounce(inputValue, DEBOUNCE_MS);

  React.useEffect(() => {
    const q = debouncedValue.trim();
    if (!q) {
      setOptions([]);
      setIsPending(false);
      return;
    }

    let cancelled = false;
    setIsPending(true);

    findBook(q).then((results) => {
      if (cancelled) return;
      setOptions(results);
      setIsPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue]);

  function handleInputChange(val: string) {
    setInputValue(val);
    if (!val.trim()) {
      setOptions([]);
      setIsPending(false);
      if (value) {
        onChange("");
        onBookSelected?.(null);
      }
    } else {
      setIsPending(true);
    }
  }

  function handleValueChange(book: BookOption | null) {
    if (!book) return;
    onChange(book.id);
    onBookSelected?.(book);
  }

  return (
    <Combobox
      items={options}
      filter={null}
      onInputValueChange={handleInputChange}
      onValueChange={handleValueChange}
      itemToStringLabel={(item: BookOption) => item.title}
      itemToStringValue={(item: BookOption) => item.id}
    >
      <ComboboxInput placeholder="Search for a book…" showTrigger={false}>
        <InputGroupAddon align="inline-start">
          {isPending ? (
            <LoaderIcon className="animate-spin" />
          ) : (
            <BookOpenIcon />
          )}
        </InputGroupAddon>
      </ComboboxInput>

      <ComboboxContent alignOffset={-24} sideOffset={10}>
        <ComboboxEmpty>
          {isPending ? "Searching…" : "No books found."}
        </ComboboxEmpty>
        <ComboboxList>
          {(book: BookOption) => (
            <ComboboxItem key={book.id} value={book}>
              {book.title}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
