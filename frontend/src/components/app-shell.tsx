/**
 * Top-level navigation + WS connection badge. Dumb composition only —
 * feature panels stay portable for future dialog layouts.
 */

import { Link, useLocation } from "@tanstack/react-router";
import {
  PlugsConnectedIcon,
  PlugsIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { useSocket } from "@/src/hooks/use-socket";
import { cn } from "cnfast";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/macros", label: "Macros" },
] as const;

function ConnectionBadge() {
  const { connection } = useSocket();
  const label =
    connection === "open"
      ? "Connected"
      : connection === "connecting"
        ? "Connecting…"
        : "Disconnected";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-4xl border px-2.5 py-1 text-xs",
        connection === "open" &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        connection === "connecting" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        connection === "closed" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      title={`WebSocket: ${connection}`}
    >
      {connection === "open" ? (
        <PlugsConnectedIcon size={14} weight="fill" />
      ) : connection === "connecting" ? (
        <SpinnerGapIcon size={14} className="animate-spin" />
      ) : (
        <PlugsIcon size={14} weight="fill" />
      )}
      {label}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="font-heading text-lg font-semibold text-foreground"
          >
            win-bc-controller
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-4xl px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto">
            <ConnectionBadge />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center">{children}</main>
    </div>
  );
}
