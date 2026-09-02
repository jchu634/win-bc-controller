/**
 * Macro list + run controls (start / pause / resume / stop).
 * Self-contained panel: usable from the /macros route or a dialog.
 */

import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import {
  FilePlusIcon,
  PauseIcon,
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { useSocket } from "@/src/hooks/use-socket";
import { listMacros } from "@/src/lib/api";
import { cn } from "cnfast";

export function MacroRunPanel({
  selected,
  onSelect,
  onCreate,
  refreshKey = 0,
}: {
  selected: string | null;
  onSelect: (name: string) => void;
  onCreate?: () => void;
  /** Bump to re-fetch the macro list (after create / delete). */
  refreshKey?: number;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { mode, macro, macroActive, isPaused, startByName, pause, resume, cancel } =
    useMacroRunner();
  const { lastError, clearError } = useSocket();

  const refresh = useCallback(() => {
    setLoading(true);
    Effect.runPromise(listMacros())
      .then((r) => {
        setNames(r.names);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const wsError =
    lastError !== null && lastError.message !== "" ? lastError : null;

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Macros</h2>
        {macroActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-4xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {isPaused ? "Paused" : "Running"}: {macro?.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            mode: {mode}
          </span>
        )}
        <div className="ms-auto flex items-center gap-2">
          {isPaused ? (
            <Button size="sm" variant="outline" onClick={resume}>
              <PlayIcon size={14} weight="fill" /> Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={pause}
              disabled={!macroActive}
            >
              <PauseIcon size={14} weight="fill" /> Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={cancel}
            disabled={!macroActive}
          >
            <StopIcon size={14} weight="fill" /> Stop
          </Button>
        </div>
      </div>

      {wsError !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="flex-1">
            {wsError.message}
            {wsError.detail ? ` — ${wsError.detail}` : ""}
          </p>
          <Button size="xs" variant="ghost" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex min-h-28 max-h-[calc(100svh-11rem)] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-border bg-muted/30 p-2 [scrollbar-gutter:stable]">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl py-6 text-sm text-muted-foreground">
            <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
          </div>
        ) : error !== null ? (
          <div className="flex flex-1 flex-col items-center gap-2 rounded-xl py-6 text-sm">
            <WarningIcon size={20} className="text-destructive" />
            <p>{error}</p>
            <Button size="xs" variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        ) : names.length === 0 ? (
          <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-dashed border-border py-6 text-sm text-muted-foreground">
            <p>No macros yet.</p>
            {onCreate !== undefined && (
              <Button size="xs" variant="outline" onClick={onCreate}>
                <FilePlusIcon size={14} /> New macro
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {names.map((name) => {
              const isActive = macroActive && macro?.name === name;
              return (
                <li
                  key={name}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm",
                    isActive && "bg-primary/5",
                    selected === name && "bg-muted/60",
                  )}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start px-1 font-mono font-normal"
                    onClick={() => onSelect(name)}
                    title={name}
                  >
                    <span className="truncate">{name}</span>
                  </Button>
                  {isActive && isPaused && (
                    <span className="text-xs text-muted-foreground">paused</span>
                  )}
                  <Button
                    size="xs"
                    variant={isActive ? "secondary" : "default"}
                    disabled={macroActive && !isActive && !isPaused}
                    onClick={() => startByName(name)}
                    title={isActive ? "Restart" : "Run"}
                  >
                    <PlayIcon size={12} weight="fill" />
                    {isActive ? "Restart" : "Run"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
