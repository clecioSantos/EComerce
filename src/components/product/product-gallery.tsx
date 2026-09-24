import Image from "next/image";

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
  const primary = images[0];

  return (
    <div className="space-y-3">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
        {primary ? (
          <Image
            src={primary.url}
            alt={primary.alt ?? title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Sem imagem
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(1, 5).map((image) => (
            <div
              key={image.url}
              className="bg-muted relative aspect-square overflow-hidden rounded-md"
            >
              <Image
                src={image.url}
                alt={image.alt ?? title}
                fill
                sizes="120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
