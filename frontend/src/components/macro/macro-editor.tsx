/**
 * Macro file editor: Diffs-backed JSON editing with server-side
 * validation, save, delete, and run (inline — unsaved buffers included).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Effect } from "effect";
import {
  ArrowsCounterClockwiseIcon,
  CheckIcon,
  FloppyDiskIcon,
  MagicWandIcon,
  PlayIcon,
  SpinnerGapIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import {
  JsonEditor,
  type JsonEditorHandle,
  type JsonMarker,
} from "@/src/components/json-editor/json-editor";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { deleteMacro, getMacro, putMacro } from "@/src/lib/api";
import { ApiError } from "@/src/lib/api";
import type { MacroDoc, ValidationBody } from "@/src/lib/types";
import { locatePathLine, positionToLineCol } from "@/src/lib/json-locate";

const EMPTY_MACRO = `{
  "name": "untitled",
  "repeat": 1,
  "actions": []
}`;

function parseErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.message}${err.body?.detail ? ` — ${err.body.detail}` : ""}`;
  return String(err);
}

export function MacroEditor({
  name,
  onDeleted,
}: {
  name: string | null;
  onDeleted: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [savedText, setSavedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<JsonMarker[]>([]);
  const [editing, setEditing] = useState(false);
  const editorHandle = useRef<JsonEditorHandle | null>(null);
  const { startInline } = useMacroRunner();

  useEffect(() => {
    if (name === null) return;
    setLoading(true);
    setError(null);
    setMarkers([]);
    setSavedText(null);
    Effect.runPromise(getMacro(name))
      .then((r) => {
        setValue(r.contents);
        setSavedText(r.contents);
      })
      .catch((e) => {
        setValue("");
        setError(parseErrorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [name]);

  const dirty = savedText !== null && value !== savedText;

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

  const save = useCallback(async (): Promise<boolean> => {
    if (name === null) return false;
    const local = syntaxPrecheck(value);
    if (local.length > 0) {
      setMarkers(local);
      setError("Invalid JSON — fix the highlighted line before saving.");
      return false;
    }
    setSaving(true);
    const result = await Effect.runPromise(
      putMacro(name, value),
    ).catch((e): null => {
      if (e instanceof ApiError && e.body !== null) {
        setMarkers(buildMarkers(e.body, value));
        setError(
          `${e.message}${e.body.detail ? ` — ${e.body.detail}` : ""}`,
        );
      } else {
        setError(parseErrorMessage(e));
      }
      return null;
    });
    setSaving(false);
    if (result !== null) {
      setSavedText(value);
      setMarkers([]);
      setError(null);
      return true;
    }
    return false;
  }, [name, value, syntaxPrecheck, buildMarkers]);

  const run = useCallback(() => {
    if (name === null) return;
    const local = syntaxPrecheck(value);
    if (local.length > 0) {
      setMarkers(local);
      setError("Invalid JSON — fix the highlighted line before running.");
      return;
    }
    try {
      const doc = JSON.parse(value) as MacroDoc;
      startInline(doc);
      setError(null);
    } catch {
      setError("Invalid JSON — cannot run.");
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
    if (!window.confirm(`Delete macro '${name}'?`)) return;
    setDeleting(true);
    const ok = await Effect.runPromise(deleteMacro(name))
      .then(() => true)
      .catch((e) => {
        setError(parseErrorMessage(e));
        return false;
      });
    setDeleting(false);
    if (ok) onDeleted(name);
  }, [name, onDeleted]);

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
            size="sm"
            variant={editing ? "secondary" : "outline"}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Review" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" onClick={format} title="Format">
            <MagicWandIcon size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (savedText === null) return;
              // While an edit session is attached the editor's document
              // is authoritative — route through it, not just state.
              if (!editorHandle.current?.replaceDocument(savedText)) {
                setValue(savedText);
              }
              setMarkers([]);
              setError(null);
            }}
            disabled={!dirty}
            title="Revert"
          >
            <ArrowsCounterClockwiseIcon size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={run}>
            <PlayIcon size={14} weight="fill" /> Run
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving || !dirty}>
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
            onClick={() => void remove()}
            disabled={deleting}
            title="Delete macro"
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
          editing={editing}
          markers={markers}
          className="max-h-[60vh] min-h-64"
        />
      )}
    </section>
  );
}

export const NEW_MACRO_TEMPLATE = EMPTY_MACRO;
