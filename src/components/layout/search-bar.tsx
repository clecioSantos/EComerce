"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = term.trim();
    router.push(query.length > 0 ? `/busca?q=${encodeURIComponent(query)}` : "/produtos");
  }

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar produtos..."
          aria-label="Buscar produtos"
          className="pr-20 pl-9"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          Buscar
        </Button>
      </div>
    </form>
  );
}
