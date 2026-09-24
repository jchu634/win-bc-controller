import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PlayIcon, SpinnerGapIcon, StopIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { CapturePreview } from "@/src/components/panels/capture-preview";
import { MacroRunPanel } from "@/src/components/panels/macro-runner";
import { ManualControl } from "@/src/components/panels/manual-control";
import {
  ConnectionToggleButton,
  SwitchConnection,
  useSwitchConnection,
} from "@/src/components/panels/connection";
import { Button } from "@/src/components/ui/button";
import { useCaptureControls, useCaptureInput } from "@/src/hooks/use-capture";
import { SettingsDialog } from "@/src/components/settings/dialog";
import { useSelector } from "@tanstack/react-store";
import { generalSettingsStore } from "@/src/stores/general-settings";
import "@/src/App.css";

function Homepage() {
  const controlsOnlyHomepage = useSelector(
    generalSettingsStore,
    (settings) => settings.controlsOnlyHomepage,
  );
  return controlsOnlyHomepage ? <Navigate to="/controls" replace /> : <PreviewPage />;
}

function PreviewPage() {
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const switchConnection = useSwitchConnection();
  const { selectedInputId } = useCaptureInput();
  const { permission, requestAccess, requestingPermission, start, starting, stop, streaming } =
    useCaptureControls();
  const permissionGranted = permission === "granted" || permission === "unsupported";

  return (
    <div className="flex h-full w-full flex-col gap-6 bg-background px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettingsDialog />
      </div>

      <div className="flex w-full gap-4">
        <CapturePreview />

        <div className="flex max-w-1/3 flex-col space-y-4 pt-8">
          <SwitchConnection connection={switchConnection} />
          <div className="flex gap-2">
            {permissionGranted ? (
              <Button
                onClick={streaming ? stop : () => void start(selectedInputId)}
                variant={streaming ? "destructive" : "tertiary"}
                disabled={starting || !selectedInputId}
                className="h-10 flex-1 text-sm 2xl:text-lg"
              >
                {starting ? (
                  <SpinnerGapIcon size={16} weight="bold" className="animate-spin" />
                ) : streaming ? (
                  <StopIcon size={16} weight="fill" />
                ) : (
                  <PlayIcon size={16} weight="fill" />
                )}
                {streaming ? "Stop Capture Input" : "Start Capture Input"}
              </Button>
            ) : (
              <Button
                className="h-10 min-w-0 flex-1"
                onClick={() => void requestAccess()}
                disabled={requestingPermission}
              >
                {requestingPermission ? (
                  <SpinnerGapIcon size={16} weight="bold" className="animate-spin" />
                ) : (
                  <VideoCameraIcon size={16} weight="fill" />
                )}
                Request camera access
              </Button>
            )}
            <ConnectionToggleButton
              status={switchConnection.status}
              address={switchConnection.selected}
              disabled={switchConnection.disabled}
              busy={switchConnection.busy}
              onReconnect={() =>
                void switchConnection.update("POST", {
                  address: switchConnection.selected,
                })
              }
              onDisconnect={() =>
                void switchConnection.update("POST", {
                  action: "disconnect",
                })
              }
              className="h-10 shrink-0 text-sm 2xl:text-lg"
            />
          </div>
          <MacroRunPanel selected={selectedMacro} onSelect={setSelectedMacro} />
          <ManualControl />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Homepage,
});
