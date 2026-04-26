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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CharacterPicker } from "@/components/create-post/components/character-picker";
import { uploadCharacterImage } from "@/lib/actions/images";
import { Book } from "@/prisma/generated/browser";

const MAX_UPLOAD_SIZE = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const formSchema = z.object({
  characterId: z.string().min(1, "Pick a character"),
  file: z
    .instanceof(File, { message: "Please select an image" })
    .refine((file) => file.size > 0, "Please select an image")
    .refine(
      (file) => file.size <= MAX_UPLOAD_SIZE,
      "File must be 3 MB or smaller",
    )
    .refine(
      (file) => ALLOWED_TYPES.includes(file.type),
      "Only PNG, JPEG or WebP images are allowed",
    ),
});

type FormValues = z.infer<typeof formSchema>;

interface UploadImageFormProps {
  onSuccess?: () => void;
  bookId: Book["id"];
}

export function UploadImageForm({ onSuccess, bookId }: UploadImageFormProps) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { characterId: "", file: undefined },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    const formData = new FormData();
    formData.append("characterId", values.characterId);
    formData.append("file", values.file);

    const result = await uploadCharacterImage(bookId, formData);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Image uploaded successfully!");
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
              <FormLabel>Character</FormLabel>
              <FormControl>
                <CharacterPicker
                  bookId={bookId}
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value ?? "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="file"
          render={({ field: { onChange, ref, name, onBlur, disabled } }) => (
            <FormItem>
              <FormLabel>Image (max 3 MB)</FormLabel>
              <FormControl>
                <Input
                  ref={ref}
                  name={name}
                  onBlur={onBlur}
                  disabled={disabled}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    onChange(file);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </Form>
  );
}
