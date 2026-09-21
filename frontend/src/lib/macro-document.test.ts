import { describe, expect, it } from "vitest";
import {
  parseMacroDocument,
  parseVisualMacroDocument,
} from "@/src/lib/macro-document";

describe("parseMacroDocument", () => {
  it("parses every supported action", () => {
    const result = parseMacroDocument(
      JSON.stringify({
        name: "combo",
        repeat: 0,
        actions: [
          { do: "press", button: "A" },
          { do: "wait", ms: 12.5 },
          { do: "stick", side: "right", x: -1, y: 0.5 },
          {
            do: "loop",
            count: 3,
            actions: [{ do: "release", button: "A" }],
          },
        ],
      }),
    );

    expect(result.kind).toBe("valid");
  });

  it.each([
    ["negative repeat", { repeat: -1, actions: [] }, ["repeat"]],
    ["fractional repeat", { repeat: 1.5, actions: [] }, ["repeat"]],
    [
      "negative wait",
      { actions: [{ do: "wait", ms: -1 }] },
      ["actions", 0, "ms"],
    ],
    [
      "fractional loop count",
      { actions: [{ do: "loop", count: 1.5, actions: [] }] },
      ["actions", 0, "count"],
    ],
  ])("rejects %s", (_label, document, expectedPath) => {
    const result = parseMacroDocument(JSON.stringify(document));

    expect(result.kind).toBe("invalid-document");
    if (result.kind === "invalid-document") {
      expect(result.path).toEqual(expectedPath);
    }
  });

  it("rejects fields that the block editor cannot preserve", () => {
    const result = parseVisualMacroDocument(
      JSON.stringify({
        name: "extended",
        actions: [{ do: "wait", ms: 10, note: "keep me" }],
      }),
    );

    expect(result).toMatchObject({
      kind: "unsupported",
      path: ["actions", 0, "note"],
    });
  });
});
