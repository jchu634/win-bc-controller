import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { CapturePreview } from "@/src/components/capture-preview";
import { MacroRunPanel } from "@/src/components/macro/macro-run-panel";
import { ManualControl } from "@/src/components/controller/manual-control";
import { Button } from "@/src/components/ui/button";
import { useCaptureControls, useCaptureInput } from "@/src/hooks/use-capture";
import { SettingsDialog } from "@/src/components/ui/settings-dialog";
import { useSelector } from "@tanstack/react-store";
import { generalSettingsStore } from "@/src/stores/general-settings";
import cn from "cnfast";
import "@/src/App.css";

function App() {
  const controlsOnlyHomepage = useSelector(
    generalSettingsStore,
    (settings) => settings.controlsOnlyHomepage,
  );
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const { selectedInputId } = useCaptureInput();
  const {
    permission,
    requestAccess,
    requestingPermission,
    start,
    starting,
    stop,
    streaming,
  } = useCaptureControls();
  const permissionGranted =
    permission === "granted" || permission === "unsupported";

  return (
    <div className="flex h-full w-full flex-col gap-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettingsDialog />
      </div>

      {controlsOnlyHomepage ? (
        <main className="mx-auto w-full max-w-7xl pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Controller</h1>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <MacroRunPanel selected={selectedMacro} onSelect={setSelectedMacro} />
            </div>
            <div className="min-w-0 overflow-x-auto">
              <ManualControl />
            </div>
          </div>
        </main>
      ) : (
        <div className="flex w-full gap-4 ">
          <CapturePreview />

          <div className="flex flex-col space-y-4 max-w-1/3">
            {permissionGranted ? (
              <Button
                onClick={streaming ? stop : () => void start(selectedInputId)}
                variant={streaming ? "destructive" : "default"}
                disabled={starting || !selectedInputId}
                className={cn(
                  "w-full h-12 text-lg",
                  streaming && "border-red-800 border-2",
                )}
              >
                {starting ? (
                  <SpinnerGapIcon
                    size={16}
                    weight="bold"
                    className="animate-spin"
                  />
                ) : streaming ? (
                  <StopIcon size={16} weight="fill" />
                ) : (
                  <PlayIcon size={16} weight="fill" />
                )}
                {streaming ? "Stop Capture Input" : "Start Capture Input"}
              </Button>
            ) : (
              <Button
                onClick={() => void requestAccess()}
                disabled={requestingPermission}
              >
                {requestingPermission ? (
                  <SpinnerGapIcon
                    size={16}
                    weight="bold"
                    className="animate-spin"
                  />
                ) : (
                  <VideoCameraIcon size={16} weight="fill" />
                )}
                Request camera access
              </Button>
            )}
            <MacroRunPanel selected={selectedMacro} onSelect={setSelectedMacro} />
            <ManualControl />
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
