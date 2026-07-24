import {
  Outlet,
  Link,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { Home, Music2, Play } from "lucide-react";
import { PlayProvider } from "@/lib/playContext";
import { MiniPlayer } from "@/components/MiniPlayer";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "Empire Play — Testes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  ssr: false,
  component: RootComponent,
});

function BottomNav() {
  const { pathname } = useLocation();
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
            const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 h-12 w-20 rounded-full transition-all ${
                  active
                    ? "text-primary-foreground bg-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.5 : 2} />
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
      <div
        className="min-h-screen flex flex-col bg-background pb-24"
        style={{ paddingTop: "1rem" }}
      >
        <Outlet />
        <MiniPlayer />
        <BottomNav />
        <Toaster position="top-center" richColors closeButton offset={80} />
      </div>
    </PlayProvider>
  );
}
