import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import { SpinnerGapIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { activatePreset, deletePreset, listPresets } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";
import type { PresetInfo } from "@/src/lib/types";
import { cn } from "cnfast";

export function PresetPicker({
  selected,
  onSelect,
  onDeleted,
  refreshKey = 0,
}: {
  selected: string | null;
  onSelect: (preset: PresetInfo) => void;
  onDeleted?: (name: string) => void;
  /** Bump to re-fetch the preset list (after save / delete). */
  refreshKey?: number;
}) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PresetInfo | null>(null);
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

  const remove = useCallback(async () => {
    if (deleting === null) return;
    const filename = deleting.filename;
    setBusy(filename);
    const ok = await Effect.runPromise(deletePreset(filename))
      .then(() => true)
      .catch((error: unknown) => {
        setError(errorMessage(error));
        return false;
      });
    setBusy(null);
    if (!ok) return;
    setDeleting(null);
    onDeleted?.(filename);
    refresh();
  }, [deleting, onDeleted, refresh]);

  return (
    <section className="flex flex-col gap-3 text-left">
      <h2 className="text-lg font-semibold text-foreground">Presets</h2>

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="flex-1">{error}</p>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {presets.map((p) => (
            <li
              key={p.filename}
              className={cn(
                "flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-blue-200/40",
                p.active && "bg-primary/5",
                selected === p.filename && "bg-blue-200",
              )}
            >
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start rounded-none p-0 text-left font-normal hover:bg-transparent"
                onClick={() => onSelect(p)}
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
              </Button>
              <div className="flex items-center gap-1.5">
                {!p.builtin && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleting(p);
                    }}
                    disabled={busy !== null}
                    title={`Delete ${p.name}`}
                    aria-label={`Delete ${p.name}`}
                  >
                    <TrashIcon size={14} />
                  </Button>
                )}
                <Button
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    void activate(p.filename);
                  }}
                  disabled={p.active || macroActive || busy !== null}
                  title={
                    macroActive
                      ? "Presets are locked while a macro runs"
                      : "Activate this preset"
                  }
                >
                  {busy === p.filename ? (
                    <SpinnerGapIcon size={12} className="animate-spin" />
                  ) : null}
                  {p.active ? "Active" : "Activate"}
                </Button>
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
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && busy === null) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete preset?</DialogTitle>
            <DialogDescription>
              {deleting === null
                ? "This preset will be deleted."
                : `Delete "${deleting.name}"? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={busy !== null}
            >
              {busy === deleting?.filename && (
                <SpinnerGapIcon size={14} className="animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
