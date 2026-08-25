import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Button } from "@/src/components/ui/button";
import { PresetEditor } from "@/src/components/preset/preset-editor";
import { PresetPicker } from "@/src/components/preset/preset-picker";
import { getPreset, putPreset } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

function PresetsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuiltin, setSelectedBuiltin] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [dupError, setDupError] = useState<string | null>(null);

  const pick = useCallback((name: string, builtin: boolean) => {
    setSelected(name);
    setSelectedBuiltin(builtin);
  }, []);

  const startDuplicate = useCallback((name: string) => {
    setDuplicating(name);
    setNewName(`${name} copy`);
    setDupError(null);
  }, []);

  const submitDuplicate = useCallback(async () => {
    if (duplicating === null) return;
    const target = newName.trim();
    if (!NAME_PATTERN.test(target)) {
      setDupError(
        "Letters, digits, spaces, '_' and '-' only; must start with a letter or digit.",
      );
      return;
    }
    const ok = await Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* getPreset(duplicating);
        return yield* putPreset(target, source.contents);
      }),
    )
      .then(() => true)
      .catch((error: unknown) => {
        setDupError(errorMessage(error));
        return false;
      });
    if (ok) {
      setDuplicating(null);
      pick(target, false);
      setListVersion((v) => v + 1);
    }
  }, [duplicating, newName, pick]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Presets
        </h1>
        <p className="text-sm text-muted-foreground">
          Button / stick / trigger mappings applied to the physical
          controller. Built-ins are read-only; duplicate one to customise.
        </p>
      </header>

      {duplicating !== null && (
        <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-left">
          <h2 className="text-sm font-semibold">
            Duplicate “{duplicating}” as
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitDuplicate();
                if (e.key === "Escape") setDuplicating(null);
              }}
              placeholder="new preset name"
              aria-label="New preset name"
              className="h-9 flex-1 min-w-50 rounded-4xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Button size="sm" onClick={() => void submitDuplicate()}>
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDuplicating(null)}
            >
              Cancel
            </Button>
          </div>
          {dupError !== null && (
            <p className="text-sm text-destructive">{dupError}</p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <PresetPicker
          selected={selected}
          onSelect={(p) => pick(p.name, p.builtin)}
          onDuplicate={startDuplicate}
          refreshKey={listVersion}
        />
        <PresetEditor
          name={selected}
          builtin={selectedBuiltin}
          onDuplicate={startDuplicate}
          onDeleted={() => {
            setSelected(null);
            setSelectedBuiltin(false);
            setListVersion((v) => v + 1);
          }}
          onSaved={() => setListVersion((v) => v + 1)}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/presets")({
  component: PresetsPage,
});
