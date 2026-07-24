import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Music2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="size-16 rounded-2xl bg-primary/10 grid place-items-center">
        <Music2 className="size-8 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight">Empire Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Ambiente de testes</p>
      </div>
      <Link
        to="/play"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
      >
        <Play className="size-4" />
        Abrir Empire Play
      </Link>
    </main>
  );
}
