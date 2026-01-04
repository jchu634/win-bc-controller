"""
Debug script to check device advertising and try HCI Write Class of Device command
"""

import asyncio
import sys
from bumble.core import BT_HIDP_PROTOCOL_ID
from bumble.device import Device
from bumble.hid import HID_Control_PSM, HID_INTERRUPT_PSM, Message
from bumble.hid import Device as HID_Device
from bumble.transport import open_transport
from bumble.sdp import DataElement, ServiceAttribute
from bumble import hci

from switch_protocol import SwitchProtocol


HID_REPORT_MAP = bytes(
    [
        0x05,
        0x01,
        0x09,
        0x05,
        0xA1,
        0x01,
        0x06,
        0x01,
        0xFF,
        0x85,
        0x21,
        0x09,
        0x21,
        0x75,
        0x08,
        0x95,
        0x30,
        0x81,
        0x02,
        0x85,
        0x30,
        0x09,
        0x30,
        0x75,
        0x08,
        0x95,
        0x30,
        0x81,
        0x02,
        0x85,
        0x31,
        0x09,
        0x31,
        0x75,
        0x08,
        0x95,
        0x66,
        0x81,
        0x02,
        0x85,
        0x32,
        0x09,
        0x32,
        0x75,
        0x08,
        0x95,
        0x66,
        0x81,
        0x02,
        0x85,
        0x33,
        0x09,
        0x33,
        0x75,
        0x08,
        0x95,
        0x66,
        0x81,
        0x02,
        0x85,
        0x3F,
        0x05,
        0x09,
        0x19,
        0x01,
        0x29,
        0x10,
        0x15,
        0x00,
        0x25,
        0x01,
        0x75,
        0x01,
        0x95,
        0x10,
        0x81,
        0x02,
        0x05,
        0x01,
        0x09,
        0x39,
        0x15,
        0x00,
        0x25,
        0x07,
        0x75,
        0x04,
        0x95,
        0x01,
        0x81,
        0x42,
        0x05,
        0x09,
        0x75,
        0x04,
        0x95,
        0x01,
        0x81,
        0x01,
        0x05,
        0x01,
        0x09,
        0x30,
        0x09,
        0x31,
        0x09,
        0x33,
        0x09,
        0x34,
        0x16,
        0x00,
        0x00,
        0x26,
        0xFF,
        0xFF,
        0x75,
        0x10,
        0x95,
        0x04,
        0x81,
        0x02,
        0x06,
        0x01,
        0xFF,
        0x85,
        0x01,
        0x09,
        0x01,
        0x75,
        0x08,
        0x95,
        0x30,
        0x91,
        0x02,
        0x85,
        0x10,
        0x09,
        0x10,
        0x75,
        0x08,
        0x95,
        0x30,
        0x91,
        0x02,
        0x85,
        0x11,
        0x09,
        0x11,
        0x75,
        0x08,
        0x95,
        0x30,
        0x91,
        0x02,
        0x85,
        0x12,
        0x09,
        0x12,
        0x75,
        0x08,
        0x95,
        0x30,
        0x91,
        0x02,
        0xC0,
    ]
)


def create_simple_sdp_records():
    service_record_handle = 0x00010002
    return {
        service_record_handle: [
            ServiceAttribute(0x0001, DataElement.sequence([DataElement.uuid(0x1124)])),
            ServiceAttribute(
                0x0004,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(0x0100),
                                DataElement.unsigned_integer_16(17),
                            ]
                        ),
                        DataElement.sequence([DataElement.uuid(0x0011)]),
                    ]
                ),
            ),
            ServiceAttribute(0x0005, DataElement.sequence([DataElement.uuid(0x1002)])),
            ServiceAttribute(
                0x0006,
                DataElement.sequence(
                    [
                        DataElement.unsigned_integer_16(0x656E),
                        DataElement.unsigned_integer_16(0x006A),
                        DataElement.unsigned_integer_16(0x0100),
                    ]
                ),
            ),
            ServiceAttribute(
                0x0009,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.uuid(0x1124),
                                DataElement.unsigned_integer_16(0x0101),
                            ]
                        )
                    ]
                ),
            ),
            ServiceAttribute(
                0x000D,
                DataElement.sequence(
                    [
                        DataElement.sequence(
                            [
                                DataElement.sequence(
                                    [
                                        DataElement.uuid(0x0100),
                                        DataElement.unsigned_integer_16(0x0013),
                                    ]
                                ),
                                DataElement.sequence([DataElement.uuid(0x0011)]),
                            ]
                        )
                    ]
                ),
            ),
            ServiceAttribute(
                0x0100, DataElement(DataElement.TEXT_STRING, "Pro Controller")
            ),
            ServiceAttribute(0x0101, DataElement(DataElement.TEXT_STRING, "Gamepad")),
            ServiceAttribute(0x0102, DataElement(DataElement.TEXT_STRING, "Nintendo")),
        ]
    }


async def main():
    if len(sys.argv) < 3:
        print("Usage: python test_device_class.py <device-config> <transport-spec>")
        return

    print("=" * 60)
    print("Device Class Debug Tool")
    print("=" * 60)
    print()

    async with await open_transport(sys.argv[2]) as hci_transport:
        print("HCI transport connected")

        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True

        print(f"Device address: {device.public_address}")
        print(
            f"Device class (from JSON): {device.class_of_device} (0x{device.class_of_device:04X})"
        )
        print(f"Device name: {device.name}")

        device.sdp_service_records = create_simple_sdp_records()

        await device.power_on()

        print(
            f"Device class (after power_on): {device.class_of_device} (0x{device.class_of_device:04X})"
        )

        await device.set_discoverable(True)

        print(
            f"Device class (after discoverable): {device.class_of_device} (0x{device.class_of_device:04X})"
        )
        print()

        print("Trying to send HCI Write Class of Device command...")
        print("  Command: 0x2408 (Write Class of Device)")
        print("  Parameters: 0x00 0x25 0x08 0x00")
        print()

        try:
            write_class_packet = hci.HCI_Write_Class_Of_Device_Packet(
                class_of_device=0x2508
            )

            print(f"Packet created: {write_class_packet}")
            print(f"Packet bytes: {bytes(write_class_packet).hex()}")

            if hasattr(device.controller, "send_hci_packet"):
                device.controller.send_hci_packet(write_class_packet)
                print("✓ Write Class of Device command sent!")
            else:
                print("✗ Cannot find send_hci_packet method")

            await asyncio.sleep(1)

            print()
            print("Device should now be advertising with class 0x2508")
            print("Check on Switch - go to Controllers > Change Grip/Order")
            print("Press Ctrl+C to exit")
            print()

            while True:
                await asyncio.sleep(5)

        except Exception as e:
            print(f"✗ Error: {e}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    import bumble.logging

    bumble.logging.setup_basic_logging("INFO")
    asyncio.run(main())
