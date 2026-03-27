import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./http/create-app.js";
import { env, corsOriginList } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { hydrateOrderBookFromDb } from "./services/orderbook/orderbook.service.js";
import { startMarketEventIndexer } from "./services/blockchain/event-indexer.service.js";
import { marketBus } from "./realtime/market-bus.js";

async function main(): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: corsOriginList(), methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    socket.on("market:subscribe", (marketId: string) => {
      if (typeof marketId === "string" && marketId.length > 0) {
        socket.join(`market:${marketId}`);
      }
    });
    socket.on("market:unsubscribe", (marketId: string) => {
      if (typeof marketId === "string") {
        socket.leave(`market:${marketId}`);
      }
    });
  });

  marketBus.on("orderbook:updated", (p) => {
    io.to(`market:${p.marketId}`).emit("orderbook:updated", p);
  });
  marketBus.on("trade", (p) => {
    io.to(`market:${p.marketId}`).emit("trade", p);
  });

  await hydrateOrderBookFromDb();
  const stopIndexer = startMarketEventIndexer();

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, apiPrefix: env.API_PREFIX }, "server listening");
  });

  const shutdown = (): void => {
    stopIndexer();
    io.close();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  logger.fatal({ err: e }, "failed to start");
  process.exit(1);
});
