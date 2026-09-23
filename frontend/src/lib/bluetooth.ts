export type BluetoothStatus = {
  available: boolean;
  pairing: boolean;
  state: "disconnected" | "connecting" | "reconnecting" | "connected";
  address: string | null;
  peers: string[];
  failure_id: number;
  failure: string | null;
};

function isBluetoothStatus(value: unknown): value is BluetoothStatus {
  return typeof value === "object" && value !== null &&
    "available" in value && typeof value.available === "boolean" &&
    "pairing" in value && typeof value.pairing === "boolean" &&
    "state" in value && (value.state === "disconnected" ||
      value.state === "connecting" || value.state === "reconnecting" ||
      value.state === "connected") &&
    "address" in value && (value.address === null || typeof value.address === "string") &&
    "peers" in value && Array.isArray(value.peers) &&
    value.peers.every((peer: unknown) => typeof peer === "string") &&
    "failure_id" in value && Number.isInteger(value.failure_id) &&
    "failure" in value && (value.failure === null || typeof value.failure === "string");
}

export async function requestStatus(init?: RequestInit): Promise<BluetoothStatus> {
  let response: Response;
  try {
    response = await fetch("/api/bluetooth", {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(init?.method ? 35000 : 5000),
    });
  } catch {
    throw new Error("Cannot reach the backend.");
  }
  if (response.status === 404 || response.status === 405) {
    throw new Error("This backend does not support Bluetooth controls.");
  }
  if (response.status === 502 || response.status === 504) {
    throw new Error("The API proxy cannot reach the backend.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Bluetooth status returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null &&
      "error" in body && typeof body.error === "string"
      ? body.error : `Bluetooth request failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  if (!isBluetoothStatus(body)) throw new Error("Invalid Bluetooth status response");
  return body;
}

