from enum import Enum


class ControllerTypes(Enum):
    """Controller type enumerations for initializing the controller server."""

    JOYCON_L = 1
    JOYCON_R = 2
    PRO_CONTROLLER = 3
