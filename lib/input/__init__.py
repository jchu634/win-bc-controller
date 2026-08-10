"""Input subsystem for win-bc-controller.

Defines a single standardized controller-state packet (``ControllerState``)
and the input sources (physical controller via pygame, file-based macros)
that produce them. Sources run as daemon threads pushing onto a shared
``queue.Queue`` consumed by the main asyncio loop.
"""

from lib.input.state import (
    NEUTRAL,
    Button,
    ControllerState,
    apply_to_protocol,
)
from lib.input.rumble import MotorRumble, RumbleData, parse_rumble
from lib.input.stick import PRO_LEFT, PRO_RIGHT, StickCalibration, calibrate_stick

__all__ = [
    "Button",
    "ControllerState",
    "NEUTRAL",
    "apply_to_protocol",
    "RumbleData",
    "MotorRumble",
    "parse_rumble",
    "StickCalibration",
    "calibrate_stick",
    "PRO_LEFT",
    "PRO_RIGHT",
]
