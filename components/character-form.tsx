"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { addCharacter, updateCharacter } from "@/lib/actions/characters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const CharacterFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

type CharacterFormValues = z.infer<typeof CharacterFormSchema>

interface CharacterFormProps {
  bookId: string
  existingCharacter?: {
    id: string
    name: string
    description: string | null
  }
  onSuccess?: () => void
}

export function CharacterForm({ bookId, existingCharacter, onSuccess }: CharacterFormProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEditing = !!existingCharacter

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CharacterFormValues>({
    resolver: zodResolver(CharacterFormSchema),
    defaultValues: {
      name: existingCharacter?.name ?? "",
      description: existingCharacter?.description ?? "",
    },
  })

  function onSubmit(values: CharacterFormValues) {
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const result = isEditing
        ? await updateCharacter(existingCharacter.id, {
            name: values.name,
            description: values.description || undefined,
          })
        : await addCharacter(bookId, {
            name: values.name,
            description: values.description || undefined,
          })

      if ("error" in result) {
        setErrorMsg(result.error)
      } else {
        setSuccessMsg(isEditing ? "Character updated!" : "Character added!")
        if (!isEditing) {
          reset()
        }
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="character-name">Name</Label>
        <Input
          id="character-name"
          placeholder="Character name"
          {...register("name")}
          disabled={isPending}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="character-description">Description (optional)</Label>
        <Textarea
          id="character-description"
          placeholder="Brief description of the character"
          rows={3}
          {...register("description")}
          disabled={isPending}
        />
      </div>

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
      {successMsg && (
        <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending
          ? isEditing
            ? "Updating..."
            : "Adding..."
          : isEditing
            ? "Update Character"
            : "Add Character"}
      </Button>
    </form>
  )
}
