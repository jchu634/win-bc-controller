import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PencilSimpleIcon,
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { CapturePreview } from "@/src/components/capture-preview";
import { MacroRunPanel } from "@/src/components/macro/macro-run-panel";
import { Button } from "@/src/components/ui/button";
import { useCaptureControls, useCaptureInput } from "@/src/hooks/use-capture";
import { SettingsDialog } from "@/src/components/ui/settings-dialog";
import cn from "cnfast";
import "@/src/App.css";

function App() {
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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 px-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettingsDialog />
      </div>

      <div className="flex w-full flex-col gap-4 md:flex-row">
        <CapturePreview />

        <div className="flex w-full flex-col space-y-4 md:w-1/3">
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
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
