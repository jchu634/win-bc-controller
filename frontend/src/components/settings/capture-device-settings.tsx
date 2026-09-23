import { useEffect, useRef, useState } from "react";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import {
  useCaptureControls,
  useCaptureInput,
  useCaptureStream,
} from "@/src/hooks/use-capture";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

export function CaptureDeviceSettings({ disabled }: { disabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedForPreview = useRef(false);
  const [visible, setVisible] = useState(false);
  const stream = useCaptureStream();
  const {
    error,
    start,
    starting,
    stop,
    streaming,
    permission,
    requestAccess,
    requestingPermission,
  } = useCaptureControls();
  const { cameras, selectedInputId, selectInput } = useCaptureInput();
  const selectedInputLabel = cameras.find(
    (camera) => camera.deviceId === selectedInputId,
  )?.label;

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    if (disabled) {
      setVisible(false);
      startedForPreview.current = false;
    }
  }, [disabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = visible ? stream : null;
    return () => {
      video.srcObject = null;
    };
  }, [stream, visible]);

  useEffect(
    () => () => {
      if (startedForPreview.current) stopRef.current();
    },
    [],
  );

  const togglePreview = async () => {
    if (visible) {
      setVisible(false);
      if (startedForPreview.current) {
        startedForPreview.current = false;
        stop();
      }
      return;
    }

    setVisible(true);
    if (!streaming) {
      startedForPreview.current = true;
      await start(selectedInputId);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {permission !== "granted" && permission !== "unsupported" && (
        <Button
          variant="outline"
          disabled={disabled || requestingPermission}
          onClick={() => void requestAccess()}
        >
          {requestingPermission
            ? "Requesting camera access..."
            : "Request camera access"}
        </Button>
      )}
      <div className="flex w-full flex-wrap items-center gap-2">
        <Select
          disabled={disabled}
          value={selectedInputId}
          onValueChange={(deviceId) => {
            if (deviceId !== null) selectInput(deviceId);
          }}
        >
          <SelectTrigger className="w-1/2 min-w-64">
            <SelectValue placeholder="Capture Device">
              {selectedInputLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Capture Device</SelectLabel>
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          disabled={disabled || !selectedInputId || starting}
          onClick={() => void togglePreview()}
        >
          {starting && (
            <SpinnerGapIcon className="animate-spin" weight="bold" />
          )}
          {visible ? "Hide preview" : "Show preview"}
        </Button>
      </div>

      <div className="aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-border bg-black">
        {!disabled && visible && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-6 text-center text-sm text-zinc-400">
            {disabled
              ? "Capture controls are disabled while the controls-only homepage is enabled."
              : visible
                ? (error ??
                  (starting ? "Starting preview..." : "Preview unavailable"))
                : "Preview disabled"}
          </div>
        )}
      </div>
    </div>
  );
}

