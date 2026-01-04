"""
Switch Controller Protocol for Nintendo Switch
Ported from nxbt for Bumble framework
Pro Controller only - focused on pairing functionality
"""

import random
from time import perf_counter
from enum import Enum


class SwitchResponses(Enum):
    NO_DATA = -1
    MALFORMED = -2
    TOO_SHORT = -3
    UNKNOWN_SUBCOMMAND = -4
    REQUEST_DEVICE_INFO = 2
    SET_SHIPMENT = 0x08
    SPI_READ = 0x10
    SET_MODE = 0x03
    TRIGGER_BUTTONS = 0x04
    TOGGLE_IMU = 0x40
    ENABLE_VIBRATION = 0x48
    SET_PLAYER = 0x30
    SET_NFC_IR_STATE = 0x22
    SET_NFC_IR_CONFIG = 0x21


class SwitchProtocol:
    """Pro Controller protocol implementation for Switch pairing"""

    VIBRATOR_BYTES = [0xA0, 0xB0, 0xC0, 0x90]

    def __init__(self, controller_type, bt_address, report_size=50):
        self.bt_address = bt_address
        self.controller_type = controller_type
        self.report_size = report_size

        self.report = None
        self.set_empty_report()

        self.mode = None
        self.player_number = None
        self.device_info_queried = False

        self.timer = 0
        self.timestamp = None

        self.battery_level = 0x90
        self.connection_info = 0x00

        self.button_status = [0x00] * 3

        self.left_stick_centre = [0x6F, 0xC8, 0x77]
        self.right_stick_centre = [0x16, 0xD8, 0x7D]

        self.vibration_enabled = False
        self.vibrator_report = random.choice(self.VIBRATOR_BYTES)

        self.imu_enabled = False

        self.colour_body = [0x82] * 3
        self.colour_buttons = [0x0F] * 3

    def get_report(self):
        report = bytes(self.report)
        self.set_empty_report()
        return report

    def process_commands(self, data):
        if not data:
            self.set_full_input_report()
            return

        if len(data) < 11:
            self.set_full_input_report()
            return

        if data[0] != 0xA2:
            self.set_full_input_report()
            return

        message = SwitchReportParser(data)

        if message.response == SwitchResponses.REQUEST_DEVICE_INFO:
            self.device_info_queried = True
            self.set_subcommand_reply()
            self.set_device_info()

        elif message.response == SwitchResponses.SET_SHIPMENT:
            self.set_subcommand_reply()
            self.set_shipment()

        elif message.response == SwitchResponses.SPI_READ:
            self.set_subcommand_reply()
            self.spi_read(message)

        elif message.response == SwitchResponses.SET_MODE:
            self.set_subcommand_reply()
            self.set_mode(message)

        elif message.response == SwitchResponses.TRIGGER_BUTTONS:
            self.set_subcommand_reply()
            self.set_trigger_buttons()

        elif message.response == SwitchResponses.TOGGLE_IMU:
            self.set_subcommand_reply()
            self.toggle_imu(message)

        elif message.response == SwitchResponses.ENABLE_VIBRATION:
            self.set_subcommand_reply()
            self.enable_vibration()

        elif message.response == SwitchResponses.SET_PLAYER:
            self.set_subcommand_reply()
            self.set_player_lights(message)

        elif message.response == SwitchResponses.SET_NFC_IR_STATE:
            self.set_subcommand_reply()
            self.set_nfc_ir_state()

        elif message.response == SwitchResponses.SET_NFC_IR_CONFIG:
            self.set_subcommand_reply()
            self.set_nfc_ir_config()

        elif message.response == SwitchResponses.UNKNOWN_SUBCOMMAND:
            self.set_full_input_report()

        elif message.response == SwitchResponses.NO_DATA:
            self.set_full_input_report()

        elif message.response == SwitchResponses.TOO_SHORT:
            self.set_full_input_report()

        elif message.response == SwitchResponses.MALFORMED:
            self.set_full_input_report()

    def set_empty_report(self):
        empty_report = [0] * self.report_size
        empty_report[0] = 0xA1
        self.report = empty_report

    def set_subcommand_reply(self):
        self.report[1] = 0x21
        self.vibrator_report = random.choice(self.VIBRATOR_BYTES)
        self.set_standard_input_report()

    def set_timer(self):
        if not self.timestamp:
            self.timestamp = perf_counter()
            self.report[2] = 0x00
            return

        now = perf_counter()
        delta_t = (now - self.timestamp) * 1000
        elapsed_ticks = int(delta_t * 4)
        self.timer = (self.timer + elapsed_ticks) & 0xFF
        self.report[2] = self.timer
        self.timestamp = now

    def set_full_input_report(self):
        self.report[1] = 0x30
        self.set_standard_input_report()
        self.set_imu_data()

    def set_standard_input_report(self):
        self.set_timer()

        if self.device_info_queried:
            self.report[3] = self.battery_level + self.connection_info
            self.report[4] = self.button_status[0]
            self.report[5] = self.button_status[1]
            self.report[6] = self.button_status[2]
            self.report[7] = self.left_stick_centre[0]
            self.report[8] = self.left_stick_centre[1]
            self.report[9] = self.left_stick_centre[2]
            self.report[10] = self.right_stick_centre[0]
            self.report[11] = self.right_stick_centre[1]
            self.report[12] = self.right_stick_centre[2]
            self.report[13] = self.vibrator_report

    def set_button_inputs(self, upper, shared, lower):
        self.report[4] = upper
        self.report[5] = shared
        self.report[6] = lower

    def set_left_stick_inputs(self, left):
        self.report[7] = left[0]
        self.report[8] = left[1]
        self.report[9] = left[2]

    def set_right_stick_inputs(self, right):
        self.report[10] = right[0]
        self.report[11] = right[1]
        self.report[12] = right[2]

    def set_device_info(self):
        self.report[14] = 0x82
        self.report[15] = 0x02
        self.report[16] = 0x03
        self.report[17] = 0x8B
        self.report[18] = 0x03
        self.report[19] = 0x02

        address = self.bt_address.strip().split(":")
        address_location = 20
        for address_byte_str in address:
            address_byte = int(address_byte_str, 16)
            self.report[address_location] = address_byte
            address_location += 1

        self.report[26] = 0x01
        self.report[27] = 0x01

    def set_shipment(self):
        self.report[14] = 0x80
        self.report[15] = 0x08

    def toggle_imu(self, message):
        if message.subcommand[1] == 0x01:
            self.imu_enabled = True
        else:
            self.imu_enabled = False

        self.report[14] = 0x80
        self.report[15] = 0x40

    def set_imu_data(self):
        if not self.imu_enabled:
            return

        imu_data = [
            0x75,
            0xFD,
            0xFD,
            0xFF,
            0x09,
            0x10,
            0x21,
            0x00,
            0xD5,
            0xFF,
            0xE0,
            0xFF,
            0x72,
            0xFD,
            0xF9,
            0xFF,
            0x0A,
            0x10,
            0x22,
            0x00,
            0xD5,
            0xFF,
            0xE0,
            0xFF,
            0x76,
            0xFD,
            0xFC,
            0xFF,
            0x09,
            0x10,
            0x23,
            0x00,
            0xD5,
            0xFF,
            0xE0,
            0xFF,
        ]
        self.report[14:49] = imu_data

    def spi_read(self, message):
        addr_top = message.subcommand[2]
        addr_bottom = message.subcommand[1]
        read_length = message.subcommand[5]

        self.report[14] = 0x90
        self.report[15] = 0x10
        self.report[16] = addr_bottom
        self.report[17] = addr_top
        self.report[20] = read_length

        params = [
            0x0F,
            0x30,
            0x61,
            0x96,
            0x30,
            0xF3,
            0xD4,
            0x14,
            0x54,
            0x41,
            0x15,
            0x54,
            0xC7,
            0x79,
            0x9C,
            0x33,
            0x36,
            0x63,
        ]

        if addr_top == 0x60 and addr_bottom == 0x00:
            self.report[21:37] = [0xFF] * 16

        elif addr_top == 0x60 and addr_bottom == 0x50:
            self.report[21:24] = self.colour_body
            self.report[24:27] = self.colour_buttons
            self.report[27:34] = [0xFF] * 7

        elif addr_top == 0x60 and addr_bottom == 0x80:
            self.report[21] = 0x50
            self.report[22] = 0xFD
            self.report[23] = 0x00
            self.report[24] = 0x00
            self.report[25] = 0xC6
            self.report[26] = 0x0F
            self.report[27:45] = params

        elif addr_top == 0x60 and addr_bottom == 0x98:
            self.report[21:39] = params

        elif addr_top == 0x80 and addr_bottom == 0x10:
            self.report[21:45] = [0xFF] * 24

        elif addr_top == 0x60 and addr_bottom == 0x3D:
            l_calibration = [0xBA, 0xF5, 0x62, 0x6F, 0xC8, 0x77, 0xED, 0x95, 0x5B]
            r_calibration = [0x16, 0xD8, 0x7D, 0xF2, 0xB5, 0x5F, 0x86, 0x65, 0x5E]

            self.report[21:30] = l_calibration
            self.report[30:39] = r_calibration
            self.report[39] = 0xFF
            self.report[40:43] = self.colour_body
            self.report[43:46] = self.colour_buttons

        elif addr_top == 0x60 and addr_bottom == 0x20:
            sa_calibration = [
                0xD3,
                0xFF,
                0xD5,
                0xFF,
                0x55,
                0x01,
                0x00,
                0x40,
                0x00,
                0x40,
                0x00,
                0x40,
                0x19,
                0x00,
                0xDD,
                0xFF,
                0xDC,
                0xFF,
                0x3B,
                0x34,
                0x3B,
                0x34,
                0x3B,
                0x34,
            ]
            self.report[21:45] = sa_calibration

    def set_mode(self, message):
        self.report[14] = 0x80
        self.report[15] = 0x03

        if message.subcommand[1] == 0x30:
            self.mode = "standard"
        elif message.subcommand[1] == 0x31:
            self.mode = "nfc/ir"
        elif message.subcommand[1] == 0x3F:
            self.mode = "simpleHID"

    def set_trigger_buttons(self):
        self.report[14] = 0x83
        self.report[15] = 0x04

    def enable_vibration(self):
        self.report[14] = 0x82
        self.report[15] = 0x48
        self.vibration_enabled = True

    def set_player_lights(self, message):
        self.report[14] = 0x80
        self.report[15] = 0x30

        bitfield = message.subcommand[1]

        if bitfield == 0x01 or bitfield == 0x10:
            self.player_number = 1
        elif bitfield == 0x03 or bitfield == 0x30:
            self.player_number = 2
        elif bitfield == 0x07 or bitfield == 0x70:
            self.player_number = 3
        elif bitfield == 0x0F or bitfield == 0xF0:
            self.player_number = 4

    def set_nfc_ir_state(self):
        self.report[14] = 0x80
        self.report[15] = 0x22

    def set_nfc_ir_config(self):
        self.report[14] = 0xA0
        self.report[15] = 0x21
        params = [0x01, 0x00, 0xFF, 0x00, 0x08, 0x00, 0x1B, 0x01]
        self.report[16:24] = params
        self.report[49] = 0xC8

    def is_pairing_complete(self):
        return self.vibration_enabled and self.player_number is not None


