import { useCallback, useEffect, useRef, useState } from "react";
import { Effect } from "effect";
import {
  ArrowsCounterClockwiseIcon,
  CheckIcon,
  CopyIcon,
  FloppyDiskIcon,
  MagicWandIcon,
  PlayIcon,
  SpinnerGapIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { errorMessage } from "@/src/lib/errors";
import { Button } from "@/src/components/ui/button";
import {
  JsonEditor,
  type JsonEditorHandle,
  type JsonMarker,
} from "@/src/components/json-editor/json-editor";
import { activatePreset, deletePreset, getPreset, putPreset } from "@/src/lib/api";
import { ApiError } from "@/src/lib/api";
import type { ValidationBody } from "@/src/lib/types";
import { locatePathLine, positionToLineCol } from "@/src/lib/json-locate";

export type PresetEditorProps = {
  name: string | null;
  builtin: boolean;
  /** Request the parent start the duplicate flow for this preset. */
  onDuplicate: (name: string) => void;
  onDeleted: (name: string) => void;
  onSaved: (name: string) => void;
};

export function PresetEditor({
  name,
  builtin,
  onDuplicate,
  onDeleted,
  onSaved,
}: PresetEditorProps) {
  const [value, setValue] = useState("");
  const [savedText, setSavedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [markers, setMarkers] = useState<JsonMarker[]>([]);
  const [editing, setEditing] = useState(false);
  const editorHandle = useRef<JsonEditorHandle | null>(null);

  useEffect(() => {
    if (name === null) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setMarkers([]);
    setSavedText(null);
    Effect.runPromise(getPreset(name))
      .then((r) => {
        setValue(r.contents);
        setSavedText(r.contents);
      })
      .catch((error: unknown) => {
        setValue("");
        setError(errorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [name]);

  const dirty = savedText !== null && value !== savedText;

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

  const buildMarkers = useCallback(
    (body: ValidationBody, text: string): JsonMarker[] => {
      if (body.line !== undefined) {
        return [
          {
            line: body.line,
            col: body.col,
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

  const save = useCallback(async (): Promise<boolean> => {
    if (name === null || builtin) return false;
    const local = syntaxPrecheck(value);
    if (local.length > 0) {
      setMarkers(local);
      setError("Invalid JSON — fix the highlighted line before saving.");
      return false;
    }
    setSaving(true);
    const result = await Effect.runPromise(putPreset(name, value)).catch(
      (e): null => {
        if (e instanceof ApiError && e.body !== null) {
          setMarkers(buildMarkers(e.body, value));
          setError(`${e.message}${e.body.detail ? ` — ${e.body.detail}` : ""}`);
        } else {
          setError(String(e));
        }
        return null;
      },
    );
    setSaving(false);
    if (result !== null) {
      setSavedText(value);
      setMarkers([]);
      setError(null);
      onSaved(name);
      return true;
    }
    return false;
  }, [name, builtin, value, syntaxPrecheck, buildMarkers, onSaved]);

  const activate = useCallback(async () => {
    if (name === null) return;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    setActivating(true);
    await Effect.runPromise(activatePreset(name))
      .then(() => setNotice(`Preset '${name}' applied.`))
      .catch((error: unknown) => setError(errorMessage(error)));
    setActivating(false);
  }, [name, dirty, save]);

  const format = useCallback(() => {
    try {
      const pretty = `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
      if (!editorHandle.current?.replaceDocument(pretty)) {
        setValue(pretty);
      }
      setMarkers([]);
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
    if (!window.confirm(`Delete preset '${name}'?`)) return;
    setDeleting(true);
    const ok = await Effect.runPromise(deletePreset(name))
      .then(() => true)
      .catch((error: unknown) => {
        setError(errorMessage(error));
        return false;
      });
    setDeleting(false);
    if (ok) onDeleted(name);
  }, [name, onDeleted]);

  if (name === null) {
    return (
      <section className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
        <p>Select a preset to inspect it.</p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          {name}.json
        </h2>
        {builtin && (
          <span className="rounded-4xl bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            built-in · read-only
          </span>
        )}
        {!builtin && dirty && (
          <span className="rounded-4xl bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            unsaved
          </span>
        )}
        {!builtin && savedText !== null && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckIcon size={12} /> saved
          </span>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {builtin ? (
            <Button size="sm" variant="outline" onClick={() => onDuplicate(name)}>
              <CopyIcon size={14} /> Duplicate…
            </Button>
          ) : (
            <>
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
                  // While an edit session is attached the editor's
                  // document is authoritative — route through it.
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => void activate()}
                disabled={activating}
              >
                {activating ? (
                  <SpinnerGapIcon size={14} className="animate-spin" />
                ) : (
                  <PlayIcon size={14} weight="fill" />
                )}
                Activate
              </Button>
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
                onClick={() => void remove()}
                disabled={deleting}
                title="Delete preset"
              >
                {deleting ? (
                  <SpinnerGapIcon size={14} className="animate-spin" />
                ) : (
                  <TrashIcon size={14} weight="fill" />
                )}
              </Button>
            </>
          )}
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
      {notice !== null && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
          <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <JsonEditor
          ref={editorHandle}
          fileName={`${name}.json`}
          cacheKey={`preset:${name}`}
          value={value}
          onChange={setValue}
          editing={editing && !builtin}
          markers={markers}
          className="max-h-[60vh] min-h-64"
        />
      )}
    </section>
  );
}
