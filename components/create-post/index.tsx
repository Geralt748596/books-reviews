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
import { PlusCircleIcon } from "lucide-react";
import { CreatePostForm } from "./components/create-post-form";

interface CreatePostProps {
  className?: string;
}

export function CreatePost({ className }: CreatePostProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className={className}>
            <PlusCircleIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Post</DialogTitle>
          <DialogDescription>
            Share your thoughts about a book or character.
          </DialogDescription>
        </DialogHeader>
        <CreatePostForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
