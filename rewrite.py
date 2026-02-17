import asyncio
import logging
import sys

import bumble.logging
from bumble.device import Device
from bumble.hci import Address
from bumble.hid import HID_CONTROL_PSM
from bumble.hid import Device as HID_Device
from bumble.l2cap import ClassicChannelSpec
from bumble.pairing import PairingConfig, PairingDelegate
from bumble.transport import open_transport

from controller import ControllerTypes
from sdp_records import DEVICE_CLASS_GAMEPAD, sdp_record
from switch_protocol import ControllerProtocol, build_empty_switch_input_payload


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

    protocol = ControllerProtocol(ControllerTypes.PRO_CONTROLLER, bt_address)

    async with await open_transport(sys.argv[2]) as hci_transport:
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        encrypted = False
        device.classic_enabled = True
        # device.classic_ssp_enabled = True
        device.public_address = Address(bt_address)

        device.class_of_device = DEVICE_CLASS_GAMEPAD
        # device.pairing_config_factory = lambda connection: PairingConfig(
        #     mitm=True,
        #     bonding=True,
        #     delegate=PairingDelegate(
        #         # io_capability=PairingDelegate.DISPLAY_OUTPUT_AND_YES_NO_INPUT,
        #         io_capability=PairingDelegate.NO_OUTPUT_NO_INPUT,
        #     ),
        # )

        logger.info(f"Device address: {device.public_address}")
        logger.info(f"Device name: {device.name}")

        async def on_connection(connection):
            logger.info(f"Connected to {connection.peer_address}")
            await connection.encrypt()

            while not connection.is_encrypted:
                await asyncio.sleep(0.1)

            logger.info("Encryption established, channels now available")

            # await hid_device.connect_control_channel()  # Channel 11
            # await hid_device.connect_interrupt_channel(   )  # Channel 13
            # logging.info("Connected HID Control + Interrupt Channels")
            # await send_spam_reports()

        device.on("connection", on_connection)

        device.sdp_service_records = sdp_record()

        hid_device = HID_Device(device)

        # async def send_spam_reports():
        #     for i in range(60):
        #         hid_device.send_data(build_empty_switch_input_payload())

        await device.power_on()

        logging.info("Device powered on + SDP Records registered")

        await device.set_discoverable(True)
        await device.set_connectable(True)

        # Block forever (until manual termination)

        await asyncio.Event().wait()


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
