import { afterEach, describe, expect, it, vi } from "vitest";
import { requestStatus } from "./bluetooth";

afterEach(() => vi.unstubAllGlobals());

describe("Bluetooth status requests", () => {
  it("accepts the live backend's saved public-address format", async () => {
    const status = {
      available: true, pairing: false, state: "disconnected", address: null,
      peers: ["12:34:56:78:90:AB/P"],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(status)));
    await expect(requestStatus()).resolves.toEqual(status);
  });

  it("identifies a backend that has not loaded the new route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
    await expect(requestStatus()).rejects.toThrow("Restart main.py");
  });

  it("preserves a backend Bluetooth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "Cannot read saved Bluetooth devices" }, { status: 503 }),
    ));
    await expect(requestStatus()).rejects.toThrow("Cannot read saved Bluetooth devices");
  });

  it("distinguishes network failures from invalid status data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(requestStatus()).rejects.toThrow("Cannot reach the backend");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ available: true })));
    await expect(requestStatus()).rejects.toThrow("Invalid Bluetooth status response");
  });

  it("explains an HTML fallback instead of claiming the backend is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!DOCTYPE html>")));
    await expect(requestStatus()).rejects.toThrow("invalid response (HTTP 200)");
  });
});
