"use client";

import { CharacterPicker } from "@/components/create-post/components/character-picker";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { getBookCharacters } from "@/lib/actions/characters";
import { createPost } from "@/lib/actions/posts";
import { zodResolver } from "@hookform/resolvers/zod";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Italic from "@tiptap/extension-italic";
import Mention from "@tiptap/extension-mention";
import OrderedList from "@tiptap/extension-ordered-list";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  content: z
    .string()
    .max(8000)
    .refine((value) => {
      const text = value
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.length >= 1 && text.length <= 2000;
    }, "Write a comment up to 2000 characters"),
  characterId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  bookId: string;
  characterId?: string;
};

export function CommentForm({ bookId, characterId }: Props) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      characterId,
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  const lockedToCharacter = Boolean(characterId);

  async function onSubmit(values: FormValues) {
    const result = await createPost({
      content: values.content,
      bookId,
      characterId: characterId ?? values.characterId,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Comment posted");
    form.reset({ content: "", characterId });
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {lockedToCharacter ? null : (
          <FormField
            control={form.control}
            name="characterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Character</FormLabel>
                <FormControl>
                  <CharacterPicker
                    bookId={bookId}
                    value={field.value ?? ""}
                    onChange={(id) => field.onChange(id ?? undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Comment</FormLabel>
              <FormControl>
                <CommentEditor
                  bookId={bookId}
                  value={field.value}
                  disabled={isSubmitting}
                  placeholder={
                    lockedToCharacter
                      ? "What do you think about this character?"
                      : "What do you think about this book?"
                  }
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? "Posting…" : "Post comment"}
        </Button>
      </form>
    </Form>
  );
}

type MentionItem = { id: string; label: string };

const charactersByBook = new Map<string, MentionItem[]>();

function CommentEditor({
  bookId,
  value,
  disabled,
  placeholder,
  onChange,
  onBlur,
}: {
  bookId: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (html: string) => void;
  onBlur: () => void;
}) {
  useEffect(() => {
    let cancelled = false;
    getBookCharacters(bookId).then((result) => {
      if (cancelled) return;
      charactersByBook.set(
        bookId,
        result.map((character) => ({
          id: character.id,
          label: character.name,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
      }),
      Bold,
      Italic,
      BulletList,
      OrderedList,
      Blockquote,
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: {
          char: "@",
          items: ({ query }) => {
            const source = charactersByBook.get(bookId) ?? [];
            const normalized = query.toLowerCase();
            return source
              .filter((character) =>
                character.label.toLowerCase().includes(normalized),
              )
              .slice(0, 8);
          },
          render: () => {
            let component: ReactRenderer<MentionListHandle, MentionListProps>;
            let unmount: (() => void) | undefined;

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });
                unmount = props.mount(component.element);
              },
              onUpdate: (props) => {
                component.updateProps(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") return true;
                return component.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                unmount?.();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": "Comment",
        class: "min-h-20 px-2.5 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    onBlur: () => {
      onBlur();
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
    if (value === "" && !editor.isEmpty) {
      editor.commands.clearContent();
    }
  }, [disabled, editor, value]);

  const isEmpty = !editor || editor.isEmpty;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex gap-1 border-b border-input px-1 py-1">
        <EditorButton
          label="Bold"
          pressed={editor?.isActive("bold") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </EditorButton>
        <EditorButton
          label="Italic"
          pressed={editor?.isActive("italic") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </EditorButton>
        <EditorButton
          label="Bullet list"
          pressed={editor?.isActive("bulletList") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </EditorButton>
        <EditorButton
          label="Numbered list"
          pressed={editor?.isActive("orderedList") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </EditorButton>
        <EditorButton
          label="Quote"
          pressed={editor?.isActive("blockquote") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </EditorButton>
      </div>
      <div className="relative">
        {isEmpty ? (
          <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted-foreground">
            {placeholder}
          </span>
        ) : null}
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror_blockquote]:my-2 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_p]:my-0 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.mention]:rounded [&_.mention]:bg-primary/15 [&_.mention]:px-1 [&_.mention]:text-primary"
        />
      </div>
    </div>
  );
}

type MentionKeyDownProps = { event: globalThis.KeyboardEvent };

type MentionListHandle = {
  onKeyDown: (props: MentionKeyDownProps) => boolean;
};

type MentionListProps = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

function MentionList({
  ref,
  items,
  command,
}: MentionListProps & {
  ref?: Ref<MentionListHandle>;
}) {
  const itemsKey = items.map((item) => item.id).join("\0");
  const [trackedItemsKey, setTrackedItemsKey] = useState(itemsKey);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (trackedItemsKey !== itemsKey) {
    setTrackedItemsKey(itemsKey);
    setSelectedIndex(0);
  }

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex(
            (index) => (index + items.length - 1) % items.length,
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }),
    [command, items, selectedIndex],
  );

  return (
    <div className="z-50 max-h-60 min-w-48 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
      {items.length ? (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full rounded-md px-2 py-1.5 text-left text-sm",
              index === selectedIndex && "bg-accent text-accent-foreground",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              selectItem(index);
            }}
          >
            {item.label}
          </button>
        ))
      ) : (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          No characters
        </p>
      )}
    </div>
  );
}

function EditorButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className="aria-pressed:bg-muted"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
