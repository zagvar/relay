import { config } from "dotenv";
import { createAlpacaNodeWsStockClient } from "../dist/index.js";

config({ path: "../../.env" });

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}

async function main() {
  const keyId = process.env.ALPACA_API_KEY_ID;
  const secretKey = process.env.ALPACA_API_SECRET_KEY;
  const feed = process.env.ALPACA_STOCK_FEED ?? "test";
  const symbol = process.env.ALPACA_STOCK_SYMBOL ?? "FAKEPACA";
  const baseUrl = process.env.ALPACA_STOCK_STREAM_BASE_URL;

  if (keyId === undefined || keyId.length === 0) {
    throw new Error("Missing ALPACA_API_KEY_ID.");
  }

  if (secretKey === undefined || secretKey.length === 0) {
    throw new Error("Missing ALPACA_API_SECRET_KEY.");
  }

  const receivedEvents = [];

  const connection = createAlpacaNodeWsStockClient({
    feed,
    ...(baseUrl === undefined || baseUrl.length === 0 ? {} : { baseUrl }),
    autoAuthenticate: false,
    credentials: {
      keyId,
      secretKey,
    },
    onMarketEvent: (event) => {
      receivedEvents.push(event);
      console.log("market event", JSON.stringify(event, null, 2));
    },
    onError: (error) => {
      console.error("client error", error);
    },
  });

  connection.websocket.on("open", () => {
    console.log("socket open");
  });

  connection.websocket.on("close", (code, reason) => {
    console.log("socket close", { code, reason: reason.toString("utf8") });
  });

  connection.websocket.on("error", (error) => {
    console.error("socket error", error);
  });

  console.log("waiting for socket open");
  await waitForOpen(connection.websocket);

  console.log("authenticating");
  await connection.client.authenticate();

  await waitForAlpacaMessage(connection.websocket, (message) => {
    return message.T === "success" && message.msg === "authenticated";
  });

  console.log("connecting", {
    feed,
    symbol,
    baseUrl: baseUrl === undefined || baseUrl.length === 0 ? "(default)" : baseUrl,
  });

  console.log("authenticated; subscribing");
  await connection.client.subscribe({
    trades: [symbol],
    quotes: [symbol],
    bars: [symbol],
  });

  await wait(15_000);
  await connection.close();

  if (receivedEvents.length === 0) {
    throw new Error("No market events received.");
  }

  console.log(`Received ${String(receivedEvents.length)} market event(s).`);
}

function waitForOpen(websocket) {
  if (websocket.readyState === websocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket to open."));
    }, 10_000);

    function cleanup() {
      clearTimeout(timeout);
      websocket.off("open", onOpen);
      websocket.off("error", onError);
      websocket.off("close", onClose);
    }

    function onOpen() {
      cleanup();
      resolve();
    }

    function onError(error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(`Websocket error: ${String(error)}`));
    }

    function onClose(code, reason) {
      cleanup();
      reject(new Error(`Websocket closed before open: ${String(code)} ${reason.toString("utf8")}`));
    }

    websocket.once("open", onOpen);
    websocket.once("error", onError);
    websocket.once("close", onClose);
  });
}

function waitForAlpacaMessage(websocket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for Alpaca websocket message."));
    }, 10_000);

    function cleanup() {
      clearTimeout(timeout);
      websocket.off("message", onMessage);
      websocket.off("error", onError);
      websocket.off("close", onClose);
    }

    function onMessage(data) {
      const messages = JSON.parse(data.toString("utf8"));

      if (!Array.isArray(messages)) {
        return;
      }

      const errorMessage = messages.find((message) => {
        return typeof message === "object" && message !== null && message.T === "error";
      });

      if (errorMessage !== undefined) {
        cleanup();
        reject(new Error(`Alpaca error: ${JSON.stringify(errorMessage)}`));
        return;
      }

      const matchedMessage = messages.find((message) => {
        return typeof message === "object" && message !== null && predicate(message);
      });

      if (matchedMessage === undefined) {
        return;
      }

      cleanup();
      resolve(matchedMessage);
    }

    function onError(error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(`Websocket error: ${String(error)}`));
    }

    function onClose(code, reason) {
      cleanup();
      reject(new Error(`Websocket closed: ${String(code)} ${reason.toString("utf8")}`));
    }

    websocket.on("message", onMessage);
    websocket.once("error", onError);
    websocket.once("close", onClose);
  });
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
