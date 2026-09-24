import { describe, expect, it } from "vitest";
import { clampStick } from "@/src/lib/analog-stick";

describe("analog stick range", () => {
  it("preserves the center and partial deflection", () => {
    expect(clampStick(0, 0)).toEqual([0, 0]);
    expect(clampStick(0.25, -0.5)).toEqual([0.25, -0.5]);
  });

  it("clamps each cardinal direction", () => {
    expect(clampStick(3, 0)).toEqual([1, 0]);
    expect(clampStick(-3, 0)).toEqual([-1, 0]);
    expect(clampStick(0, 3)).toEqual([0, 1]);
    expect(clampStick(0, -3)).toEqual([0, -1]);
  });

  it("preserves diagonal direction without exceeding the circular boundary", () => {
    const [x, y] = clampStick(3, -4);
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(-0.8);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });
});
