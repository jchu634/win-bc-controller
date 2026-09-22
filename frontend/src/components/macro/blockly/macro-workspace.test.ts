import { afterEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import type { MacroAction, MacroDoc } from "@/src/lib/types";
import {
  MACRO_BLOCK_TYPES,
  registerMacroBlocks,
} from "@/src/components/macro/blockly/macro-blocks";
import {
  loadMacroWorkspace,
  readMacroWorkspace,
} from "@/src/components/macro/blockly/macro-workspace";

const workspaces: Blockly.Workspace[] = [];

function createWorkspace(): Blockly.Workspace {
  registerMacroBlocks();
  const workspace = new Blockly.Workspace();
  workspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.dispose();
});

describe("macro workspace conversion", () => {
  it("round trips the complete macro document", () => {
    const document: MacroDoc = {
      version: 1,
      name: "combo",
      repeat: 0,
      actions: [
        { do: "press", button: "A" },
        { do: "wait", ms: 25.5 },
        { do: "stick", side: "left", x: -1, y: 0.75 },
        {
          do: "loop",
          count: 2,
          actions: [{ do: "release", button: "A" }],
        },
      ],
    };
    const workspace = createWorkspace();

    loadMacroWorkspace({ workspace, document });
    const result = readMacroWorkspace({ workspace, name: document.name });

    expect(result).toMatchObject({ kind: "valid", document });
  });

  it("rejects a detached action block", () => {
    const workspace = createWorkspace();
    loadMacroWorkspace({ workspace, document: { version: 1, actions: [] } });
    const orphan = workspace.newBlock(MACRO_BLOCK_TYPES.wait);
    orphan.initModel();

    const result = readMacroWorkspace({ workspace, name: undefined });

    expect(result).toMatchObject({
      kind: "invalid",
      issues: [
        {
          blockId: orphan.id,
          message: "Connect this block to the macro before saving or running.",
        },
      ],
    });
  });

  it("rejects more than 16 nested loops", () => {
    let actions: MacroAction[] = [{ do: "wait", ms: 1 }];
    for (let count = 0; count < 17; count += 1) {
      actions = [{ do: "loop", count: 1, actions }];
    }
    const workspace = createWorkspace();
    loadMacroWorkspace({ workspace, document: { version: 1, actions } });

    const result = readMacroWorkspace({ workspace, name: undefined });

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.issues[0]?.message).toContain("16 levels");
    }
  });
});
