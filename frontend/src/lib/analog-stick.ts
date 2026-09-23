export type StickPosition = [x: number, y: number];

/** Clamp to a circular range while preserving direction and partial deflection. */
export function clampStick(x: number, y: number): StickPosition {
  const magnitude = Math.max(1, Math.hypot(x, y));
  return [x / magnitude, y / magnitude];
}
