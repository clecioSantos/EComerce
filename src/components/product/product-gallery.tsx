"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface GalleryImage {
  url: string;
  alt?: string | null;
}

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, images.length - 1));
  const primary = images[index];
  function move(direction: number) {
    setSelected((index + direction + images.length) % images.length);
  }
  const controls =
    images.length > 1 ? (
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Imagem anterior"
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </Button>
        <p className="text-sm" aria-live="polite" aria-atomic="true">
          Imagem {index + 1} de {images.length}
        </p>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próxima imagem"
          onClick={() => move(1)}
        >
          <ChevronRight />
        </Button>
      </div>
    ) : null;

  return (
    <div className="min-w-0 space-y-4">
      {primary ? (
        <Dialog>
          <DialogTrigger
            className="group bg-muted relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden outline-offset-4 focus-visible:outline-2"
            aria-label={`Ampliar imagem de ${title}`}
          >
            <Image
              src={primary.url}
              alt={primary.alt || title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="eager"
              className="object-cover"
            />
            <span className="bg-background/95 absolute right-4 bottom-4 flex items-center gap-2 px-3 py-2 text-sm">
              <ZoomIn className="size-4" /> Ampliar
            </span>
          </DialogTrigger>
          <DialogContent
            className="max-h-[95dvh] w-[calc(100%-2rem)] max-w-5xl sm:max-w-5xl"
            onKeyDown={(event) => {
              if (images.length < 2) return;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(-1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(1);
              }
            }}
          >
            <DialogTitle className="pr-8">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Imagem ampliada. Use as setas para navegar entre as fotos.
            </DialogDescription>
            <div className="bg-muted relative h-[65dvh]">
              <Image
                src={primary.url}
                alt={primary.alt || title}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            {controls}
          </DialogContent>
        </Dialog>
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-[4/5] items-center justify-center text-sm">
          Sem imagem
        </div>
      )}
      {images.length > 1 ? (
        <>
          {controls}
          <div
            className="flex gap-3 overflow-x-auto p-1"
            aria-label="Escolher foto do produto"
          >
            {images.map((image, imageIndex) => (
              <button
                key={`${image.url}-${imageIndex}`}
                type="button"
                onClick={() => setSelected(imageIndex)}
                aria-label={`Ver imagem ${imageIndex + 1} de ${title}`}
                aria-pressed={index === imageIndex}
                className={`bg-muted relative aspect-[4/5] w-20 shrink-0 overflow-hidden outline-offset-2 focus-visible:outline-2 ${index === imageIndex ? "ring-primary ring-2 ring-offset-2" : "opacity-65 hover:opacity-100"}`}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
