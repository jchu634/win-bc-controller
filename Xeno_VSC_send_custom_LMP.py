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
import sys

from bumble.colors import color
from bumble.device import Device
from bumble.transport import open_transport
from bumble.core import PhysicalTransport, BT_L2CAP_PROTOCOL_ID, CommandTimeoutError
import bumble.logging

# XENO: For basic VSC sending
from bumble.drivers import rtk
from bumble import hci

# XENO: For LMP parsing
# Add project root (parent of examples) to sys.path so 'TME' can be imported
import os
project_root = os.path.dirname(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from TME.TME_helpers import bytes_to_hex_str
from TME.TME_BTIDES_LMP import BTIDES_export_LMP_generic_full_pkt_hex_str
from TME.TME_BTIDES_base import write_BTIDES

from LMP_common import *

async def do_xeno_vsc(host, payload):
    # passthrough
    await rtk.Driver.local_send_xeno_VSC(host, payload)

target_address = ""

def parse_my_VSEs(payload: bytes):
    global target_address
    if payload[:4] == b'\x41\x41\x41\x41':
    #     print('\tFound one of my VSEs')
        if(len(payload) >= 0x1D):
            LMP_opcode = int.from_bytes(payload[0x1C:0x1D], "little") >> 1
            if LMP_opcode in LMP_BASIC_OPCODE_NAMES:
                if(LMP_opcode == LMP_ESCAPE_127):
                    print(f"\t{color(LMP_BASIC_OPCODE_NAMES[LMP_opcode], 'green')}")
                    LMP_EXT_opcode = int.from_bytes(payload[0x1D:0x1E], "little")
                    if(LMP_EXT_opcode in LMP_LMP_ESCAPE_127_OPCODE_NAMES):
                        print(f"\t{color(LMP_LMP_ESCAPE_127_OPCODE_NAMES[LMP_EXT_opcode], 'green')} seen")
                    else:
                        print(f"Opcode not entered yet: {LMP_EXT_opcode}")
                else:
                    if(LMP_opcode > LMP_MAX_DEFINED_OPCODE):
                        print(f"\t{color('LMP_Unknown_Opcode_'+str(LMP_opcode), 'red')} seen")
                    else:
                        print(f"\t{color(LMP_BASIC_OPCODE_NAMES[LMP_opcode], 'green')} seen")
                        if(LMP_opcode in LMP_BASIC_OPCODES_TO_BYTE_SIZES):
                            data_len = LMP_BASIC_OPCODES_TO_BYTE_SIZES[LMP_opcode]
                            if(data_len != 0):
                                raw_bytes = payload[0x1D:0x1D+data_len]
                                full_pkt_hex_str = bytes_to_hex_str(raw_bytes)
                                print(f"\t\tFull packet data (without opcode): {color(full_pkt_hex_str, 'yellow')}")
                                print(f"target_address = {target_address}")
                                # Export directly to BTIDES (because Scapy doesn't even have placeholder support for LMP!
                                # (Though it seems like Wireshark can parse it, but I'm not getting all the header info currently)
                                BTIDES_export_LMP_generic_full_pkt_hex_str(target_address, LMP_opcode, full_pkt_hex_str)

    return None

# ----------------------------------------------------------------------------- 
async def main() -> None:
    global target_address
    if len(sys.argv) < 3:
        print(
            'Usage: run_classic_connect.py <device-config> <transport-spec> '
            '<bluetooth-addresses..>'
        )
        print('example: run_classic_connect_xeno.py classic1.json usb:0 E1:CA:72:48:C4:E8')
        return

    print('<<< connecting to HCI...')
    async with await open_transport(sys.argv[2]) as hci_transport:
        print('<<< connected')

        # Create a device
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True
        device.le_enabled = False
        await device.power_on()

        hci.HCI_Event.add_vendor_factory(parse_my_VSEs)

        async def connect(target_address):
            print(f'=== Connecting to {target_address}...')
            try:
                connection = await device.connect(
                    target_address, transport=PhysicalTransport.BR_EDR
                )
            except CommandTimeoutError:
                print('!!! Connection timed out')
                return
            print(f'=== Connected to {connection.peer_address}!')

            # Get remote name by existing API - this is working
            try:
                await connection.request_remote_name()
                peer_name = '' if connection.peer_name is None else connection.peer_name
                print(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
                print(f"Remote name: {color(peer_name, 'green')}")
                print("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
            except CommandTimeoutError:
                print('!!! Read remote name timed out')

            # Now send the VSC which causes an LMP packet to be sent
            try:
               await do_xeno_vsc(device.host, b'\x27\x00\xff\xff\xff\xff\xff\xff\xff\xff') # LMP_FEATURES_REQ with features of all 0xFFs (8 bytes)
            except CommandTimeoutError:
                print('!!! Read Xeno VSC timed out')

            # Now send the VSC which causes an LMP packet to be sent
            try:
                await do_xeno_vsc(device.host, b'\x25\x00\x0D\x4D\x44\x37\x13') # LMP_VERSION_REQ with Version = 0x0D, Company ID = 0x444D (ASCII "DM"), Subversion = 0x1337
            except CommandTimeoutError:
                print('!!! Read Xeno VSC timed out')

            await asyncio.sleep(1)

            filename = target_address.replace(":", "_")
            #filename = "_".join(addr.replace(":", "_") for addr in target_addresses)
            print(f"Writing BTIDES data to file {filename}")
            write_BTIDES(f"{filename}.btides")

            # disconnect
            await connection.disconnect()
            print(f'=== Disconnected from {connection.peer_address}')

        # Connect to a peer
        target_address = sys.argv[3]
        await asyncio.wait(
            [
                asyncio.create_task(connect(target_address))
            ]
        )


# -----------------------------------------------------------------------------
bumble.logging.setup_basic_logging('DEBUG')
asyncio.run(main())
