import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { MacroRunPanel } from "@/src/components/macro/macro-run-panel";
import { ManualControl } from "@/src/components/controller/manual-control";
import {
  SwitchConnection,
  useSwitchConnection,
} from "@/src/components/controller/switch-connection";
import { SettingsDialog } from "@/src/components/ui/settings-dialog";
import { generalSettingsStore } from "@/src/stores/general-settings";
import "@/src/App.css";

function ControlsHomepage() {
  const controlsOnlyHomepage = useSelector(
    generalSettingsStore,
    (settings) => settings.controlsOnlyHomepage,
  );
  return controlsOnlyHomepage ? <ControlsPage /> : <Navigate to="/" replace />;
}

function ControlsPage() {
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const switchConnection = useSwitchConnection();

  return (
    <div className="flex h-full w-full flex-col gap-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettingsDialog />
      </div>
      <main className="mx-auto w-full max-w-7xl pb-6">
        <h1 className="mb-6 text-2xl font-semibold">Controller</h1>
        <div className="mb-6">
          <SwitchConnection connection={switchConnection} />
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="min-w-0 rounded-md border border-border bg-card p-4">
            <MacroRunPanel selected={selectedMacro} onSelect={setSelectedMacro} />
          </div>
          <div className="min-w-0 overflow-x-auto">
            <ManualControl />
          </div>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/controls")({
  component: ControlsHomepage,
});
