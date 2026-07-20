import { describe, expect, it } from "vitest";
import { RelaySocketBackpressureError, sendJson, type RelaySocket } from "../src/socket.js";

class FakeSocket implements RelaySocket {
  bufferedAmount = 0;
  readonly messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }

  closed = false;

  close(): void {
    this.closed = true;
  }
}

describe("sendJson", () => {
  it("sends JSON while below the buffer limit", async () => {
    const socket = new FakeSocket();

    await sendJson(socket, { ok: true }, { maxBufferedBytes: 100 });

    expect(socket.messages).toEqual([JSON.stringify({ ok: true })]);
  });

  it("rejects sends that would exceed the buffer limit", async () => {
    const socket = new FakeSocket();
    socket.bufferedAmount = 9;

    await expect(sendJson(socket, {}, { maxBufferedBytes: 10 })).rejects.toBeInstanceOf(
      RelaySocketBackpressureError,
    );

    expect(socket.messages).toEqual([]);
  });

  it("rejects a message larger than the buffer limit", async () => {
    const socket = new FakeSocket();

    await expect(
      sendJson(socket, { value: "too large" }, { maxBufferedBytes: 5 }),
    ).rejects.toBeInstanceOf(RelaySocketBackpressureError);

    expect(socket.messages).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid maxBufferedBytes %s",
    async (maxBufferedBytes) => {
      const socket = new FakeSocket();

      await expect(sendJson(socket, {}, { maxBufferedBytes })).rejects.toThrow(RangeError);
    },
  );
});
