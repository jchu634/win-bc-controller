/**
 * Macro lifecycle commands + derived status from the /ws channel.
 * Backend ops: start (inline or by name), pause, resume, cancel.
 */

import { useCallback } from "react";
import { useSocket } from "@/src/hooks/use-socket";
import type { MacroDoc } from "@/src/lib/types";

export function useMacroRunner() {
  const { status, send } = useSocket();

  const startByName = useCallback(
    (name: string) => send({ type: "macro", op: "start", name }),
    [send],
  );

  const startInline = useCallback(
    (macro: MacroDoc) => send({ type: "macro", op: "start", macro }),
    [send],
  );

  const pause = useCallback(() => send({ type: "macro", op: "pause" }), [send]);
  const resume = useCallback(
    () => send({ type: "macro", op: "resume" }),
    [send],
  );
  const cancel = useCallback(
    () => send({ type: "macro", op: "cancel" }),
    [send],
  );

  const mode = status?.mode ?? "manual";
  const macro = status?.macro ?? null;

  return {
    mode,
    macro,
    macroActive: macro !== null && mode === "macro",
    isPaused: macro?.state === "paused",
    startByName,
    startInline,
    pause,
    resume,
    cancel,
  };
}
