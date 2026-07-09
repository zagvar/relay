/** Minimal socket contract used by Relay WebSocket sessions. */
export interface RelaySocket {
  send(message: string): void | Promise<void>;
}

/** Sends a JSON-encoded payload through a Relay socket. */
export async function sendJson(socket: RelaySocket, payload: unknown): Promise<void> {
  await Promise.resolve(socket.send(JSON.stringify(payload)));
}
