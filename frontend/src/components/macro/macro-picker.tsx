import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import {
  FilePlusIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import { listMacros } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";

export type MacroPickerProps = {
  selected: string | null;
  onSelect: (name: string) => void;
  onCreate: () => void;
  refreshKey?: number;
};

export function MacroPicker({
  selected,
  onSelect,
  onCreate,
  refreshKey = 0,
}: MacroPickerProps) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Effect.runPromise(listMacros())
      .then((response) => {
        setNames(response.names);
        setError(null);
      })
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return (
    <section className="flex min-w-0 flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Macros</h2>
        <Button
          size="sm"
          variant="outline"
          className="ms-auto"
          onClick={onCreate}
        >
          <FilePlusIcon size={14} /> New macro
        </Button>
      </div>

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1 wrap-break-words">{error}</p>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="max-h-[calc(100svh-11rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-muted/30 p-2 [scrollbar-gutter:stable]">
        {loading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground">
            <SpinnerGapIcon size={16} className="animate-spin" /> Loading...
          </div>
        ) : names.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground">
            No macros yet. Create one to get started.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {names.map((name) => (
              <li key={name}>
                <Button
                  variant={selected === name ? "secondary" : "outline"}
                  className="h-auto w-full justify-start rounded-xl px-3 py-2 font-mono font-normal"
                  onClick={() => onSelect(name)}
                  title={name}
                >
                  <span className="truncate">{name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
