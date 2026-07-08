import type {
  MarketEventChannel,
  RelayEventBus,
  RelayMessage,
  RelayMessageHandler,
  Unsubscribe,
} from "@zagvar/relay-core";
import { RelayRedisKeys, type RelayRedisKeyOptions } from "./redis_keys.js";
import type {
  RedisMessageHandler,
  RedisPublishClient,
  RedisSubscribeClient,
} from "./redis_client.js";

/** Options for RedisRelayEventBus. */
export interface RedisRelayEventBusOptions extends RelayRedisKeyOptions {
  readonly publisher: RedisPublishClient;
  readonly subscriber: RedisSubscribeClient;
}

/** Redis Pub/Sub implementation of Relay's event bus contract. */
export class RedisRelayEventBus implements RelayEventBus {
  readonly #publisher: RedisPublishClient;
  readonly #subscriber: RedisSubscribeClient;
  readonly #keys: RelayRedisKeys;
  readonly #handlersByChannel = new Map<MarketEventChannel, Set<RedisMessageHandler>>();

  constructor(options: RedisRelayEventBusOptions) {
    this.#publisher = options.publisher;
    this.#subscriber = options.subscriber;
    this.#keys =
      options.prefix === undefined
        ? new RelayRedisKeys()
        : new RelayRedisKeys({ prefix: options.prefix });
  }

  async publish<TData>(message: RelayMessage<TData>): Promise<void> {
    await this.#publisher.publish(
      this.#keys.eventChannel(message.channel),
      JSON.stringify(message),
    );
  }

  async subscribe<TData>(
    channel: MarketEventChannel,
    handler: RelayMessageHandler<TData>,
  ): Promise<Unsubscribe> {
    const redisChannel = this.#keys.eventChannel(channel);

    const redisHandler: RedisMessageHandler = async (rawMessage) => {
      const message = JSON.parse(rawMessage) as RelayMessage<TData>;
      await Promise.resolve(handler(message));
    };

    const handlers = this.#handlersByChannel.get(channel) ?? new Set<RedisMessageHandler>();

    handlers.add(redisHandler);
    this.#handlersByChannel.set(channel, handlers);

    await this.#subscriber.subscribe(redisChannel, redisHandler);

    return () => {
      handlers.delete(redisHandler);

      if (handlers.size === 0) {
        this.#handlersByChannel.delete(channel);
      }

      return this.#subscriber.unsubscribe(redisChannel, redisHandler);
    };
  }
}
