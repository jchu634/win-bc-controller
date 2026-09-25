import { Effect } from "effect";
import { listMacros } from "@/src/lib/api";
import { errorMessage } from "@/src/lib/errors";

export function loadMacroList() {
  return Effect.runPromise(listMacros())
    .then(({ names }) => ({ kind: "loaded" as const, names }))
    .catch((error: unknown) => ({
      kind: "error" as const,
      message: errorMessage(error),
    }));
}
