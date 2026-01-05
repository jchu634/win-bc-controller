# Copyright 2021-2022 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# -----------------------------------------------------------------------------
# Imports
# -----------------------------------------------------------------------------
import asyncio
import json
import logging
import struct
import sys
from datetime import datetime

import bumble.logging
from bumble.core import (
    BT_HIDP_PROTOCOL_ID,
    BT_HUMAN_INTERFACE_DEVICE_SERVICE,
    BT_L2CAP_PROTOCOL_ID,
    PhysicalTransport,
)
from bumble.device import Device
from bumble.hid import HID_CONTROL_PSM, HID_INTERRUPT_PSM, Message
from bumble.hid import Device as HID_Device
from bumble.sdp import (
    SDP_ADDITIONAL_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,
    SDP_BLUETOOTH_PROFILE_DESCRIPTOR_LIST_ATTRIBUTE_ID,
    SDP_BROWSE_GROUP_LIST_ATTRIBUTE_ID,
    SDP_LANGUAGE_BASE_ATTRIBUTE_ID_LIST_ATTRIBUTE_ID,
    SDP_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,
    SDP_PUBLIC_BROWSE_ROOT,
    SDP_SERVICE_RECORD_HANDLE_ATTRIBUTE_ID,
    DataElement,
    ServiceAttribute,
)
from bumble.transport import open_transport
from websockets.asyncio import server
from websockets.exceptions import ConnectionClosedOK

from switch_protocol import SwitchProtocol

# -----------------------------------------------------------------------------
# SDP attributes for Bluetooth HID devices
SDP_HID_SERVICE_NAME_ATTRIBUTE_ID = 0x0100
SDP_HID_SERVICE_DESCRIPTION_ATTRIBUTE_ID = 0x0101
SDP_HID_PROVIDER_NAME_ATTRIBUTE_ID = 0x0102
SDP_HID_DEVICE_RELEASE_NUMBER_ATTRIBUTE_ID = 0x0200  # [DEPRECATED]
SDP_HID_PARSER_VERSION_ATTRIBUTE_ID = 0x0201
SDP_HID_DEVICE_SUBCLASS_ATTRIBUTE_ID = 0x0202
SDP_HID_COUNTRY_CODE_ATTRIBUTE_ID = 0x0203
SDP_HID_VIRTUAL_CABLE_ATTRIBUTE_ID = 0x0204
SDP_HID_RECONNECT_INITIATE_ATTRIBUTE_ID = 0x0205
SDP_HID_DESCRIPTOR_LIST_ATTRIBUTE_ID = 0x0206
SDP_HID_LANGID_BASE_LIST_ATTRIBUTE_ID = 0x0207
SDP_HID_SDP_DISABLE_ATTRIBUTE_ID = 0x0208  # [DEPRECATED]
SDP_HID_BATTERY_POWER_ATTRIBUTE_ID = 0x0209
SDP_HID_REMOTE_WAKE_ATTRIBUTE_ID = 0x020A
SDP_HID_PROFILE_VERSION_ATTRIBUTE_ID = 0x020B  # DEPRECATED]
SDP_HID_SUPERVISION_TIMEOUT_ATTRIBUTE_ID = 0x020C
SDP_HID_NORMALLY_CONNECTABLE_ATTRIBUTE_ID = 0x020D
SDP_HID_BOOT_DEVICE_ATTRIBUTE_ID = 0x020E

