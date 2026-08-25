import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import {
  CaretDownIcon,
  CopyIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { activatePreset, listPresets } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";
import type { PresetInfo } from "@/src/lib/types";
import { cn } from "cnfast";

export function PresetPicker({
  selected,
  onSelect,
  onDuplicate,
  refreshKey = 0,
}: {
  selected: string | null;
  onSelect: (preset: PresetInfo) => void;
  onDuplicate: (name: string) => void;
  /** Bump to re-fetch the preset list (after save / delete). */
  refreshKey?: number;
}) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { macroActive } = useMacroRunner();

  const refresh = useCallback(() => {
    setLoading(true);
    Effect.runPromise(listPresets())
      .then((r) => {
        setPresets(r.presets);
        setError(null);
      })
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const activate = useCallback(
    async (name: string) => {
      setBusy(name);
      setError(null);
      const ok = await Effect.runPromise(activatePreset(name))
        .then(() => true)
        .catch((error: unknown) => {
          setError(errorMessage(error));
          return false;
        });
      setBusy(null);
      if (ok) refresh();
    },
    [refresh],
  );

  const activePreset = presets.find((p) => p.active) ?? null;

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Presets</h2>
        <span className="ms-auto text-xs text-muted-foreground">
          active: {activePreset?.name ?? "none"}
        </span>
      </div>

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="relative">
        <select
          value={selected ?? activePreset?.name ?? ""}
          onChange={(e) => {
            const match = presets.find((p) => p.name === e.target.value);
            if (match) onSelect(match);
          }}
          disabled={loading}
          aria-label="Select preset to view"
          className={cn(
            "h-9 w-full appearance-none rounded-4xl border border-border bg-background px-3 pe-9 text-sm",
            "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "disabled:opacity-50",
          )}
        >
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.builtin ? " (built-in)" : ""}
              {p.active ? " — active" : ""}
            </option>
          ))}
        </select>
        <CaretDownIcon
          size={16}
          weight="bold"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {presets.map((p) => (
            <li
              key={p.name}
              className={cn(
                "flex flex-wrap items-center gap-2 px-3 py-2 text-sm",
                selected === p.name && "bg-muted/60",
                p.active && "bg-primary/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono">
                  {p.name}
                  {p.builtin && (
                    <span className="ms-2 rounded-4xl bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                      built-in
                    </span>
                  )}
                  {p.active && (
                    <span className="ms-2 rounded-4xl bg-primary/10 px-2 py-0.5 text-[10px] tracking-wide text-primary uppercase">
                      active
                    </span>
                  )}
                </p>
                {p.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {p.builtin && (
                  <button
                    type="button"
                    className="inline-flex h-6 items-center gap-1 rounded-4xl border border-border px-2.5 text-xs hover:bg-muted"
                    onClick={() => onDuplicate(p.name)}
                    title="Duplicate as custom preset"
                  >
                    <CopyIcon size={12} /> Duplicate
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-1 rounded-4xl bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                  onClick={() => void activate(p.name)}
                  disabled={p.active || macroActive || busy !== null}
                  title={
                    macroActive
                      ? "Presets are locked while a macro runs"
                      : "Activate this preset"
                  }
                >
                  {busy === p.name ? (
                    <SpinnerGapIcon size={12} className="animate-spin" />
                  ) : null}
                  {p.active ? "Active" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {macroActive && (
        <p className="text-xs text-muted-foreground">
          Presets are locked while a macro is running.
        </p>
      )}
    </section>
  );
}
