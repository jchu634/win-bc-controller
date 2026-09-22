import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import { useSocket } from "@/src/hooks/use-socket";
import { getControllers, selectController } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";
import type { ControllersFrame } from "@/src/lib/types";

export function useControllers() {
  const { controllers: frame } = useSocket();
  const [restFrame, setRestFrame] = useState<ControllersFrame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // REST fallback for state between WS frames (e.g. right after connect).
  useEffect(() => {
    Effect.runPromise(getControllers())
      .then(setRestFrame)
      .catch(() => {});
  }, []);

  const data = frame ?? restFrame;
  const controllers = data?.controllers ?? [];
  const active = data?.active ?? null;

  const select = useCallback(
    async (ident: string | number): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const ok = await Effect.runPromise(selectController(ident))
        .then(() => true)
        .catch((error: unknown) => {
          setError(errorMessage(error));
          return false;
        });
      setBusy(false);
      // The WS broadcast updates the frame; nudge via REST in case the
      // socket is down.
      Effect.runPromise(getControllers())
        .then(setRestFrame)
        .catch(() => {});
      return ok;
    },
    [],
  );

  const activeInfo = controllers.find((c) => c.guid === active) ?? null;

  return {
    available: data?.available ?? false,
    controllers,
    active,
    activeInfo,
    busy,
    error,
    select,
  };
}
