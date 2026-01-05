# Pro Controller Pairing POC for Nintendo Switch
# Ported from nxbt for Bumble framework

import asyncio
import logging
import sys

import bumble.logging
from bumble.core import (
    BT_HIDP_PROTOCOL_ID,
    BT_HUMAN_INTERFACE_DEVICE_SERVICE,
    BT_L2CAP_PROTOCOL_ID,
)
from bumble.device import Device
from bumble.hci import Address
from bumble.hid import Device as HID_Device
from bumble.hid import Message
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

from switch_protocol import SwitchProtocol

SDP_HID_SERVICE_NAME_ATTRIBUTE_ID = 0x0100
SDP_HID_SERVICE_DESCRIPTION_ATTRIBUTE_ID = 0x0101
SDP_HID_PROVIDER_NAME_ATTRIBUTE_ID = 0x0102
SDP_HID_DEVICE_RELEASE_NUMBER_ATTRIBUTE_ID = 0x0200
SDP_HID_PARSER_VERSION_ATTRIBUTE_ID = 0x0201
SDP_HID_DEVICE_SUBCLASS_ATTRIBUTE_ID = 0x0202
SDP_HID_COUNTRY_CODE_ATTRIBUTE_ID = 0x0203
SDP_HID_VIRTUAL_CABLE_ATTRIBUTE_ID = 0x0204
SDP_HID_RECONNECT_INITIATE_ATTRIBUTE_ID = 0x0205
SDP_HID_DESCRIPTOR_LIST_ATTRIBUTE_ID = 0x0206
SDP_HID_LANGID_BASE_LIST_ATTRIBUTE_ID = 0x0207
SDP_HID_SDP_DISABLE_ATTRIBUTE_ID = 0x0208
SDP_HID_BATTERY_POWER_ATTRIBUTE_ID = 0x0209
SDP_HID_REMOTE_WAKE_ATTRIBUTE_ID = 0x020A
SDP_HID_PROFILE_VERSION_ATTRIBUTE_ID = 0x020B
SDP_HID_SUPERVISION_TIMEOUT_ATTRIBUTE_ID = 0x020C
SDP_HID_NORMALLY_CONNECTABLE_ATTRIBUTE_ID = 0x020D
SDP_HID_BOOT_DEVICE_ATTRIBUTE_ID = 0x020E

LANGUAGE = 0x656E
ENCODING = 0x6A
PRIMARY_LANGUAGE_BASE_ID = 0x100
HID_COUNTRY_CODE = 0x21
HID_VIRTUAL_CABLE = True
HID_RECONNECT_INITIATE = True
HID_BATTERY_POWER = True
HID_REMOTE_WAKE = True
HID_SUPERVISION_TIMEOUT = 0xC80
HID_NORMALLY_CONNECTABLE = False
HID_BOOT_DEVICE = False

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

protocol_mode = Message.ProtocolMode.REPORT_PROTOCOL