# Refer to HID profile specification v1.1.1, "5.3 Service Discovery Protocol (SDP)" for details
# HID SDP attribute values
LANGUAGE = 0x656E  # 0x656E uint16 “en” (English)
ENCODING = 0x6A  # 0x006A uint16 UTF-8 encoding
PRIMARY_LANGUAGE_BASE_ID = 0x100  # 0x0100 uint16 PrimaryLanguageBaseID
HID_COUNTRY_CODE = 0x21  # 0x21 Uint8, USA
HID_VIRTUAL_CABLE = True  # Virtual cable enabled
HID_RECONNECT_INITIATE = True  #  Reconnect initiate enabled
HID_BATTERY_POWER = True  #  Battery power enabled
HID_REMOTE_WAKE = True  #  Remote wake enabled
HID_SUPERVISION_TIMEOUT = 0xC80  # uint16 0xC80 (2s)
HID_NORMALLY_CONNECTABLE = False  #  Normally connectable disabled
HID_BOOT_DEVICE = False  #  Boot device support disabled

# fmt: off
# Disable lint for commenting purposes
# These HID descriptor comments are LLM Generated, remember to check if they are accurate if using for reference.
HID_REPORT_MAP = bytes(  # Text String, 50 Octet Report Descriptor
    [
        0x05, 0x01,  # Usage Page (Generic Desktop)
        0x09, 0x05,  # Usage (Game Pad)
        0xA1, 0x01,  # Collection (Application)

            0x06, 0x01, 0xFF,  # Usage Page (Vendor Defined 0xFF01)

            0x85, 0x21,  # Report ID (33)
            0x09, 0x21,  # Usage (0x21)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x85, 0x30,  # Report ID (48)
            0x09, 0x30,  # Usage (0x30)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x85, 0x31,  # Report ID (49)
            0x09, 0x31,  # Usage (0x31)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x66,  # Report Count (102)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x85, 0x32,  # Report ID (50)
            0x09, 0x32,  # Usage (0x32)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x66,  # Report Count (102)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x85, 0x33,  # Report ID (51)
            0x09, 0x33,  # Usage (0x33)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x66,  # Report Count (102)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x85, 0x3F,  # Report ID (63)
            0x05, 0x09,  # Usage Page (Button)
            0x19, 0x01,  # Usage Minimum (Button 1)
            0x29, 0x10,  # Usage Maximum (Button 16)
            0x15, 0x00,  # Logical Minimum (0)
            0x25, 0x01,  # Logical Maximum (1)
            0x75, 0x01,  # Report Size (1)
            0x95, 0x10,  # Report Count (16)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x05, 0x01,  # Usage Page (Generic Desktop)
            0x09, 0x39,  # Usage (Hat switch)
            0x15, 0x00,  # Logical Minimum (0)
            0x25, 0x07,  # Logical Maximum (7)
            0x75, 0x04,  # Report Size (4)
            0x95, 0x01,  # Report Count (1)
            0x81, 0x42,  # Input (Data,Var,Abs,Null State)
            0x05, 0x09,  # Usage Page (Button)
            0x75, 0x04,  # Report Size (4)
            0x95, 0x01,  # Report Count (1)
            0x81, 0x01,  # Input (Constant)

            0x05, 0x01,  # Usage Page (Generic Desktop)
            0x09, 0x30,  # Usage (X)
            0x09, 0x31,  # Usage (Y)
            0x09, 0x33,  # Usage (Rx)
            0x09, 0x34,  # Usage (Ry)
            0x16, 0x00, 0x00,  # Logical Minimum (0)
            0x26, 0xFF, 0xFF,  # Logical Maximum (65535)
            0x75, 0x10,  # Report Size (16)
            0x95, 0x04,  # Report Count (4)
            0x81, 0x02,  # Input (Data,Var,Abs)

            0x06, 0x01, 0xFF,  # Usage Page (Vendor Defined 0xFF01)
            0x85, 0x01,  # Report ID (1)
            0x09, 0x01,  # Usage (0x01)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x91, 0x02,  # Output (Data,Var,Abs)

            0x85, 0x10,  # Report ID (16)
            0x09, 0x10,  # Usage (0x10)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x91, 0x02,  # Output (Data,Var,Abs)

            0x85, 0x11,  # Report ID (17)
            0x09, 0x11,  # Usage (0x11)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x91, 0x02,  # Output (Data,Var,Abs)

            0x85, 0x12,  # Report ID (18)
            0x09, 0x12,  # Usage (0x12)
            0x75, 0x08,  # Report Size (8)
            0x95, 0x30,  # Report Count (48)
            0x91, 0x02,  # Output (Data,Var,Abs)

        0xC0  # End Collection
    ])
    # fmt: on

