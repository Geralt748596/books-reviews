"use client";

import React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Book } from "@/prisma/generated/browser";
import { toast } from "sonner";
import { generateBookCover } from "@/lib/actions/images";

interface AddCoversProps {
  className?: string;
  bookId: Book["id"];
}

export function AddCovers({ className, bookId }: AddCoversProps) {
  const [open, setOpen] = React.useState(false);

  const handleSuccess = (userPrompt: string) => {
    generateBookCover(bookId, { userPrompt })
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Cover generated successfully!");
        setOpen(false);
        // router.refresh();
      })
      .catch((error) => {
        toast.error("Failed to generate cover");
        console.error(error);
      });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className={className}>
            <ImageIcon className="mr-2 w-20" />
            Add Cover
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Cover</DialogTitle>
          <DialogDescription>Add a cover to your book.</DialogDescription>
        </DialogHeader>
        <AddCoversForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}

const formSchema = z.object({
  prompt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddCoversFormProps {
  onSuccess: (prompt: string) => void;
}

function AddCoversForm({ onSuccess }: AddCoversFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
  });

  function onSubmit(values: FormValues) {
    console.log(values);
    if (!values.prompt?.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    onSuccess(values.prompt);
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="E.g. A book cover with a young woman reading a book..."
                  className="min-h-24"
                  maxLength={200}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          disabled={
            form.formState.isSubmitting ||
            !form.formState.isValid ||
            !form.formState.isDirty
          }
          type="submit"
        >
          {form.formState.isSubmitting ? "Generating…" : "Generate Cover"}
        </Button>
      </form>
    </Form>
  );
}
