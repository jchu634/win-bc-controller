import { createFileRoute } from "@tanstack/react-router";
import { ControllerPanel } from "@/src/components/controller/controller-panel";
import { MacroRunPanel } from "@/src/components/macro/macro-run-panel";
import { PresetPicker } from "@/src/components/preset/preset-picker";
import { useState } from "react";

function ControllerPage() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Controller
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick which connected gamepad drives the Switch, and which preset
          maps its buttons.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <ControllerPanel />
        <MacroRunPanel
          selected={null}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </div>

      <details className="rounded-xl border border-border p-4 text-left">
        <summary className="cursor-pointer text-sm font-semibold">
          Switch mapping preset
        </summary>
        <div className="mt-4">
          <PresetPicker
            selected={selectedPreset}
            onSelect={(p) => setSelectedPreset(p.name)}
            onDuplicate={() => {}}
          />
        </div>
      </details>
    </div>
  );
}

export const Route = createFileRoute("/controller")({
  component: ControllerPage,
});
