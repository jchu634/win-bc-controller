/**
 * Generic JSON editor surface built on Pierre Diffs' edit mode
 * (https://diffs.com/edit).
 *
 * - Renders a `File` from `@pierre/diffs/react` with JSON highlighting.
 * - On first use, lazy-loads `@pierre/diffs/edit` and wraps the surface
 *   in a permanently-mounted `EditProvider` (one shared `Editor`
 *   instance, `persistState` keyed by `cacheKey`, so edits and history
 *   survive file switches).
 * - While a session is attached, the surface DOM is owned by the editor;
 *   the `contents` prop is ignored in favour of the editor's cached
 *   document (Diffs' documented behaviour), so `onAttach` re-syncs the
 *   host value from `editor.getText()`.
 * - Validation failures become inline markers via `editor.setMarkers`.
 *
 * Deliberately free of app concerns: macros and presets both reuse it.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EditProvider, File as DiffsFile } from "@pierre/diffs/react";
import type {
  FileContents,
} from "@pierre/diffs/react";
import type {
  Editor as DiffsEditor,
  EditorOptions,
} from "@pierre/diffs/edit";

type AnyEditor = DiffsEditor<undefined>;
import { cn } from "cnfast";

// The edit entry point is a standalone bundle; load it lazily once per
// session (docs: "Lazy Importing").
type EditModule = typeof import("@pierre/diffs/edit");
let editModulePromise: Promise<EditModule> | null = null;
const loadEditModule = (): Promise<EditModule> => {
  editModulePromise ??= import("@pierre/diffs/edit");
  return editModulePromise;
};

export type JsonMarkerSeverity = "error" | "warning";

/** Application-level marker: 1-based line (col optional). */
export type JsonMarker = {
  line: number;
  col?: number;
  severity: JsonMarkerSeverity;
  message: string;
};

export type JsonEditorProps = {
  /** Display filename (header + language inference). */
  fileName: string;
  /** Unique, stable persist key, e.g. `macro:press-a-three-times`. */
  cacheKey: string;
  /** Raw text. Treated as the source of truth while *not* editing. */
  value: string;
  onChange: (text: string) => void;
  editing: boolean;
  markers?: JsonMarker[];
  className?: string;
  ref?: React.Ref<JsonEditorHandle>;
};

export type JsonEditorHandle = {
  /** Replace the attached document's text via the undo-able edit API.
   * Returns false when no edit session is attached (caller should fall
   * back to updating the value prop). */
  replaceDocument: (text: string) => boolean;
  focus: () => void;
};

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      query.addEventListener("change", callback);
      return () => query.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

export function JsonEditor({
  fileName,
  cacheKey,
  value,
  onChange,
  editing,
  markers = [],
  className,
  ref,
}: JsonEditorProps) {
  const [editModule, setEditModule] = useState<EditModule | null>(null);
  const editorRef = useRef<AnyEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    loadEditModule().then((mod) => {
      if (!cancelled) setEditModule(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const editorOptions = useMemo<EditorOptions<undefined>>(() => {
    return {
      persistState: true,
      onAttach: (editor) => {
        editorRef.current = editor;
        // A re-attached session may restore a cached (edited) document;
        // re-sync the host value so Save operates on the visible text.
        const text = editor.getText();
        if (text !== valueRef.current) onChangeRef.current(text);
      },
      onChange: (file) => {
        onChangeRef.current(file.contents);
      },
    };
  }, []);

  const valueRef = useRef(value);
  valueRef.current = value;

  // Push markers into the attached editor (must be attached first).
  useEffect(() => {
    const editor = editorRef.current;
    if (editor === null || markers.length === 0) return;
    const lines = editor.getText().split("\n");
    const docs = markers.map((m) => {
      const lineIdx = Math.min(Math.max(m.line - 1, 0), lines.length - 1);
      const startChar = Math.max((m.col ?? 1) - 1, 0);
      const endChar = Math.max(startChar + 1, lines[lineIdx]?.length ?? 1);
      return {
        start: { line: lineIdx, character: startChar },
        end: { line: lineIdx, character: endChar },
        severity: m.severity,
        message: m.message,
      };
    });
    editor.setMarkers(
      docs as Parameters<AnyEditor["setMarkers"]>[0],
    );
  }, [markers, editing]);

  // Clear markers whenever the marker list empties or session detaches.
  useEffect(() => {
    if (markers.length > 0) return;
    editorRef.current?.setMarkers([]);
  }, [markers]);

  const dark = useSystemDark();
  const file = useMemo<FileContents>(
    () => ({
      name: fileName,
      contents: value,
      lang: "json",
      cacheKey,
    }),
    [fileName, value, cacheKey],
  );
  const fileOptions = useMemo(
    () => ({ themeType: dark ? ("dark" as const) : ("light" as const) }),
    [dark],
  );

  const createEditor = useCallback(
    (options: EditorOptions<undefined>) =>
      new editModule!.Editor({ persistState: true, ...options }),
    [editModule],
  );

  useImperativeHandle(
    ref,
    () => ({
      replaceDocument: (text: string) => {
        const editor = editorRef.current;
        if (editor === null) return false;
        const current = editor.getText();
        if (current === text) return true;
        const lines = current.split("\n");
        const lastLine = lines.length - 1;
        const lastChar = lines[lastLine]?.length ?? 0;
        editor.applyEdits(
          [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: lastLine, character: lastChar },
              },
              newText: text,
            },
          ],
          false,
        );
        onChangeRef.current(text);
        return true;
      },
      focus: () => editorRef.current?.focus(),
    }),
    [],
  );

  const surface = (
    <DiffsFile
      file={file}
      options={fileOptions}
      edit={editing && editModule !== null}
      editorOptions={editModule !== null ? editorOptions : undefined}
      className="text-left"
    />
  );

  return (
    <div
      className={cn(
        "overflow-auto rounded-xl border border-border bg-background",
        className,
      )}
    >
      {editModule !== null ? (
        <EditProvider createEditor={createEditor}>{surface}</EditProvider>
      ) : (
        surface
      )}
    </div>
  );
}
