"""Test input handler for Switch controller relay.

Generates button press sequences for POC testing without physical controller.
"""

import asyncio
import logging
from controller import ControllerTypes

logger = logging.getLogger("input_handler")


def create_test_button_sequence(button_name, duration=0.5):
    """Create a button press state.

    :param button_name: Button name (A, B, X, Y, etc.)
    :param duration: Duration in seconds to hold button
    :return: Tuple of (press_state, release_state, duration)
    """
    # Button bit masks (from NXBT input.py)
    BUTTON_MAP = {
        "A": {"upper": 0x10},
        "B": {"upper": 0x20},
        "X": {"upper": 0x40},
        "Y": {"upper": 0x80},
        "HOME": {"shared": 0x08},
        "CAPTURE": {"shared": 0x04},
        "PLUS": {"shared": 0x80},
        "MINUS": {"shared": 0x40},
        "L": {"lower": 0x02},
        "R": {"lower": 0x01},
        "ZL": {"lower": 0x01},
        "ZR": {"lower": 0x04},
        "L_STICK_PRESS": {"shared": 0x10},
        "R_STICK_PRESS": {"shared": 0x20},
        "DPAD_UP": {"lower": 0x40},
        "DPAD_DOWN": {"lower": 0x80},
        "DPAD_LEFT": {"lower": 0x10},
        "DPAD_RIGHT": {"lower": 0x20},
    }

    if button_name not in BUTTON_MAP:
        logger.warning(f"Unknown button: {button_name}")
        return None

    button_mask = BUTTON_MAP[button_name]

    # Press state - add button mask to current button state
    press_state = {
        "buttons": {
            "upper": button_mask.get("upper", 0),
            "shared": button_mask.get("shared", 0),
            "lower": button_mask.get("lower", 0),
        },
        "left_stick": [0x6F, 0xC8, 0x77],
        "right_stick": [0x16, 0xD8, 0x7D],
    }

    # Release state - all zeros
    release_state = {
        "buttons": {
            "upper": 0,
            "shared": 0,
            "lower": 0,
        },
        "left_stick": [0x6F, 0xC8, 0x77],
        "right_stick": [0x16, 0xD8, 0x7D],
    }

    return press_state, release_state, duration


async def run_test_sequence(session):
    """Run a simple button test sequence: A, wait, B, wait.

    :param session: SwitchHIDSession instance
    """
    logger.info("Starting test button sequence...")

    # Press A
    logger.info("Pressing A button...")
    a_press, a_release, a_duration = create_test_button_sequence("A")
    session.input_state = a_press
    await asyncio.sleep(a_duration)

    # Release A
    logger.info("Releasing A button...")
    session.input_state = a_release
    await asyncio.sleep(0.3)

    # Press B
    logger.info("Pressing B button...")
    b_press, b_release, b_duration = create_test_button_sequence("B")
    session.input_state = b_press
    await asyncio.sleep(b_duration)

    # Release B
    logger.info("Releasing B button...")
    session.input_state = b_release
    await asyncio.sleep(0.3)

    logger.info("Test sequence complete!")
