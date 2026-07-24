import {
  Outlet,
  Link,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Home, Play } from "lucide-react";
import { PlayProvider } from "../lib/playContext";
import { MiniPlayer } from "../components/MiniPlayer";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: RootComponent,
});

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Início", icon: Home },
    { to: "/play", label: "Empire Play", icon: Play },
  ];
  return (
    <nav
      className="fixed inset-x-0 z-40 pointer-events-none"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-fit pointer-events-auto">
        <div
          className="flex items-stretch gap-0.5 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-1 shadow-2xl"
          style={{ backdropFilter: "blur(28px) saturate(180%)" }}
        >
          {items.map((it) => {
            const active =
              pathname === it.to ||
              (it.to !== "/" && pathname.startsWith(it.to));
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                aria-label={it.label}
                className={`relative flex flex-col items-center justify-center gap-0.5 h-12 w-20 rounded-full transition-all ${
                  active
                    ? "text-white bg-white/10"
                    : "text-white/40"
                }`}
              >
                <Icon
                  className="size-[18px]"
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-[9px] font-bold uppercase tracking-tight leading-none">
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function RootComponent() {
  return (
    <PlayProvider>
      <div className="min-h-screen flex flex-col bg-background" style={{ paddingBottom: "6rem" }}>
        <Outlet />
        <MiniPlayer />
        <BottomNav />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </PlayProvider>
  );
}
