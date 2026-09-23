import type { ClassValue } from "cnfast";

export type ClassName<State> = ClassValue | ((state: State) => ClassValue);

export function resolveClassName<State>(
  className: ClassName<State>,
  state: State,
): ClassValue {
  return typeof className === "function" ? className(state) : className;
}
