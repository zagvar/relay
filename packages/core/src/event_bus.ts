import type { MarketEventChannel, RelayMessage } from "./event_channel.js";

/** Handles messages published through a Relay event bus. */
export type RelayMessageHandler<TChannel extends MarketEventChannel = MarketEventChannel> = (
  message: RelayMessage<TChannel>,
) => void | Promise<void>;

/** Stops an active event bus subscription. */
export type Unsubscribe = () => Promise<void>;

/** Provider-neutral publish/subscribe contract for Relay messages. */
export interface RelayEventBus {
  publish<TChannel extends MarketEventChannel>(message: RelayMessage<TChannel>): Promise<void>;

  subscribe<TChannel extends MarketEventChannel>(
    channel: TChannel,
    handler: RelayMessageHandler<TChannel>,
  ): Promise<Unsubscribe>;
}

/** In-memory event bus for tests, examples, and single-process demos. */
export class MemoryRelayEventBus implements RelayEventBus {
  readonly #handlersByChannel = new Map<MarketEventChannel, Set<RelayMessageHandler>>();

  async publish<TChannel extends MarketEventChannel>(
    message: RelayMessage<TChannel>,
  ): Promise<void> {
    const handlers = this.#handlersByChannel.get(message.channel);

    if (handlers === undefined) {
      return;
    }

    await Promise.all([...handlers].map((handler) => Promise.resolve(handler(message))));
  }

  subscribe<TChannel extends MarketEventChannel>(
    channel: TChannel,
    handler: RelayMessageHandler<TChannel>,
  ): Promise<Unsubscribe> {
    const handlers = this.#handlersByChannel.get(channel) ?? new Set();

    handlers.add(handler as RelayMessageHandler);
    this.#handlersByChannel.set(channel, handlers);

    return Promise.resolve(() => {
      handlers.delete(handler as RelayMessageHandler);

      if (handlers.size === 0) {
        this.#handlersByChannel.delete(channel);
      }

      return Promise.resolve();
    });
  }
}
