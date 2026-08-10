from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class StickCalibration:
    """Calibration of one analog stick.

    ``center`` is the rest position, ``min``/``max`` are the signed
    offsets from center at full deflection (min for negative input,
    max for positive input). Values are in the controller's native
    12-bit range.
    """

    center_x: int
    center_y: int
    min_x: int
    max_x: int
    min_y: int
    max_y: int


# Pro Controller factory calibration values (from the proven NXBT defaults).
PRO_LEFT = StickCalibration(
    center_x=2159, center_y=1916,
    min_x=-1466, max_x=1517,
    min_y=-1583, max_y=1465,
)
PRO_RIGHT = StickCalibration(
    center_x=2070, center_y=2013,
    min_x=-1522, max_x=1414,
    min_y=-1531, max_y=1510,
)


def calibrate_stick(
    ratio: tuple[float, float], cal: StickCalibration
) -> list[int]:
    """Convert a normalized [-1, 1] (x, y) pair to the Switch's 3-byte
    packed stick representation (12-bit X / 12-bit Y, little-endian
    nibble-interleaved).
    """
    rx, ry = ratio
    rx = max(-1.0, min(1.0, rx))
    ry = max(-1.0, min(1.0, ry))

    x = cal.center_x + (cal.max_x if rx >= 0 else cal.min_x) * abs(rx)
    y = cal.center_y + (cal.max_y if ry >= 0 else cal.min_y) * abs(ry)

    x = int(round(x)) & 0xFFF
    y = int(round(y)) & 0xFFF

    return [
        x & 0xFF,
        ((y & 0xF) << 4) | (x >> 8),
        y >> 4,
    ]
