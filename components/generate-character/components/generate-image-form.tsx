"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import { CharacterPicker } from "@/components/create-post/components/character-picker";
import { generateCharacterImage } from "@/lib/actions/images";
import { Book } from "@/prisma/generated/browser";

const formSchema = z.object({
  characterId: z.string().min(1, "Pick a character"),
  userPrompt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GenerateImageFormProps {
  onSuccess?: () => void;
  bookId: Book["id"];
}

export function GenerateImageForm({
  onSuccess,
  bookId,
}: GenerateImageFormProps) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { characterId: undefined, userPrompt: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    const result = await generateCharacterImage(bookId, values.characterId, {
      userPrompt: values.userPrompt,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Image generated successfully!");
    form.reset();
    onSuccess?.();
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="characterId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Character (Optional)</FormLabel>
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
          name="userPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Prompt (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="E.g. cinematic lighting, watercolor style..."
                  className="min-h-24 resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? "Generating…" : "Generate"}
        </Button>
      </form>
    </Form>
  );
}