# Default protocol mode set to report protocol
protocol_mode = Message.ProtocolMode.REPORT_PROTOCOL


def sdp_records():
    service_record_handle = 0x00010002
    return {
        service_record_handle: [
            ServiceAttribute(
                SDP_SERVICE_RECORD_HANDLE_ATTRIBUTE_ID,  # 0x0001
                DataElement.sequence(
                    [DataElement.uuid(BT_HUMAN_INTERFACE_DEVICE_SERVICE)]  # 0x1124
                ),
            ),
            ServiceAttribute(
                SDP_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(BT_L2CAP_PROTOCOL_ID),  # 0x0100
                                DataElement.unsigned_integer_16(17),  # 0x0011
                            ]
                        ),
                        DataElement.sequence(
                            [
                                DataElement.uuid(BT_HIDP_PROTOCOL_ID),  # 0x0011
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_BROWSE_GROUP_LIST_ATTRIBUTE_ID,  # 0x0005
                DataElement.sequence(
                    [DataElement.uuid(SDP_PUBLIC_BROWSE_ROOT)]
                ),  # 0x1002
            ),
            ServiceAttribute(
                SDP_LANGUAGE_BASE_ATTRIBUTE_ID_LIST_ATTRIBUTE_ID,  # 0x0006
                DataElement.sequence(
                    [
                        DataElement.unsigned_integer_16(LANGUAGE),  # 0x656E
                        DataElement.unsigned_integer_16(ENCODING),  # 0x006a
                        DataElement.unsigned_integer_16(
                            PRIMARY_LANGUAGE_BASE_ID
                        ),  # 0x0100
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_BLUETOOTH_PROFILE_DESCRIPTOR_LIST_ATTRIBUTE_ID,  # 0x0009
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(
                                    BT_HUMAN_INTERFACE_DEVICE_SERVICE
                                ),  # 0x1124
                                DataElement.unsigned_integer_16(0x0101),  # 0x0101
                            ]
                        )
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_ADDITIONAL_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,  # 0x000D
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.sequence(
                                    [
                                        DataElement.uuid(
                                            BT_L2CAP_PROTOCOL_ID
                                        ),  # 0x0100
                                        DataElement.unsigned_integer_16(
                                            0x0013
                                        ),  # 0x0013
                                    ]
                                ),
                                DataElement.sequence(
                                    [
                                        DataElement.uuid(BT_HIDP_PROTOCOL_ID),  # 0x0011
                                    ]
                                ),
                            ]
                        ),
                    ]
                ),
            ),
            # ------------- HID SDP Atrribute Values See HID v1.1.1 "5.3 Service Discovery Protocol (SDP)" --------------
            ServiceAttribute(
                SDP_HID_SERVICE_NAME_ATTRIBUTE_ID,  # 0x0100
                DataElement(DataElement.TEXT_STRING, b"Wireless Gamepad"),
            ),
            ServiceAttribute(
                SDP_HID_SERVICE_DESCRIPTION_ATTRIBUTE_ID,  # 0x0101
                DataElement(DataElement.TEXT_STRING, b"Gamepad"),
            ),
            ServiceAttribute(
                SDP_HID_PROVIDER_NAME_ATTRIBUTE_ID,  # 0x0102
                DataElement(DataElement.TEXT_STRING, b"Nintendo"),
            ),
            ServiceAttribute(
                SDP_HID_PARSER_VERSION_ATTRIBUTE_ID,  # 0x0201
                DataElement.unsigned_integer_16(0x0111),
            ),
            ServiceAttribute(
                SDP_HID_DEVICE_SUBCLASS_ATTRIBUTE_ID,  # 0x0202
                DataElement.unsigned_integer_8(0x08),
            ),
            ServiceAttribute(
                SDP_HID_COUNTRY_CODE_ATTRIBUTE_ID,  # 0x0203
                DataElement.unsigned_integer_8(HID_COUNTRY_CODE),
            ),
            ServiceAttribute(
                SDP_HID_VIRTUAL_CABLE_ATTRIBUTE_ID,  # 0x0204
                DataElement(DataElement.BOOLEAN, HID_VIRTUAL_CABLE),
            ),
            ServiceAttribute(
                SDP_HID_RECONNECT_INITIATE_ATTRIBUTE_ID,  # 0x0205
                DataElement(DataElement.BOOLEAN, HID_VIRTUAL_CABLE),
            ),
            ServiceAttribute(
                SDP_HID_DESCRIPTOR_LIST_ATTRIBUTE_ID,  # 0x0206
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.unsigned_integer_8(
                                    0x22
                                ),  # Report Descriptor Type
                                DataElement(DataElement.TEXT_STRING, HID_REPORT_MAP),
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_HID_LANGID_BASE_LIST_ATTRIBUTE_ID,  # 0x0207
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.unsigned_integer_16(
                                    0x0409
                                ),  # English (United States)
                                DataElement.unsigned_integer_16(
                                    0x0409
                                ),  # English (United States)
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_HID_BATTERY_POWER_ATTRIBUTE_ID,  # 0x0209
                DataElement(DataElement.BOOLEAN, HID_BATTERY_POWER),
            ),
            ServiceAttribute(
                SDP_HID_REMOTE_WAKE_ATTRIBUTE_ID,  # 0x020A
                DataElement(DataElement.BOOLEAN, HID_REMOTE_WAKE),
            ),
            ServiceAttribute(
                SDP_HID_SUPERVISION_TIMEOUT_ATTRIBUTE_ID,  # 0x020C
                DataElement.unsigned_integer_16(HID_SUPERVISION_TIMEOUT),
            ),
            ServiceAttribute(
                SDP_HID_NORMALLY_CONNECTABLE_ATTRIBUTE_ID,  # 0x020D
                DataElement(DataElement.BOOLEAN, HID_NORMALLY_CONNECTABLE),
            ),
            ServiceAttribute(
                SDP_HID_BOOT_DEVICE_ATTRIBUTE_ID,  # 0x020E
                DataElement(DataElement.BOOLEAN, HID_BOOT_DEVICE),
            ),
        ]
    }


