import { createFileRoute } from "@tanstack/react-router";
import {
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { CapturePreview } from "@/src/components/capture-preview";
import { Button } from "@/src/components/ui/button";
import {
  useCaptureControls,
  useCaptureInput,
} from "@/src/hooks/use-capture";
import { SettingsDialog } from "@/src/components/ui/settings-dialog";
import "@/src/App.css";

function App() {
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <SettingsDialog />
        <CapturePreview />
        <div className="flex justify-end">
          {permissionGranted ? (
            <Button
              onClick={
                streaming ? stop : () => void start(selectedInputId)
              }
              variant={streaming ? "destructive" : "default"}
              disabled={starting || !selectedInputId}
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
              {streaming ? "Stop" : "Start"}
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
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
