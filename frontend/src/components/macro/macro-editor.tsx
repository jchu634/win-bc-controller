/**
 * Macro file editor: Diffs-backed JSON editing with server-side
 * validation, save, delete, and inline runs of unsaved buffers.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useBlocker } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  FloppyDiskIcon,
  MagicWandIcon,
  PauseIcon,
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  JsonEditor,
  type JsonEditorHandle,
  type JsonMarker,
} from "@/src/components/json-editor/json-editor";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { deleteMacro, getMacro, putMacro } from "@/src/lib/api";
import { ApiError } from "@/src/lib/api";
import type { ValidationBody } from "@/src/lib/types";
import { locatePathLine, positionToLineCol } from "@/src/lib/json-locate";
import { parseMacroDocument } from "@/src/lib/macro-document";

function parseErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${error.body?.detail ? `: ${error.body.detail}` : ""}`;
  }
  return String(error);
}

export type MacroEditorProps = {
  name: string | null;
  onDeleted: (name: string) => void;
};

export type MacroEditorHandle = {
  requestNavigation: (navigate: () => void) => void;
};

type SaveResult = "saved" | "failed";

export const MacroEditor = forwardRef<MacroEditorHandle, MacroEditorProps>(
  function MacroEditor({ name, onDeleted }, ref) {
    const [value, setValue] = useState("");
    const [savedText, setSavedText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deletePromptOpen, setDeletePromptOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [markers, setMarkers] = useState<JsonMarker[]>([]);
    const [selectionPromptOpen, setSelectionPromptOpen] = useState(false);
    const editorHandle = useRef<JsonEditorHandle | null>(null);
    const pendingSelection = useRef<(() => void) | null>(null);
    const { macroActive, isPaused, startInline, pause, resume, cancel } =
      useMacroRunner();

    useEffect(() => {
      if (name === null) {
        setValue("");
        setSavedText(null);
        setMarkers([]);
        setError(null);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      setMarkers([]);
      setSavedText(null);
      Effect.runPromise(getMacro(name))
        .then((r) => {
          if (cancelled) return;
          setValue(r.contents);
          setSavedText(r.contents);
        })
        .catch((e) => {
          if (cancelled) return;
          setValue("");
          setError(parseErrorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [name]);

    const dirty = savedText !== null && value !== savedText;
    const shouldBlockNavigation = useCallback(() => dirty, [dirty]);
    const routeBlocker = useBlocker({
      shouldBlockFn: shouldBlockNavigation,
      enableBeforeUnload: shouldBlockNavigation,
      withResolver: true,
    });

    useImperativeHandle(
      ref,
      () => ({
        requestNavigation(navigate) {
          if (!dirty) {
            navigate();
            return;
          }
          pendingSelection.current = navigate;
          setSelectionPromptOpen(true);
        },
      }),
      [dirty],
    );

    const cancelNavigation = useCallback(() => {
      pendingSelection.current = null;
      setSelectionPromptOpen(false);
      if (routeBlocker.status === "blocked") routeBlocker.reset();
    }, [routeBlocker]);

    const finishNavigation = useCallback(() => {
      const select = pendingSelection.current;
      pendingSelection.current = null;
      setSelectionPromptOpen(false);
      if (select !== null) {
        select();
        return;
      }
      if (routeBlocker.status === "blocked") routeBlocker.proceed();
    }, [routeBlocker]);

    const buildMarkers = useCallback(
      (body: ValidationBody, text: string): JsonMarker[] => {
        if (body.line !== undefined && body.col !== undefined) {
          return [
            {
              line: body.line,
              col: body.col,
              severity: "error",
              message: body.detail ?? body.error,
            },
          ];
        }
        if (body.line !== undefined) {
          return [
            {
              line: body.line,
              severity: "error",
              message: body.detail ?? body.error,
            },
          ];
        }
        if (body.path !== undefined) {
          const line = locatePathLine(text, body.path);
          if (line !== null) {
            return [
              {
                line,
                severity: "error",
                message: body.detail ?? body.error,
              },
            ];
          }
        }
        return [];
      },
      [],
    );

    const syntaxPrecheck = useCallback((text: string): JsonMarker[] => {
      try {
        JSON.parse(text);
        return [];
      } catch (e) {
        const msg = e instanceof SyntaxError ? e.message : String(e);
        const pos = /position (\d+)/i.exec(msg)?.[1];
        const lc =
          pos !== undefined ? positionToLineCol(text, Number(pos)) : null;
        return [
          {
            line: lc?.line ?? 1,
            col: lc?.col,
            severity: "error",
            message: `Invalid JSON: ${msg}`,
          },
        ];
      }
    }, []);

    const save = useCallback(async (): Promise<SaveResult> => {
      if (name === null) return "failed";
      const local = syntaxPrecheck(value);
      if (local.length > 0) {
        setMarkers(local);
        setError("Fix the highlighted JSON error before saving.");
        return "failed";
      }
      setSaving(true);
      const result = await Effect.runPromise(putMacro(name, value)).catch(
        (e): null => {
          if (e instanceof ApiError && e.body !== null) {
            setMarkers(buildMarkers(e.body, value));
            setError(
              `${e.message}${e.body.detail ? ` — ${e.body.detail}` : ""}`,
            );
          } else {
            setError(parseErrorMessage(e));
          }
          return null;
        },
      );
      setSaving(false);
      if (result !== null) {
        setSavedText(value);
        setMarkers([]);
        setError(null);
        return "saved";
      }
      return "failed";
    }, [name, value, syntaxPrecheck, buildMarkers]);

    const run = useCallback(() => {
      if (name === null) return;
      const result = parseMacroDocument(value);
      switch (result.kind) {
        case "valid":
          startInline(result.document);
          setMarkers([]);
          setError(null);
          return;
        case "invalid-json": {
          const local = syntaxPrecheck(value);
          setMarkers(local);
          setError("Fix the highlighted JSON error before running.");
          return;
        }
        case "invalid-document":
          setError(result.message);
          return;
      }
    }, [name, value, syntaxPrecheck, startInline]);

    const format = useCallback(() => {
      try {
        const pretty = `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
        if (!editorHandle.current?.replaceDocument(pretty)) {
          setValue(pretty);
        }
        setMarkers([]);
        setError(null);
      } catch (e) {
        const msg = e instanceof SyntaxError ? e.message : String(e);
        const pos = /position (\d+)/i.exec(msg)?.[1];
        const lc =
          pos !== undefined ? positionToLineCol(value, Number(pos)) : null;
        setMarkers([
          {
            line: lc?.line ?? 1,
            col: lc?.col,
            severity: "error",
            message: `Cannot format: ${msg}`,
          },
        ]);
      }
    }, [value]);

    const remove = useCallback(async () => {
      if (name === null) return;
      setDeleting(true);
      const ok = await Effect.runPromise(deleteMacro(name))
        .then(() => true)
        .catch((e) => {
          setError(parseErrorMessage(e));
          return false;
        });
      setDeleting(false);
      if (ok) {
        setDeletePromptOpen(false);
        onDeleted(name);
      }
    }, [name, onDeleted]);

    const saveAndNavigate = useCallback(async () => {
      const result = await save();
      if (result === "saved") finishNavigation();
    }, [finishNavigation, save]);

    if (name === null) {
      return (
        <section className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
          <p>Select a macro to edit, or create a new one.</p>
        </section>
      );
    }

    return (
      <section className="flex w-full flex-col gap-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            {name}.json
          </h2>
          {dirty && (
            <span className="rounded-4xl bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
              unsaved
            </span>
          )}
          {savedText !== null && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CheckIcon size={12} /> saved
            </span>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={format}
              title="Format JSON"
              aria-label="Format JSON"
            >
              <MagicWandIcon size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (savedText === null) return;
                if (!editorHandle.current?.replaceDocument(savedText)) {
                  setValue(savedText);
                }
                setMarkers([]);
                setError(null);
              }}
              disabled={!dirty}
              title="Discard changes"
            >
              Undo
              <ArrowCounterClockwiseIcon size={14} />
            </Button>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Macro debugging controls"
            >
              <Button size="sm" variant="outline" onClick={run}>
                <PlayIcon size={14} weight="fill" /> Run
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={isPaused ? resume : pause}
                disabled={!macroActive}
              >
                {isPaused ? (
                  <PlayIcon size={14} weight="fill" />
                ) : (
                  <PauseIcon size={14} weight="fill" />
                )}
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={cancel}
                disabled={!macroActive}
              >
                <StopIcon size={14} weight="fill" /> Stop
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={saving || !dirty}
            >
              {saving ? (
                <SpinnerGapIcon size={14} className="animate-spin" />
              ) : (
                <FloppyDiskIcon size={14} weight="fill" />
              )}
              Save
            </Button>
            <Button
              size="icon-sm"
              variant="destructive"
              onClick={() => setDeletePromptOpen(true)}
              disabled={deleting}
              title="Delete macro"
              aria-label="Delete macro"
            >
              {deleting ? (
                <SpinnerGapIcon size={14} className="animate-spin" />
              ) : (
                <TrashIcon size={14} weight="fill" />
              )}
            </Button>
          </div>
        </div>

        {error !== null && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          >
            <WarningIcon
              size={16}
              className="mt-0.5 shrink-0 text-destructive"
            />
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
          <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
            <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <JsonEditor
            ref={editorHandle}
            fileName={`${name}.json`}
            cacheKey={`macro:${name}`}
            value={value}
            onChange={setValue}
            editing
            markers={markers}
            className="max-h-[60vh]"
          />
        )}

        <Dialog
          open={deletePromptOpen}
          onOpenChange={(open) => {
            if (!open && !deleting) setDeletePromptOpen(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete macro?</DialogTitle>
              <DialogDescription>
                Delete "{name}"? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletePromptOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void remove()}
                disabled={deleting}
              >
                {deleting && (
                  <SpinnerGapIcon size={14} className="animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={selectionPromptOpen || routeBlocker.status === "blocked"}
          onOpenChange={(open) => {
            if (!open) cancelNavigation();
          }}
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Leave without saving?</DialogTitle>
              <DialogDescription>
                This macro has unsaved changes. Save them before leaving?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelNavigation}>
                Stay here
              </Button>
              <Button variant="destructive" onClick={finishNavigation}>
                Leave without saving
              </Button>
              <Button onClick={() => void saveAndNavigate()} disabled={saving}>
                {saving && (
                  <SpinnerGapIcon size={14} className="animate-spin" />
                )}
                Save and leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  },
);
