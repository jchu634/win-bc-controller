import { useCallback, useEffect, useRef, useState } from "react";
import { Effect } from "effect";
import {
  CaretDownIcon,
  PlayIcon,
  SpinnerGapIcon,
  StopIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";
import { cn } from "cnfast";
import {
  type CameraDevice,
  type CameraError,
  type CameraPermissionState,
  acquireStream,
  describeError,
  enumerateCameras,
  releaseStream,
  requestPermission,
} from "@/src/lib/webcam";

export function WebcamViewer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameras, setCameras] = useState<readonly CameraDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permission, setPermission] = useState<CameraPermissionState>("prompt");
  const [error, setError] = useState<string | null>(null);

  const permissionGranted =
    permission === "granted" || permission === "unsupported";

  const stop = useCallback(() => {
    const current = streamRef.current;
    streamRef.current = null;
    if (current) void Effect.runPromise(releaseStream(current));
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    setError(null);
    setStarting(true);
    const previous = streamRef.current;
    streamRef.current = null;
    if (previous) void Effect.runPromise(releaseStream(previous));

    try {
      const stream = await Effect.runPromise(acquireStream(deviceId ?? ""));
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStreaming(true);
      // labels only populate once permission has been granted
      const cams = await Effect.runPromise(enumerateCameras).catch(
        (): readonly CameraDevice[] => [],
      );
      setCameras(cams);
      if (!deviceId) {
        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeId) setSelectedId(activeId);
      }
    } catch (err) {
      setError(describeError(err as CameraError));
      setStreaming(false);
    } finally {
      setStarting(false);
    }
  }, []);

  const request = useCallback(async () => {
    setError(null);
    setRequesting(true);
    try {
      await Effect.runPromise(requestPermission);
      setPermission("granted");
      const cams = await Effect.runPromise(enumerateCameras).catch(
        (): readonly CameraDevice[] => [],
      );
      setCameras(cams);
    } catch (err) {
      const reason = (err as CameraError)?.reason;
      setError(describeError(err as CameraError));
      setPermission(reason === "unsupported" ? "unsupported" : "denied");
    } finally {
      setRequesting(false);
    }
  }, []);

  // check permission on mount, auto-request if prompted, subscribe to changes
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const perms = navigator.permissions;
    if (!perms?.query) {
      setPermission("unsupported");
      return;
    }
    perms
      .query({ name: "camera" as PermissionName })
      .then((s) => {
        status = s;
        setPermission(s.state as CameraPermissionState);
        // surface the browser permission prompt as soon as the component mounts
        if (s.state === "prompt") void request();
        s.onchange = () =>
          setPermission(s.state as CameraPermissionState);
      })
      .catch(() => setPermission("unsupported"));
    return () => {
      if (status) status.onchange = null;
    };
  }, [request]);

  // enumerate on mount (labels may be blank until permission is granted)
  useEffect(() => {
    if (!permissionGranted) return;
    Effect.runPromise(enumerateCameras)
      .then(setCameras)
      .catch(() => {});
  }, [permissionGranted]);

  // react to cameras being plugged / unplugged
  useEffect(() => {
    if (!permissionGranted) return;
    const handler = () => {
      Effect.runPromise(enumerateCameras)
        .then(setCameras)
        .catch(() => {});
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
    };
  }, [permissionGranted]);

  // release the stream when unmounted
  useEffect(() => {
    return () => {
      const current = streamRef.current;
      streamRef.current = null;
      if (current) current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (streaming) void start(id);
  };

  const toggle = () => {
    if (streaming) stop();
    else void start(selectedId);
  };

  const isEmpty = cameras.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          className="size-full object-contain"
        />
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
            {error ? (
              <>
                <WarningIcon size={36} weight="duotone" />
                <p className="px-6 text-center text-sm">{error}</p>
              </>
            ) : permission === "denied" ? (
              <>
                <VideoCameraSlashIcon size={36} weight="duotone" />
                <p className="px-6 text-center text-sm">
                  Camera access is blocked. Enable it in your browser's site
                  settings to continue.
                </p>
              </>
            ) : !permissionGranted ? (
              <>
                <VideoCameraIcon size={36} weight="duotone" />
                <p className="text-sm">Camera access required to begin</p>
              </>
            ) : (
              <>
                <VideoCameraSlashIcon size={36} weight="duotone" />
                <p className="text-sm">
                  {starting ? "Starting capture..." : "Capture card is idle"}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {permissionGranted ? (
          <>
            <div className="relative min-w-50 flex-1">
              <select
                value={selectedId}
                onChange={(e) => handleSelect(e.target.value)}
                disabled={isEmpty}
                aria-label="Select capture device"
                className={cn(
                  "h-9 w-full appearance-none rounded-4xl border border-border bg-background px-3 pe-9 text-sm",
                  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                  "disabled:opacity-50",
                )}
              >
                {isEmpty ? (
                  <option value="">No capture devices detected</option>
                ) : (
                  <>
                    <option value="">Default device</option>
                    {cameras.map((c) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <CaretDownIcon
                size={16}
                weight="bold"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            <Button
              onClick={toggle}
              variant={streaming ? "destructive" : "default"}
              disabled={starting}
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
          </>
        ) : (
          <Button onClick={request} disabled={requesting}>
            {requesting ? (
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
  );
}
