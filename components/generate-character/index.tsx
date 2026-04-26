"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon } from "lucide-react";
import { GenerateImageForm } from "./components/generate-image-form";
import { UploadImageForm } from "./components/upload-image-form";
import { Book } from "@/prisma/generated/browser";

type GenerateCharacterDialogProps = {
  className?: string;
  bookId: Book["id"];
} & React.ComponentProps<typeof Button>;

export function GenerateCharacterDialog({
  className,
  bookId,
  ...props
}: GenerateCharacterDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className={className} {...props}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Generate Character Image
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Character Image</DialogTitle>
          <DialogDescription>
            Generate an AI illustration or upload your own image.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate with AI</TabsTrigger>
            <TabsTrigger value="upload">Upload image</TabsTrigger>
          </TabsList>
          <TabsContent value="generate" className="mt-4">
            <GenerateImageForm
              bookId={bookId}
              onSuccess={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <UploadImageForm bookId={bookId} onSuccess={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
