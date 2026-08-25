import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { FilePlusIcon } from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import {
  MacroEditor,
  NEW_MACRO_TEMPLATE,
} from "@/src/components/macro/macro-editor";
import { MacroRunPanel } from "@/src/components/macro/macro-run-panel";
import { putMacro } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

function MacrosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const startCreate = useCallback(() => {
    setCreating(true);
    setNewName("");
    setCreateError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    if (!NAME_PATTERN.test(name)) {
      setCreateError(
        "Letters, digits, spaces, '_' and '-' only; must start with a letter or digit.",
      );
      return;
    }
    const ok = await Effect.runPromise(putMacro(name, NEW_MACRO_TEMPLATE))
      .then(() => true)
      .catch((error: unknown) => {
        setCreateError(errorMessage(error));
        return false;
      });
    if (ok) {
      setCreating(false);
      setListVersion((v) => v + 1);
      setSelected(name);
    }
  }, [newName]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Macros
        </h1>
        <p className="text-sm text-muted-foreground">
          Recordable input sequences played over the WebSocket channel.
        </p>
      </header>

      {creating ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-left">
          <h2 className="text-sm font-semibold">New macro</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="macro name"
              aria-label="New macro name"
              className="h-9 flex-1 min-w-50 rounded-4xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Button size="sm" onClick={() => void submitCreate()}>
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
          {createError !== null && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
        </section>
      ) : (
        <div>
          <Button size="sm" variant="outline" onClick={startCreate}>
            <FilePlusIcon size={14} /> New macro
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_2fr]">
        <MacroRunPanel
          selected={selected}
          onSelect={setSelected}
          onCreate={startCreate}
          refreshKey={listVersion}
        />
        <MacroEditor
          name={selected}
          onDeleted={() => {
            setSelected(null);
            setListVersion((v) => v + 1);
          }}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/macros")({
  component: MacrosPage,
});
