import type {
  RedisMessageHandler,
  RedisPublishClient,
  RedisSubscribeClient,
} from "../src/redis_client.js";

/** In-memory Redis-like Pub/Sub client for unit tests. */
export class FakeRedisPubSubClient implements RedisPublishClient, RedisSubscribeClient {
  readonly #handlersByChannel = new Map<string, Set<RedisMessageHandler>>();

  publish(channel: string, message: string): Promise<number> {
    const handlers = this.#handlersByChannel.get(channel);

    if (handlers === undefined) {
      return Promise.resolve(0);
    }

    for (const handler of handlers) {
      void Promise.resolve(handler(message));
    }

    return Promise.resolve(handlers.size);
  }

  subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    const handlers = this.#handlersByChannel.get(channel) ?? new Set<RedisMessageHandler>();

    handlers.add(handler);
    this.#handlersByChannel.set(channel, handlers);

    return Promise.resolve();
  }

  unsubscribe(channel: string, handler?: RedisMessageHandler): Promise<void> {
    if (handler === undefined) {
      this.#handlersByChannel.delete(channel);
      return Promise.resolve();
    }

    const handlers = this.#handlersByChannel.get(channel);

    if (handlers === undefined) {
      return Promise.resolve();
    }

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.#handlersByChannel.delete(channel);
    }

    return Promise.resolve();
  }
}