def sdp_records():
    service_record_handle = 0x00010002
    return {
        service_record_handle: [
            ServiceAttribute(
                SDP_SERVICE_RECORD_HANDLE_ATTRIBUTE_ID,
                DataElement.sequence(
                    [DataElement.uuid(BT_HUMAN_INTERFACE_DEVICE_SERVICE)]
                ),
            ),
            ServiceAttribute(
                SDP_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(BT_L2CAP_PROTOCOL_ID),
                                DataElement.unsigned_integer_16(17),
                            ]
                        ),
                        DataElement.sequence(
                            [
                                DataElement.uuid(BT_HIDP_PROTOCOL_ID),
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_BROWSE_GROUP_LIST_ATTRIBUTE_ID,
                DataElement.sequence([DataElement.uuid(SDP_PUBLIC_BROWSE_ROOT)]),
            ),
            ServiceAttribute(
                SDP_LANGUAGE_BASE_ATTRIBUTE_ID_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.unsigned_integer_16(LANGUAGE),
                        DataElement.unsigned_integer_16(ENCODING),
                        DataElement.unsigned_integer_16(PRIMARY_LANGUAGE_BASE_ID),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_BLUETOOTH_PROFILE_DESCRIPTOR_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(BT_HUMAN_INTERFACE_DEVICE_SERVICE),
                                DataElement.unsigned_integer_16(0x0101),
                            ]
                        )
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_ADDITIONAL_PROTOCOL_DESCRIPTOR_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.sequence(
                                    [
                                        DataElement.uuid(BT_L2CAP_PROTOCOL_ID),
                                        DataElement.unsigned_integer_16(0x0013),
                                    ]
                                ),
                                DataElement.sequence(
                                    [
                                        DataElement.uuid(BT_HIDP_PROTOCOL_ID),
                                    ]
                                ),
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_HID_SERVICE_NAME_ATTRIBUTE_ID,
                DataElement(DataElement.TEXT_STRING, b"Wireless Gamepad"),
            ),
            ServiceAttribute(
                SDP_HID_SERVICE_DESCRIPTION_ATTRIBUTE_ID,
                DataElement(DataElement.TEXT_STRING, b"Gamepad"),
            ),
            ServiceAttribute(
                SDP_HID_PROVIDER_NAME_ATTRIBUTE_ID,
                DataElement(DataElement.TEXT_STRING, b"Nintendo"),
            ),
            ServiceAttribute(
                SDP_HID_PARSER_VERSION_ATTRIBUTE_ID,
                DataElement.unsigned_integer_16(0x0111),
            ),
            ServiceAttribute(
                SDP_HID_DEVICE_SUBCLASS_ATTRIBUTE_ID,
                DataElement.unsigned_integer_8(0x08),
            ),
            ServiceAttribute(
                SDP_HID_COUNTRY_CODE_ATTRIBUTE_ID,
                DataElement.unsigned_integer_8(HID_COUNTRY_CODE),
            ),
            ServiceAttribute(
                SDP_HID_VIRTUAL_CABLE_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_VIRTUAL_CABLE),
            ),
            ServiceAttribute(
                SDP_HID_RECONNECT_INITIATE_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_VIRTUAL_CABLE),
            ),
            ServiceAttribute(
                SDP_HID_DESCRIPTOR_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.unsigned_integer_8(0x022),
                                DataElement(DataElement.TEXT_STRING, HID_REPORT_MAP),
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_HID_LANGID_BASE_LIST_ATTRIBUTE_ID,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.unsigned_integer_16(0x0409),
                                DataElement.unsigned_integer_16(0x0409),
                            ]
                        ),
                    ]
                ),
            ),
            ServiceAttribute(
                SDP_HID_BATTERY_POWER_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_BATTERY_POWER),
            ),
            ServiceAttribute(
                SDP_HID_REMOTE_WAKE_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_REMOTE_WAKE),
            ),
            ServiceAttribute(
                SDP_HID_SUPERVISION_TIMEOUT_ATTRIBUTE_ID,
                DataElement.unsigned_integer_16(HID_SUPERVISION_TIMEOUT),
            ),
            ServiceAttribute(
                SDP_HID_NORMALLY_CONNECTABLE_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_NORMALLY_CONNECTABLE),
            ),
            ServiceAttribute(
                SDP_HID_BOOT_DEVICE_ATTRIBUTE_ID,
                DataElement(DataElement.BOOLEAN, HID_BOOT_DEVICE),
            ),
        ]
    }


def setup_logging():
    """Setup logging to console and file"""
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    file_handler = logging.FileHandler("switch_packets.log")
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter("%(asctime)s - %(message)s")
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    logger = logging.getLogger("switch_pair")
    logger.setLevel(logging.DEBUG)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


def format_switch_msg(data: bytes, direction: str) -> str:
    """Format Switch packet for logging"""
    if len(data) < 11:
        return f"{direction}: Too short ({len(data)} bytes)"

    payload = " ".join(f"{b:02X}" for b in data[:11])
    subcmd = ""

    if len(data) > 11:
        subcmd_id = data[11]
        subcmd = f"| Sub: 0x{subcmd_id:02X}"
        if len(data) > 12:
            subcmd_data = " ".join(f"{b:02X}" for b in data[12:])
            subcmd += f" {subcmd_data}"

    return f"[{direction}] Payload: {payload} {subcmd}"