# -----------------------------------------------------------------------------
async def get_stream_reader(pipe) -> asyncio.StreamReader:
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader(loop=loop)
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, pipe)
    return reader


class DeviceData:
    def __init__(self) -> None:
        self.keyboardData = bytearray(
            [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
        )
        self.mouseData = bytearray([0x02, 0x00, 0x00, 0x00])


class GamepadData:
    def __init__(self) -> None:
        self.gamepadData = bytearray(
            [0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
        )


# Device's live data - Mouse and Keyboard will be stored in this
deviceData = DeviceData()


# -----------------------------------------------------------------------------
async def gamepad_device(hid_device: HID_Device):
    # Start a Websocket server to receive events from a web page
    async def serve(websocket: server.ServerConnection):
        global deviceData
        while True:
            try:
                message = await websocket.recv()
                print("Received: ", str(message))
                parsed = json.loads(message)
                message_type = parsed["type"]
                if message_type == "keydown":
                    # Only deal with keys a to z for now
                    key = parsed["key"]
                    if len(key) == 1:
                        code = ord(key)
                        if ord("a") <= code <= ord("z"):
                            hid_code = 0x04 + code - ord("a")
                            deviceData.keyboardData = bytearray(
                                [
                                    0x01,
                                    0x00,
                                    0x00,
                                    hid_code,
                                    0x00,
                                    0x00,
                                    0x00,
                                    0x00,
                                    0x00,
                                ]
                            )
                            hid_device.send_data(deviceData.keyboardData)
                elif message_type == "keyup":
                    deviceData.keyboardData = bytearray(
                        [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
                    )
                    hid_device.send_data(deviceData.keyboardData)
                elif message_type == "mousemove":
                    # logical min and max values
                    log_min = -127
                    log_max = 127
                    x = parsed["x"]
                    y = parsed["y"]
                    # limiting x and y values within logical max and min range
                    x = max(log_min, min(log_max, x))
                    y = max(log_min, min(log_max, y))
                    deviceData.mouseData = bytearray([0x02, 0x00]) + struct.pack(
                        ">bb", x, y
                    )
                    hid_device.send_data(deviceData.mouseData)
            except ConnectionClosedOK:
                pass

    # pylint: disable-next=no-member
    await server.serve(serve, "localhost", 8989)
    await asyncio.get_event_loop().create_future()


async def keyboard_device(hid_device: HID_Device):
    # Start a Websocket server to receive events from a web page
    async def serve(websocket: server.ServerConnection):
        global deviceData
        while True:
            try:
                message = await websocket.recv()
                print("Received: ", str(message))
                parsed = json.loads(message)
                message_type = parsed["type"]
                if message_type == "keydown":
                    # Only deal with keys a to z for now
                    key = parsed["key"]
                    if len(key) == 1:
                        code = ord(key)
                        if ord("a") <= code <= ord("z"):
                            hid_code = 0x04 + code - ord("a")
                            deviceData.keyboardData = bytearray(
                                [
                                    0x01,
                                    0x00,
                                    0x00,
                                    hid_code,
                                    0x00,
                                    0x00,
                                    0x00,
                                    0x00,
                                    0x00,
                                ]
                            )
                            hid_device.send_data(deviceData.keyboardData)
                elif message_type == "keyup":
                    deviceData.keyboardData = bytearray(
                        [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
                    )
                    hid_device.send_data(deviceData.keyboardData)
                elif message_type == "mousemove":
                    # logical min and max values
                    log_min = -127
                    log_max = 127
                    x = parsed["x"]
                    y = parsed["y"]
                    # limiting x and y values within logical max and min range
                    x = max(log_min, min(log_max, x))
                    y = max(log_min, min(log_max, y))
                    deviceData.mouseData = bytearray([0x02, 0x00]) + struct.pack(
                        ">bb", x, y
                    )
                    hid_device.send_data(deviceData.mouseData)
            except ConnectionClosedOK:
                pass

    # pylint: disable-next=no-member
    await server.serve(serve, "localhost", 8989)
    await asyncio.get_event_loop().create_future()


# -----------------------------------------------------------------------------
async def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: python run_hid_device.py <device-config> <transport-spec> <command>"
            "  where <command> is one of:\n"
            "  test-mode (run with menu enabled for testing)\n"
            "  web (run a keyboard with keypress input from a web page, "
            "see keyboard.html"
        )
        print("example: python run_hid_device.py hid_keyboard.json usb:0 web")
        print("example: python run_hid_device.py hid_keyboard.json usb:0 test-mode")

        return

    async def handle_virtual_cable_unplug():
        hid_host_bd_addr = str(hid_device.remote_device_bd_address)
        await hid_device.disconnect_interrupt_channel()
        await hid_device.disconnect_control_channel()
        await device.keystore.delete(hid_host_bd_addr)  # type: ignore
        connection = hid_device.connection
        if connection is not None:
            await connection.disconnect()

    def on_hid_data_cb(pdu: bytes):
        print(f"Received Data, PDU: {pdu.hex()}")

    def on_get_report_cb(
        report_id: int, report_type: int, buffer_size: int
    ) -> HID_Device.GetSetStatus:
        retValue = hid_device.GetSetStatus()
        print(
            "GET_REPORT report_id: "
            + str(report_id)
            + "report_type: "
            + str(report_type)
            + "buffer_size:"
            + str(buffer_size)
        )
        if report_type == Message.ReportType.INPUT_REPORT:
            if report_id == 1:
                retValue.data = deviceData.keyboardData[1:]
                retValue.status = hid_device.GetSetReturn.SUCCESS
            elif report_id == 2:
                retValue.data = deviceData.mouseData[1:]
                retValue.status = hid_device.GetSetReturn.SUCCESS
            else:
                retValue.status = hid_device.GetSetReturn.REPORT_ID_NOT_FOUND

            if buffer_size:
                data_len = buffer_size - 1
                retValue.data = retValue.data[:data_len]
        elif report_type == Message.ReportType.OUTPUT_REPORT:
            # This sample app has nothing to do with the report received, to enable PTS
            # testing, we will return single byte random data.
            retValue.data = bytearray([0x11])
            retValue.status = hid_device.GetSetReturn.SUCCESS
        elif report_type == Message.ReportType.FEATURE_REPORT:
            retValue.status = hid_device.GetSetReturn.ERR_INVALID_PARAMETER
        elif report_type == Message.ReportType.OTHER_REPORT:
            if report_id == 3:
                retValue.status = hid_device.GetSetReturn.REPORT_ID_NOT_FOUND
        else:
            retValue.status = hid_device.GetSetReturn.FAILURE

        return retValue

    def on_set_report_cb(
        report_id: int, report_type: int, report_size: int, data: bytes
    ) -> HID_Device.GetSetStatus:
        print(
            "SET_REPORT report_id: "
            + str(report_id)
            + "report_type: "
            + str(report_type)
            + "report_size "
            + str(report_size)
            + "data:"
            + str(data)
        )
        if report_type == Message.ReportType.FEATURE_REPORT:
            status = HID_Device.GetSetReturn.ERR_INVALID_PARAMETER
        elif report_type == Message.ReportType.INPUT_REPORT:
            if report_id == 1 and report_size != len(deviceData.keyboardData):
                status = HID_Device.GetSetReturn.ERR_INVALID_PARAMETER
            elif report_id == 2 and report_size != len(deviceData.mouseData):
                status = HID_Device.GetSetReturn.ERR_INVALID_PARAMETER
            elif report_id == 3:
                status = HID_Device.GetSetReturn.REPORT_ID_NOT_FOUND
            else:
                status = HID_Device.GetSetReturn.SUCCESS
        else:
            status = HID_Device.GetSetReturn.SUCCESS

        return HID_Device.GetSetStatus(status=status)

    def on_get_protocol_cb() -> HID_Device.GetSetStatus:
        return HID_Device.GetSetStatus(
            data=bytes([protocol_mode]),
            status=hid_device.GetSetReturn.SUCCESS,
        )

    def on_set_protocol_cb(protocol: int) -> HID_Device.GetSetStatus:
        # We do not support SET_PROTOCOL.
        print(f"SET_PROTOCOL report_id: {protocol}")
        return HID_Device.GetSetStatus(
            status=hid_device.GetSetReturn.ERR_UNSUPPORTED_REQUEST
        )

    def on_virtual_cable_unplug_cb():
        print("Received Virtual Cable Unplug")
        asyncio.create_task(handle_virtual_cable_unplug())

    print("<<< connecting to HCI...")
    async with await open_transport(sys.argv[2]) as hci_transport:
        print("<<< connected")

        # Create a device
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True

        # Create and register HID device
        hid_device = HID_Device(device)

        # Register for  call backs
        hid_device.on("interrupt_data", on_hid_data_cb)

        hid_device.register_get_report_cb(on_get_report_cb)
        hid_device.register_set_report_cb(on_set_report_cb)
        hid_device.register_get_protocol_cb(on_get_protocol_cb)
        hid_device.register_set_protocol_cb(on_set_protocol_cb)

        # Register for virtual cable unplug call back
        hid_device.on("virtual_cable_unplug", on_virtual_cable_unplug_cb)

        # Setup the SDP to advertise HID Device service
        device.sdp_service_records = sdp_records()

        # Start the controller
        await device.power_on()

        # Start being discoverable and connectable
        await device.set_discoverable(True)
        await device.set_connectable(True)

        async def menu():
            reader = await get_stream_reader(sys.stdin)
            while True:
                print(
                    "\n************************ HID Device Menu *****************************\n"
                )
                print(" 1. Connect Control Channel")
                print(" 2. Connect Interrupt Channel")
                print(" 3. Disconnect Control Channel")
                print(" 4. Disconnect Interrupt Channel")
                print(" 5. Send Report on Interrupt Channel")
                print(" 6. Virtual Cable Unplug")
                print(" 7. Disconnect device")
                print(" 8. Delete Bonding")
                print(" 9. Re-connect to device")
                print("10. Exit ")
                print("\nEnter your choice : \n")

                choice = await reader.readline()
                choice = choice.decode("utf-8").strip()

                if choice == "1":
                    await hid_device.connect_control_channel()

                elif choice == "2":
                    await hid_device.connect_interrupt_channel()

                elif choice == "3":
                    await hid_device.disconnect_control_channel()

                elif choice == "4":
                    await hid_device.disconnect_interrupt_channel()

                elif choice == "5":
                    print(" 1. Report ID 0x01")
                    print(" 2. Report ID 0x02")
                    print(" 3. Invalid Report ID")

                    choice1 = await reader.readline()
                    choice1 = choice1.decode("utf-8").strip()

                    if choice1 == "1":
                        data = bytearray(
                            [0x01, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]
                        )
                        hid_device.send_data(data)
                        data = bytearray(
                            [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
                        )
                        hid_device.send_data(data)

                    elif choice1 == "2":
                        data = bytearray([0x02, 0x00, 0x00, 0xF6])
                        hid_device.send_data(data)
                        data = bytearray([0x02, 0x00, 0x00, 0x00])
                        hid_device.send_data(data)

                    elif choice1 == "3":
                        data = bytearray([0x00, 0x00, 0x00, 0x00])
                        hid_device.send_data(data)
                        data = bytearray([0x00, 0x00, 0x00, 0x00])
                        hid_device.send_data(data)

                    else:
                        print("Incorrect option selected")

                elif choice == "6":
                    hid_device.virtual_cable_unplug()
                    try:
                        hid_host_bd_addr = str(hid_device.remote_device_bd_address)
                        await device.keystore.delete(hid_host_bd_addr)
                    except KeyError:
                        print("Device not found or Device already unpaired.")

                elif choice == "7":
                    connection = hid_device.connection
                    if connection is not None:
                        await connection.disconnect()
                    else:
                        print("Already disconnected from device")

                elif choice == "8":
                    try:
                        hid_host_bd_addr = str(hid_device.remote_device_bd_address)
                        await device.keystore.delete(hid_host_bd_addr)
                    except KeyError:
                        print("Device NOT found or Device already unpaired.")

                elif choice == "9":
                    hid_host_bd_addr = str(hid_device.remote_device_bd_address)
                    connection = await device.connect(
                        hid_host_bd_addr, transport=PhysicalTransport.BR_EDR
                    )
                    await connection.authenticate()
                    await connection.encrypt()

                elif choice == "10":
                    sys.exit("Exit successful")

                else:
                    print("Invalid option selected.")

        if (len(sys.argv) > 3) and (sys.argv[3] == "test-mode"):
            # Test mode for PTS/Unit testing
            await menu()
        else:
            # default option is using keyboard.html (web)
            print("Executing in Web mode")
            await keyboard_device(hid_device)

        await hci_transport.source.wait_for_termination()


# -----------------------------------------------------------------------------
bumble.logging.setup_basic_logging("DEBUG")
asyncio.run(main())
