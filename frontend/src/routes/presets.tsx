import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PresetEditor } from "@/src/components/preset/preset-editor";
import { PresetPicker } from "@/src/components/preset/preset-picker";

function PresetsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuiltin, setSelectedBuiltin] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  const pick = useCallback((name: string, builtin: boolean) => {
    setSelected(name);
    setSelectedBuiltin(builtin);
  }, []);

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

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <PresetPicker
          selected={selected}
          onSelect={(p) => pick(p.filename, p.builtin)}
          onDeleted={(name) => {
            if (selected === name) {
              setSelected(null);
              setSelectedBuiltin(false);
            }
            setListVersion((v) => v + 1);
          }}
          refreshKey={listVersion}
        />
        <PresetEditor
          name={selected}
          builtin={selectedBuiltin}
          onSaved={() => setListVersion((v) => v + 1)}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/presets")({
  component: PresetsPage,
});
