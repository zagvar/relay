import type { MarketEventChannel, RelayMessage } from "./event_channel.js";

/** Handles messages published through a Relay event bus. */
export type RelayMessageHandler<TData = unknown> = (
  message: RelayMessage<TData>,
) => void | Promise<void>;

/** Stops an active event bus subscription. */
export type Unsubscribe = () => void;

/** Provider-neutral publish/subscribe contract for Relay messages. */
export interface RelayEventBus {
  /** Publishes a message to subscribers of its channel. */
  publish<TData>(message: RelayMessage<TData>): Promise<void>;

  /** Subscribes to messages for one channel. */
  subscribe<TData>(channel: MarketEventChannel, handler: RelayMessageHandler<TData>): Unsubscribe;
}

/** In-memory event bus for tests, examples, and single-process demos. */
export class MemoryRelayEventBus implements RelayEventBus {
  readonly #handlersByChannel = new Map<MarketEventChannel, Set<RelayMessageHandler>>();

  async publish<TData>(message: RelayMessage<TData>): Promise<void> {
    const handlers = this.#handlersByChannel.get(message.channel);

    if (handlers === undefined) {
      return;
    }

    await Promise.all(
      [...handlers].map((handler) => Promise.resolve(handler(message as RelayMessage<unknown>))),
    );
  }

  subscribe<TData>(channel: MarketEventChannel, handler: RelayMessageHandler<TData>): Unsubscribe {
    const handlers = this.#handlersByChannel.get(channel) ?? new Set();

    handlers.add(handler as RelayMessageHandler);
    this.#handlersByChannel.set(channel, handlers);

    return () => {
      handlers.delete(handler as RelayMessageHandler);

      if (handlers.size === 0) {
        this.#handlersByChannel.delete(channel);
      }
    };
  }
}
