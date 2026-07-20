/** Minimal socket contract used by Relay WebSocket sessions. */
export interface RelaySocket {
  /** Bytes currently queued by the underlying transport. */
  readonly bufferedAmount: number;

  send(message: string): void | Promise<void>;

  close(code?: number, reason?: string): void | Promise<void>;
}

/** Options controlling one JSON socket send. */
export interface SendJsonOptions {
  readonly maxBufferedBytes?: number;
}

/** Raised when a socket would exceed its configured outbound buffer. */
export class RelaySocketBackpressureError extends Error {
  readonly bufferedBytes: number;
  readonly messageBytes: number;
  readonly maxBufferedBytes: number;

  constructor(bufferedBytes: number, messageBytes: number, maxBufferedBytes: number) {
    super(`Relay socket outbound buffer would exceed ${String(maxBufferedBytes)} bytes.`);

    this.name = "RelaySocketBackpressureError";
    this.bufferedBytes = bufferedBytes;
    this.messageBytes = messageBytes;
    this.maxBufferedBytes = maxBufferedBytes;
  }
}

/** Sends a JSON-encoded payload through a Relay socket. */
export async function sendJson(
  socket: RelaySocket,
  payload: unknown,
  options: SendJsonOptions = {},
): Promise<void> {
  const message = JSON.stringify(payload);
  const messageBytes = Buffer.byteLength(message, "utf8");
  const maxBufferedBytes = options.maxBufferedBytes;

  if (
    maxBufferedBytes !== undefined &&
    (!Number.isSafeInteger(maxBufferedBytes) || maxBufferedBytes <= 0)
  ) {
    throw new RangeError("maxBufferedBytes must be a positive safe integer.");
  }

  if (
    maxBufferedBytes !== undefined &&
    (messageBytes > maxBufferedBytes || socket.bufferedAmount > maxBufferedBytes - messageBytes)
  ) {
    throw new RelaySocketBackpressureError(socket.bufferedAmount, messageBytes, maxBufferedBytes);
  }

  await Promise.resolve(socket.send(message));
}
