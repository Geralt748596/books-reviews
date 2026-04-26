"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BookPicker } from "./book-picker";
import { CharacterPicker } from "./character-picker";
import { createPost } from "@/lib/actions/posts";

const formSchema = z.object({
  content: z.string().min(1, "Write something about the book"),
  bookId: z.string().min(1, "Pick a book"),
  characterId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreatePostFormProps {
  onSuccess?: () => void;
}

export function CreatePostForm({ onSuccess }: CreatePostFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "", bookId: "", characterId: undefined },
  });

  const bookId = form.watch("bookId");
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    const result = await createPost(values);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Post created");
    form.reset();
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="bookId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Book</FormLabel>
              <FormControl>
                <BookPicker
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id);
                    form.setValue("characterId", undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What do you think about this book?"
                  className="min-h-24 resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? "Publishing…" : "Publish"}
        </Button>
      </form>
    </Form>
  );
}
