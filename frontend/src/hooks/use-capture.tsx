import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Effect } from "effect";
import {
  type CameraDevice,
  CameraError,
  type CameraPermissionState,
  acquireStream,
  describeError,
  enumerateCameras,
  releaseStream,
  requestPermission,
} from "@/src/lib/webcam";

type CaptureContextValue = {
  readonly cameras: readonly CameraDevice[];
  readonly error: string | null;
  readonly permission: CameraPermissionState;
  readonly requestingPermission: boolean;
  readonly selectedInputId: string;
  readonly starting: boolean;
  readonly stream: MediaStream | null;
  readonly selectInput: (deviceId: string) => void;
  readonly requestAccess: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly stop: () => void;
};

const CaptureContext = createContext<CaptureContextValue | null>(null);

function useCaptureContext(): CaptureContextValue {
  const context = useContext(CaptureContext);
  if (!context) {
    throw new Error("Capture hooks must be used inside CaptureProvider");
  }
  return context;
}

export function CaptureProvider({ children }: { readonly children: ReactNode }) {
  const streamRef = useRef<MediaStream | null>(null);
  const selectedInputIdRef = useRef("");
  const [cameras, setCameras] = useState<readonly CameraDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permission, setPermission] =
    useState<CameraPermissionState>("prompt");
  const [error, setError] = useState<string | null>(null);

  const refreshCameras = useCallback(async () => {
    const devices = await Effect.runPromise(enumerateCameras).catch(
      (): readonly CameraDevice[] => [],
    );
    setCameras(devices);
  }, []);

  const stop = useCallback(() => {
    const current = streamRef.current;
    streamRef.current = null;
    setStream(null);
    if (current) void Effect.runPromise(releaseStream(current));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    const previous = streamRef.current;
    streamRef.current = null;
    setStream(null);
    if (previous) await Effect.runPromise(releaseStream(previous));

    try {
      const nextStream = await Effect.runPromise(
        acquireStream(selectedInputIdRef.current),
      );
      streamRef.current = nextStream;
      setStream(nextStream);
      setPermission("granted");
      await refreshCameras();

      if (!selectedInputIdRef.current) {
        const activeId = nextStream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeId) {
          selectedInputIdRef.current = activeId;
          setSelectedInputId(activeId);
        }
      }
    } catch (cause: unknown) {
      const captureError = cause instanceof CameraError ? cause : null;
      setError(
        captureError ? describeError(captureError) : "Unable to access camera.",
      );
      if (captureError?.reason === "denied") setPermission("denied");
    } finally {
      setStarting(false);
    }
  }, [refreshCameras]);

  const requestAccess = useCallback(async () => {
    setError(null);
    setRequestingPermission(true);
    try {
      await Effect.runPromise(requestPermission);
      setPermission("granted");
      await refreshCameras();
    } catch (cause: unknown) {
      const captureError = cause instanceof CameraError ? cause : null;
      setError(
        captureError ? describeError(captureError) : "Unable to access camera.",
      );
      setPermission(
        captureError?.reason === "unsupported" ? "unsupported" : "denied",
      );
    } finally {
      setRequestingPermission(false);
    }
  }, [refreshCameras]);

  const selectInput = useCallback(
    (deviceId: string) => {
      selectedInputIdRef.current = deviceId;
      setSelectedInputId(deviceId);
      if (streamRef.current) void start();
    },
    [start],
  );

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const permissions = navigator.permissions;
    if (!permissions?.query) {
      setPermission("unsupported");
      return;
    }

    void permissions
      .query({ name: "camera" as PermissionName })
      .then((nextStatus) => {
        status = nextStatus;
        setPermission(nextStatus.state);
        if (nextStatus.state === "prompt") void requestAccess();
        nextStatus.onchange = () => setPermission(nextStatus.state);
      })
      .catch(() => setPermission("unsupported"));

    return () => {
      if (status) status.onchange = null;
    };
  }, [requestAccess]);

  useEffect(() => {
    if (permission !== "granted" && permission !== "unsupported") return;
    void refreshCameras();
    const handleDeviceChange = () => void refreshCameras();
    navigator.mediaDevices?.addEventListener?.(
      "devicechange",
      handleDeviceChange,
    );
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, [permission, refreshCameras]);

  useEffect(() => () => {
    const current = streamRef.current;
    streamRef.current = null;
    if (current) current.getTracks().forEach((track) => track.stop());
  }, []);

  return (
    <CaptureContext.Provider
      value={{
        cameras,
        error,
        permission,
        requestingPermission,
        selectedInputId,
        starting,
        stream,
        selectInput,
        requestAccess,
        start,
        stop,
      }}
    >
      {children}
    </CaptureContext.Provider>
  );
}

export function useCaptureControls() {
  const { error, permission, requestAccess, requestingPermission, start, starting, stop, stream } =
    useCaptureContext();
  return {
    error,
    permission,
    requestAccess,
    requestingPermission,
    start,
    starting,
    stop,
    streaming: stream !== null,
  } as const;
}

export function useCaptureInput() {
  const { cameras, permission, selectedInputId, selectInput } =
    useCaptureContext();
  return { cameras, permission, selectedInputId, selectInput } as const;
}

export function useCaptureStream(): MediaStream | null {
  return useCaptureContext().stream;
}
