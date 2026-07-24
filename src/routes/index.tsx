import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Music2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1.5rem",
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "rgba(255,255,255,0.06)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Music2 size={28} color="#fff" />
      </div>
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            color: "#fff",
            margin: 0,
          }}
        >
          Empire Hub
        </h1>
        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          Ambiente de testes
        </p>
      </div>
      <Link
        to="/play"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          color: "#000",
          borderRadius: 999,
          padding: "12px 24px",
          fontSize: "0.8rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          textDecoration: "none",
        }}
      >
        <Play size={14} />
        Abrir Empire Play
      </Link>
    </main>
  );
}
