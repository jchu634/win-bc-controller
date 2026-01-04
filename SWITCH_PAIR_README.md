# Pro Controller Switch Pairing POC

## Overview
This is a proof-of-concept implementation of Nintendo Switch Pro Controller pairing using the Bumble Bluetooth framework. It ports the pairing logic from nxbt to Bumble, running on Windows with a Realtek USB Bluetooth adapter.

## Prerequisites

- Python 3.12+
- Bluetooth adapter (Realtek USB with WinUSB firmware)
- Nintendo Switch console

## Installation

```bash
pip install -r requirements.txt
# Or manually:
pip install bumble inputs pygame-ce
```

## Configuration

### Device Config File
Create `pro_controller.json`:
```json
{
  "name": "Pro Controller",
  "class_of_device": 9480,
  "keystore": "JsonKeyStore"
}
```

### Find Your Transport Spec
To find your Bluetooth adapter:
```bash
# On Windows, check Device Manager for USB Bluetooth adapter
# Transport format: usb:<vendor_id>:<product_id>
# Example: usb:0bda:8771  (Realtek adapter)
```

## Usage

### Pair with Switch

```bash
python switch_pair.py pro_controller.json usb:<vendor>:<product>
```

Example:
```bash
python switch_pair.py pro_controller.json usb:0bda:8771
```

### On the Switch

1. Go to: **Controllers** → **Change Grip/Order**
2. Look for "Pro Controller" in the list
3. Press **A** to connect

The pairing script will:
- Wait for Switch connection
- Send reports at 15Hz during pairing
- Log all packets to `switch_packets.log`
- Display pairing status to console
- Detect when pairing completes (player lights + vibration enabled)

### Expected Output

```
============================================================
Pro Controller Switch Pairing POC
============================================================

✓ HCI transport connected
✓ Device created: AA:BB:CC:DD:EE:FF
✓ Switch protocol initialized
✓ Device powered on
✓ SDP records registered

Waiting for Switch connection...
  On Switch, go to: Controllers > Change Grip/Order
------------------------------------------------------------
  [STATUS] Pairing loop started (15Hz)
------------------------------------------------------------

  [RX] Switch command: 0x02  (REQUEST_DEVICE_INFO)
  [GET] Subcommand reply (0x21)
  [RX] Switch command: 0x10  (SPI_READ)
  [STATUS] Waiting... (30 packets sent)

============================================================
✓ PAIRING COMPLETE!
============================================================
  Player Number: 1
  Vibration: Enabled
  Packets Exchanged: 47
============================================================

✓ Pairing complete - keeping connection alive
  [STATUS] Press Ctrl+C to exit
```

## Log Files

### switch_packets.log
Contains detailed packet logs:
```
2024-01-04 12:00:00,000 - [RX] Payload: A2 00 00 00 00 00 00 00 00 00 00 00 | Sub: 0x02 00 00 00 00 00 00 00 00 00 00
2024-01-04 12:00:00,001 - [TX] Payload: A1 21 00 90 00 00 00 6F C8 77 16 D8 7D A0
```

## Troubleshooting

### Device not found on Switch
- Check Bluetooth adapter is powered on
- Verify transport spec matches your adapter
- Try restarting the script

### Pairing fails
- Check `switch_packets.log` for error messages
- Ensure Switch is in "Change Grip/Order" mode
- Move controller closer to Switch

### Script crashes
- Check you're running as administrator
- Verify adapter has proper WinUSB firmware
- Try different USB port

## Files

- `switch_pair.py` - Main pairing script
- `switch_protocol.py` - Switch protocol implementation
- `switch_packets.log` - Packet log (created on run)
- `pro_controller.json` - Device config (create if needed)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              switch_pair.py                          │
│  - HCI transport setup                                │
│  - Device configuration                                 │
│  - HID Device creation                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│          SwitchProtocol Class                        │
│  - process_commands(data)                             │
│  - Parse Switch messages (0xA2 prefix)                │
│  - Generate responses (0x21/0x30 reports)            │
│  - Track pairing state                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│         Bumble HID Device                           │
│  - send_data(report_bytes)                             │
│  - on('interrupt_data', callback)                        │
│  - Register GET/SET report callbacks                    │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps (Future Phases)

### Phase 4: Button Input Testing
Add CLI-based button input for testing:
- Send button presses (A, B, X, Y, etc.)
- Send stick positions
- Test in Switch menus/games

### Phase 5: Real Controller Input
Mirror actual controller inputs:
- Read from physical gamepad
- Map to Switch protocol
- Send in real-time (132Hz)

## Reference

This implementation ports code from:
- `nxbt/nxbt/controller/protocol.py` - Protocol logic
- `nxbt/nxbt/controller/sdp/switch-controller.xml` - SDP records
- Bumble framework for Bluetooth communication

## License

Ported from nxbt under Apache 2.0 License
