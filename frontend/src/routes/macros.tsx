import { useCallback, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Effect } from "effect";
import { ArrowLeftIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import {
  MacroEditor,
  type MacroEditorHandle,
} from "@/src/components/macro/macro-editor";
import { MacroPicker } from "@/src/components/macro/macro-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { putMacro } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";
import { createMacroDocument } from "@/src/lib/macro-document";

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

function MacrosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [creatingMacro, setCreatingMacro] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const macroEditor = useRef<MacroEditorHandle | null>(null);

  const openCreateDialog = useCallback(() => {
    setCreating(true);
    setNewName("");
    setCreateError(null);
  }, []);

  const requestNavigation = useCallback((navigate: () => void) => {
    if (macroEditor.current === null) {
      navigate();
      return;
    }
    macroEditor.current.requestNavigation(navigate);
  }, []);

  const startCreate = useCallback(() => {
    requestNavigation(openCreateDialog);
  }, [openCreateDialog, requestNavigation]);

  const selectMacro = useCallback(
    (name: string) => {
      if (name === selected) return;
      requestNavigation(() => setSelected(name));
    },
    [requestNavigation, selected],
  );

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    if (!NAME_PATTERN.test(name)) {
      setCreateError(
        "Letters, digits, spaces, '_' and '-' only; must start with a letter or digit.",
      );
      return;
    }
    setCreatingMacro(true);
    const ok = await Effect.runPromise(putMacro(name, createMacroDocument(name)))
      .then(() => true)
      .catch((error: unknown) => {
        setCreateError(errorMessage(error));
        return false;
      });
    setCreatingMacro(false);
    if (ok) {
      setCreating(false);
      setListVersion((v) => v + 1);
      setSelected(name);
    }
  }, [newName]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3 text-left">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Macro Editor
          </h1>
        </div>
        <Button
          render={<Link to="/" />}
          variant="outline"
          size="sm"
        >
          <ArrowLeftIcon size={14} /> Back to controller
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_2fr]">
        <MacroPicker
          selected={selected}
          onSelect={selectMacro}
          onCreate={startCreate}
          refreshKey={listVersion}
        />
        <MacroEditor
          ref={macroEditor}
          name={selected}
          onDeleted={() => {
            setSelected(null);
            setListVersion((v) => v + 1);
          }}
        />
      </div>

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!open && !creatingMacro) setCreating(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New macro</DialogTitle>
            <DialogDescription>
              Choose a name. You can add actions after the macro is created.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitCreate();
            }}
            placeholder="Macro name"
            aria-label="New macro name"
            className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          {createError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          )}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
              disabled={creatingMacro}
            >
              Cancel
            </DialogClose>
            <Button
              onClick={() => void submitCreate()}
              disabled={creatingMacro || newName.trim().length === 0}
            >
              {creatingMacro && (
                <SpinnerGapIcon size={14} className="animate-spin" />
              )}
              Create macro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/macros")({
  component: MacrosPage,
});