class SwitchReportParser:
    """Parse incoming Switch commands"""

    SUBCOMMANDS = {
        0x02: SwitchResponses.REQUEST_DEVICE_INFO,
        0x08: SwitchResponses.SET_SHIPMENT,
        0x10: SwitchResponses.SPI_READ,
        0x03: SwitchResponses.SET_MODE,
        0x04: SwitchResponses.TRIGGER_BUTTONS,
        0x40: SwitchResponses.TOGGLE_IMU,
        0x48: SwitchResponses.ENABLE_VIBRATION,
        0x30: SwitchResponses.SET_PLAYER,
        0x22: SwitchResponses.SET_NFC_IR_STATE,
        0x21: SwitchResponses.SET_NFC_IR_CONFIG,
    }

    def __init__(self, data, data_length=50):
        if not data:
            self.response = SwitchResponses.NO_DATA
            return

        if len(data) < data_length:
            self.response = SwitchResponses.TOO_SHORT
            return

        if data[0] != 0xA2:
            self.response = SwitchResponses.MALFORMED
            return

        self.payload = data[:11]
        self.subcommand = data[11:]
        self.subcommand_id = self.subcommand[0]

        if self.subcommand[0] in self.SUBCOMMANDS:
            self.response = self.SUBCOMMANDS[self.subcommand[0]]
        else:
            self.response = SwitchResponses.UNKNOWN_SUBCOMMAND
