from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MotorRumble:
    """Decoded rumble for a single motor (HD-style linear actuator)."""

    frequency_hz: float
    amplitude: float

    @property
    def active(self) -> bool:
        return self.amplitude > 0.0


@dataclass(frozen=True, slots=True)
class RumbleData:
    """Decoded rumble for both motors of a controller."""

    left: MotorRumble
    right: MotorRumble

    @property
    def active(self) -> bool:
        return self.left.active or self.right.active


def _decode_motor(b0: int, b1: int, b2: int, b3: int) -> MotorRumble:
    """Decode one 4-byte TRU motor word into (frequency_hz, amplitude).

    The Switch encodes each motor redundantly across an HF channel
    (bytes 0-1) and an LF channel (bytes 2-3). Both encode the same
    (freq, amp) pair via a shared ``encoded_hex_freq`` / ``encoded_hex_amp``
    variable, as documented in dekuNukem's rumble_data_table.md:

        encoded_hex_freq = round(log2(freq/10) * 32)
        encoded_hex_amp  = round(log2(amp * 8.7) * 32)   # amp >= ~0.23
                         = round(log2(amp * 17)  * 16)   # ~0.12 <= amp < ~0.23

    We invert these to recover Hz and a 0..1 amplitude.
    """
    # --- frequency ---
    # LF byte (b2) holds a 7-bit frequency index when in range
    # (covers ~41 Hz .. ~626 Hz). Above that, fall back to the HF
    # channel (b0 + the low bit of b1) which covers up to ~1253 Hz.
    lf = b2 & 0x7F
    if lf != 0:
        encoded_freq = lf + 0x40
    else:
        hf = b0 | ((b1 & 0x01) << 8)
        encoded_freq = (hf // 4) + 0x60
    frequency_hz = 10.0 * (2.0 ** (encoded_freq / 32.0))

    # --- amplitude ---
    # The HF amplitude byte (b1) carries ``encoded_hex_amp * 2`` plus
    # the HF frequency high bit in its LSB. Integer-dividing by two
    # recovers encoded_hex_amp regardless of the freq high bit.
    encoded_amp = b1 // 2
    if encoded_amp >= 32:
        amplitude = (2.0 ** (encoded_amp / 32.0)) / 8.7
    elif encoded_amp >= 16:
        amplitude = (2.0 ** (encoded_amp / 16.0)) / 17.0
    else:
        amplitude = 0.0

    return MotorRumble(frequency_hz, amplitude)


def parse_rumble(packet: bytes) -> RumbleData | None:
    """Extract and decode the 8-byte rumble field from a Switch output
    report received on the HID interrupt channel.

    In a subcommand-bearing output report the rumble field occupies the
    8 bytes immediately preceding the subcommand id (which sits at
    ``packet[11]`` per the existing SwitchReportParser framing), i.e.
    ``packet[3:11]``. Short rumble-only reports carry the field at
    ``packet[2:10]``.
    """
    if len(packet) >= 11:
        chunk = packet[3:11]
    elif len(packet) >= 10:
        chunk = packet[2:10]
    else:
        return None

    left = _decode_motor(chunk[0], chunk[1], chunk[2], chunk[3])
    right = _decode_motor(chunk[4], chunk[5], chunk[6], chunk[7])
    return RumbleData(left, right)