def handle_virtual_cable_unplug(hid_device: HID_Device, device: Device):
    async def _handle():
        hid_host_bd_addr = str(hid_device.remote_device_bd_address)
        await hid_device.disconnect_interrupt_channel()
        await hid_device.disconnect_control_channel()
        if device.keystore:
            await device.keystore.delete(hid_host_bd_addr)
        connection = hid_device.connection
        if connection is not None:
            await connection.disconnect()

    return _handle()


async def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python switch_pair.py <device-config> <transport-spec>")
        print("example: python switch_pair.py pro_controller.json usb:0")
        print("")
        print("Press Ctrl+C to exit")
        return

    logger = setup_logging()

    print("=" * 60)
    print("Pro Controller Switch Pairing POC")
    print("=" * 60)
    print("")

    if len(sys.argv) == 4:
        bt_address = sys.argv[3]
    else:
        bt_address = "98:b6:e9:12:34:57"

    protocol = SwitchProtocol("PRO_CONTROLLER", bt_address)

    def on_hid_data_cb(pdu: bytes):
        packet_log = format_switch_msg(pdu, "RX")
        logger.debug(packet_log)
        if len(pdu) > 40:
            print(f"  [RX] Switch command: 0x{pdu[11]:02X}")

        protocol.process_commands(pdu)
        report = protocol.get_report()

        if len(report) > 1:
            tx_log = format_switch_msg(report, "TX")
            logger.debug(tx_log)
            if len(report) > 20:
                print(f"  [TX] Response sent ({len(report)} bytes)")

            hid_device.send_data(report)

    def on_get_report_cb(
        report_id: int, report_type: int, buffer_size: int
    ) -> HID_Device.GetSetStatus:
        retValue = hid_device.GetSetStatus()

        logger.info(
            f"GET_REPORT: ID=0x{report_id:02X}, Type={report_type}, Size={buffer_size}"
        )

        if report_type == Message.ReportType.INPUT_REPORT:
            if report_id == 0x21:
                protocol.set_subcommand_reply()
                retValue.data = bytes(protocol.get_report()[1:])
                retValue.status = hid_device.GetSetReturn.SUCCESS
                print(f"  [GET] Subcommand reply (0x21)")
            elif report_id == 0x30:
                protocol.set_full_input_report()
                retValue.data = bytes(protocol.get_report()[1:])
                retValue.status = hid_device.GetSetReturn.SUCCESS
                print(f"  [GET] Full input report (0x30)")
            else:
                retValue.status = hid_device.GetSetReturn.REPORT_ID_NOT_FOUND

            if buffer_size:
                data_len = buffer_size - 1
                retValue.data = retValue.data[:data_len]
        else:
            retValue.status = hid_device.GetSetReturn.ERR_INVALID_PARAMETER

        return retValue

    def on_set_report_cb(
        report_id: int, report_type: int, report_size: int, data: bytes
    ) -> HID_Device.GetSetStatus:
        logger.info(
            f"SET_REPORT: ID=0x{report_id:02X}, Type={report_type}, Size={report_size}"
        )

        if report_type == Message.ReportType.OUTPUT_REPORT:
            retValue = hid_device.GetSetStatus(status=hid_device.GetSetReturn.SUCCESS)
        elif report_type == Message.ReportType.FEATURE_REPORT:
            retValue = hid_device.GetSetStatus(
                status=hid_device.GetSetReturn.ERR_INVALID_PARAMETER
            )
        else:
            retValue = hid_device.GetSetStatus(status=hid_device.GetSetReturn.SUCCESS)

        return retValue

    def on_get_protocol_cb() -> HID_Device.GetSetStatus:
        return HID_Device.GetSetStatus(
            data=bytes([protocol_mode]),
            status=hid_device.GetSetReturn.SUCCESS,
        )

    def on_set_protocol_cb(protocol_mode_arg: int) -> HID_Device.GetSetStatus:
        logger.info(f"SET_PROTOCOL: {protocol_mode_arg}")
        return HID_Device.GetSetStatus(
            status=hid_device.GetSetReturn.ERR_UNSUPPORTED_REQUEST
        )

    def on_virtual_cable_unplug_cb():
        print("\n! Virtual cable unplug received")
        logger.warning("Virtual cable unplug received")

    async with await open_transport(sys.argv[2]) as hci_transport:
        logger.info(f"Transport: {sys.argv[2]}")

        # Create a device
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True
        device.public_address = Address(bt_address)

        logger.info(f"Device address: {device.public_address}")
        logger.info(f"Device class: 0x{device.class_of_device:04X}")
        logger.info(f"Device name: {device.name}")

        # Create and register HID Device
        hid_device = HID_Device(device)

        async def on_connection(connection):
            logger.info(f"Connection from: {connection.peer_address}")

            try:
                await connection.authenticate()
                logger.info("Authentication successful")

                await connection.encrypt()
                logger.info("Encryption enabled")
            except Exception as e:
                logger.error(f"Auth/Encrypt failed: {e}")

        device.on("connection", on_connection)

        # Register for call backs
        hid_device.on("interrupt_data", on_hid_data_cb)

        hid_device.register_get_report_cb(on_get_report_cb)
        hid_device.register_set_report_cb(on_set_report_cb)
        hid_device.register_get_protocol_cb(on_get_protocol_cb)
        hid_device.register_set_protocol_cb(on_set_protocol_cb)

        # Register for virtual cable unplug call back
        hid_device.on("virtual_cable_unplug", on_virtual_cable_unplug_cb)

        # Setup the SDP to advertise HID Device service
        device.sdp_service_records = sdp_records()
        logging.debug(f"Device class: 0x{device.class_of_device:04X}")
        logging.debug(f"Device name: {device.name}")

        # Start the controller
        await device.power_on()
        logging.info("Device powered on + SDP Records registered")

        # Start being discoverable and connectable
        await device.set_discoverable(True)
        await device.set_connectable(True)

        print("")
        print("Waiting for Switch connection...")
        print("  On Switch, go to: Controllers > Change Grip/Order")
        print("")
        print("-" * 60)
        print("  [STATUS] Pairing loop started (15Hz)")
        print("-" * 60)

        pairing_complete = False
        packet_count = 0

        while not pairing_complete:
            try:
                protocol.process_commands(None)
                report = protocol.get_report()

                hid_device.send_data(report)

                if protocol.is_pairing_complete():
                    print("")
                    print("=" * 60)
                    print("✓ PAIRING COMPLETE!")
                    print("=" * 60)
                    print(f"  Player Number: {protocol.player_number}")
                    print(
                        f"  Vibration: {'Enabled' if protocol.vibration_enabled else 'Disabled'}"
                    )
                    print(f"  Packets Exchanged: {packet_count}")
                    print("=" * 60)
                    pairing_complete = True
                else:
                    if packet_count % 30 == 0 and packet_count > 0:
                        print(f"  [STATUS] Waiting... ({packet_count} packets sent)")
                    packet_count += 1

                await asyncio.sleep(1 / 15)

            except Exception as e:
                print(f"\n✗ Error during pairing: {e}")
                logger.error(f"Pairing error: {e}")
                print("  [STATUS] Waiting for Switch connection...")
                await asyncio.sleep(1)
                continue

        print("")
        print("✓ Pairing complete - keeping connection alive")
        print("  [STATUS] Press Ctrl+C to exit")
        print("")

        try:
            while True:
                if protocol.device_info_queried:
                    protocol.set_full_input_report()
                    report = protocol.get_report()
                    hid_device.send_data(report)

                await asyncio.sleep(1 / 132)
        except KeyboardInterrupt:
            print("\n\n✓ Exiting gracefully...")
            logger.info("User requested exit")


bumble.logging.setup_basic_logging("INFO")
asyncio.run(main())
