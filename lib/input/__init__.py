"""Input subsystem for win-bc-controller.

Defines a single standardized controller-state packet (``ControllerState``)
and the input sources (physical controller via pygame, file-based macros)
that produce them. Sources run as daemon threads pushing onto a shared
``queue.Queue`` consumed by the main asyncio loop.
"""

from lib.input.presets import (
    BUILTIN_PRESETS,
    PRESETS_DIR,
    PresetConfig,
    list_presets,
    load_preset,
)
from lib.input.rumble import MotorRumble, RumbleData, parse_rumble
from lib.input.state import (
    NEUTRAL,
    Button,
    ControllerState,
    apply_to_protocol,
)
from lib.input.stick import PRO_LEFT, PRO_RIGHT, StickCalibration, calibrate_stick

__all__ = [
    "BUILTIN_PRESETS",
    "NEUTRAL",
    "PRESETS_DIR",
    "PRO_LEFT",
    "PRO_RIGHT",
    "Button",
    "ControllerState",
    "MotorRumble",
    "PresetConfig",
    "RumbleData",
    "StickCalibration",
    "apply_to_protocol",
    "calibrate_stick",
    "list_presets",
    "load_preset",
    "parse_rumble",
]
