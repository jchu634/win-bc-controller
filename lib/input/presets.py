"""Controller mapping presets.

A *preset* is a JSON description of how a physical controller's
pygame/SDL indices map to Switch buttons, sticks, triggers, D-pad, and
whether rumble is enabled. Presets live in the top-level ``presets/``
directory and are selected by name through the config store (``preset``
field) or the ``--preset`` CLI flag.

Schema (see ``presets/xbox.json`` for a full example)::

    {
      "name": "Xbox",
      "description": "...",
      "rumble_enabled": true,
      "buttons":  {"0": "B", "1": "A", ...},   # pygame btn idx -> Switch Button
      "triggers": {"4": "ZL", "5": "ZR"},       # pygame axis idx -> Switch Button
      "left_stick":  {"x_axis": 0, "y_axis": 1},
      "right_stick": {"x_axis": 2, "y_axis": 3},
      "dpad": {"hat": 0}                         # set hat to null to disable
    }

JSON object keys are strings (per the JSON spec) and are coerced to
``int`` on load. Button values are :class:`Button` enum names.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from lib.input.state import Button

logger = logging.getLogger("switch_pair")

PRESETS_DIR = Path(__file__).resolve().parents[2] / "presets"
BUILTIN_PRESETS = frozenset({"xbox", "playstation", "switch_pro"})


@dataclass(frozen=True, slots=True)
class PresetConfig:
    """Resolved, ready-to-use controller mapping preset.

    All axis/button/hat indices are :mod:`pygame.joystick` indices on the
    physical gamepad. ``button_map`` maps digital buttons; ``trigger_map``
    maps analog trigger axes (treated as digital above a threshold).
    """

    name: str = "Default"
    rumble_enabled: bool = True
    button_map: dict[int, Button] = field(default_factory=dict)
    trigger_map: dict[int, Button] = field(default_factory=dict)
    left_stick: tuple[int, int] = (0, 1)
    right_stick: tuple[int, int] = (2, 3)
    dpad_hat: int | None = 0

    @classmethod
    def default(cls) -> PresetConfig:
        """Fallback preset matching the historical hardcoded Xbox defaults.

        Used when a named preset cannot be loaded so the controller remains
        usable.
        """
        return cls(
            name="Default",
            rumble_enabled=True,
            button_map={
                0: Button.B,
                1: Button.A,
                2: Button.Y,
                3: Button.X,
                4: Button.L,
                5: Button.R,
                6: Button.MINUS,
                7: Button.PLUS,
                8: Button.HOME,
                9: Button.STICK_L,
                10: Button.STICK_R,
            },
            trigger_map={4: Button.ZL, 5: Button.ZR},
            left_stick=(0, 1),
            right_stick=(2, 3),
            dpad_hat=0,
        )


def load_preset(source: str | Path) -> PresetConfig:
    """Load a preset by builtin name or filesystem path.

    ``source`` is matched against :data:`BUILTIN_PRESETS` first; on a hit
    the file is read from :data:`PRESETS_DIR`. Otherwise ``source`` is
    treated as a path to a JSON file. Raises :class:`FileNotFoundError`
    or :class:`ValueError` on problems.
    """
    path = _resolve_preset_path(source)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise TypeError(f"Preset {path} must be a JSON object")
    return _build_preset(data)


def list_presets() -> list[str]:
    """Return sorted preset names: builtins plus any extra ``.json`` files
    discovered in the presets directory."""
    names: set[str] = set(BUILTIN_PRESETS)
    if PRESETS_DIR.is_dir():
        for p in PRESETS_DIR.glob("*.json"):
            if p.is_file():
                names.add(p.stem)
    return sorted(names)


def _resolve_preset_path(source: str | Path) -> Path:
    source = str(source).strip()
    if source in BUILTIN_PRESETS:
        return PRESETS_DIR / f"{source}.json"
    path = Path(source)
    if not path.is_file():
        raise FileNotFoundError(
            f"Preset not found: {source!r}. "
            f"Known builtins: {sorted(BUILTIN_PRESETS)}; "
            f"or provide a path to a JSON file."
        )
    return path


def _build_preset(data: dict) -> PresetConfig:
    name = str(data.get("name", "Unnamed"))
    rumble_enabled = bool(data.get("rumble_enabled", True))

    button_map = _parse_button_map(data.get("buttons") or {}, "buttons")
    trigger_map = _parse_button_map(data.get("triggers") or {}, "triggers")

    left = data.get("left_stick") or {}
    right = data.get("right_stick") or {}
    left_stick = (int(left.get("x_axis", 0)), int(left.get("y_axis", 1)))
    right_stick = (int(right.get("x_axis", 2)), int(right.get("y_axis", 3)))

    dpad = data.get("dpad") or {}
    dpad_hat_raw = dpad.get("hat", 0)
    dpad_hat = int(dpad_hat_raw) if dpad_hat_raw is not None else None

    return PresetConfig(
        name=name,
        rumble_enabled=rumble_enabled,
        button_map=button_map,
        trigger_map=trigger_map,
        left_stick=left_stick,
        right_stick=right_stick,
        dpad_hat=dpad_hat,
    )


def _parse_button_map(raw: dict, label: str) -> dict[int, Button]:
    """Convert a ``{"0": "B", ...}`` mapping to ``{0: Button.B}``.

    JSON keys are strings; they are coerced to ``int`` indices. Button
    values are resolved through the :class:`Button` enum by name.
    """
    result: dict[int, Button] = {}
    for key, value in raw.items():
        idx = int(key)
        button_name = str(value).strip().upper()
        try:
            result[idx] = Button[button_name]
        except KeyError:
            valid = ", ".join(sorted(b.name for b in Button if b.name))
            raise ValueError(
                f"Unknown button name {value!r} in preset '{label}' "
                f"(index {key}). Valid names: {valid}"
            ) from None
    return result
