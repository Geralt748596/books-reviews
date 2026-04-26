"use client";

import React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ImageCardProps {
  image: {
    id: string;
    blobUrl: string;
    prompt: string;
    book: {
      title: string;
    };
    character: {
      name: string;
    } | null;
  };
}

export function ImageCard({ image }: ImageCardProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Card className="w-full overflow-hidden pt-0 cursor-pointer transition-colors hover:bg-muted/50">
          <CardContent className="p-0">
            <Image
              src={image.blobUrl}
              alt={image.prompt}
              width={300}
              height={200}
              className="w-full h-auto max-h-60 aspect-square object-cover"
              loading="eager"
            />
          </CardContent>
          <CardHeader>
            <CardTitle className="line-clamp-1">{image.book.title}</CardTitle>
            {image.character && (
              <CardDescription className="line-clamp-1">
                Character: {image.character.name}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      </DialogTrigger>
      <DialogContent className="xl:max-w-4xl w-full p-0 overflow-hidden border-none bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{image.book.title}</DialogTitle>
          <DialogDescription>{image.prompt}</DialogDescription>
        </DialogHeader>
        <div className="relative w-full h-[80vh] flex items-center justify-center bg-card">
          <Image
            src={image.blobUrl}
            alt={image.prompt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
