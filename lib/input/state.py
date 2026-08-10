from __future__ import annotations

from dataclasses import dataclass
from enum import IntFlag

from lib.input.stick import PRO_LEFT, PRO_RIGHT, calibrate_stick


class Button(IntFlag):
    """
    Switch Pro Controller buttons as a single 24-bit bitmask.

    The bytes map directly to the standard input report (report[4..6]):

        bits  0-7  -> report[4]
        bits  8-15 -> report[5]
        bits 16-23 -> report[6]
    """

    # --- byte 1 -> report[4] ---
    Y = 1 << 0
    X = 1 << 1
    B = 1 << 2
    A = 1 << 3
    SR_R = 1 << 4  # Joy-Con only
    SL_R = 1 << 5  # Joy-Con only
    R = 1 << 6
    ZR = 1 << 7

    # --- byte 2 -> report[5] ---
    MINUS = 1 << 8
    PLUS = 1 << 9
    STICK_L = 1 << 10  # left stick click
    STICK_R = 1 << 11  # right stick click
    HOME = 1 << 12
    CAPTURE = 1 << 13

    # --- byte 3 -> report[6] ---
    DOWN = 1 << 16
    UP = 1 << 17
    RIGHT = 1 << 18
    LEFT = 1 << 19
    SR_L = 1 << 20  # Joy-Con only
    SL_L = 1 << 21  # Joy-Con only
    L = 1 << 22
    ZL = 1 << 23

    NONE = 0

    def by_name(self, name: str) -> Button:
        """Look up a button by its enum name (case-insensitive)."""
        return Button[name.strip().upper()]


@dataclass(frozen=True, slots=True)
class ControllerState:
    """
    Device-agnostic snapshot of a controller's instantaneous state.

    Sticks are normalized to the [-1.0, 1.0] range with the usual
    convention: X positive = right, Y positive = up.
    """

    buttons = Button(0)
    left: tuple[float, float] = (0.0, 0.0)
    right: tuple[float, float] = (0.0, 0.0)


NEUTRAL = ControllerState()


def apply_to_protocol(protocol, state: ControllerState) -> None:
    """
    Push a controller state onto a Switch ControllerProtocol.
    """
    b = int(state.buttons)
    protocol.set_button_inputs(b & 0xFF, (b >> 8) & 0xFF, (b >> 16) & 0xFF)
    protocol.set_left_stick_inputs(calibrate_stick(state.left, PRO_LEFT))
    protocol.set_right_stick_inputs(calibrate_stick(state.right, PRO_RIGHT))
