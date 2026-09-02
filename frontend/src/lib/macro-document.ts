import {
  BUTTON_NAMES,
  type ButtonName,
  type MacroAction,
  type MacroDoc,
} from "@/src/lib/types";

/**
 * Validated document boundary shared by the JSON editor and a future block
 * editor. Visual editing can work with MacroDoc without depending on JSON text.
 */

export type MacroDocumentParseResult =
  | { kind: "valid"; document: MacroDoc }
  | { kind: "invalid-json"; error: SyntaxError }
  | { kind: "invalid-document"; message: string };

function isButtonName(value: unknown): value is ButtonName {
  return (
    typeof value === "string" &&
    BUTTON_NAMES.some((buttonName) => buttonName === value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMacroAction(value: unknown): value is MacroAction {
  if (typeof value !== "object" || value === null || !("do" in value)) {
    return false;
  }

  switch (value.do) {
    case "press":
    case "release":
      return "button" in value && isButtonName(value.button);
    case "wait":
      return "ms" in value && isFiniteNumber(value.ms);
    case "stick":
      return (
        "side" in value &&
        (value.side === "left" || value.side === "right") &&
        "x" in value &&
        isFiniteNumber(value.x) &&
        "y" in value &&
        isFiniteNumber(value.y)
      );
    case "loop":
      return (
        "count" in value &&
        isFiniteNumber(value.count) &&
        "actions" in value &&
        Array.isArray(value.actions) &&
        value.actions.every(isMacroAction)
      );
    default:
      return false;
  }
}

function isMacroDocument(value: unknown): value is MacroDoc {
  if (
    typeof value !== "object" ||
    value === null ||
    !("actions" in value) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(isMacroAction)
  ) {
    return false;
  }

  if (
    "name" in value &&
    value.name !== undefined &&
    typeof value.name !== "string"
  ) {
    return false;
  }

  return (
    !("repeat" in value) ||
    value.repeat === undefined ||
    isFiniteNumber(value.repeat)
  );
}

export function parseMacroDocument(text: string): MacroDocumentParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    return {
      kind: "invalid-json",
      error:
        cause instanceof SyntaxError
          ? cause
          : new SyntaxError("The macro is not valid JSON."),
    };
  }

  if (!isMacroDocument(value)) {
    return {
      kind: "invalid-document",
      message: "The macro does not match the supported action format.",
    };
  }

  return { kind: "valid", document: value };
}

export function createMacroDocument(name: string): string {
  const document: MacroDoc = { name, repeat: 1, actions: [] };
  return `${JSON.stringify(document, null, 2)}\n`;
}
