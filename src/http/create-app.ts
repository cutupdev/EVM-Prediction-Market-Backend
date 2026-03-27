import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env, corsOriginList } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { errorHandler } from "../api/middleware/error-handler.js";
import { healthRouter } from "../api/routes/health.routes.js";
import { marketsRouter } from "../api/routes/markets.routes.js";
import { ordersRouter } from "../api/routes/orders.routes.js";
import { txRouter } from "../api/routes/tx.routes.js";
import { configRouter } from "../api/routes/config.routes.js";
import { usersRouter } from "../api/routes/users.routes.js";

export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOriginList(), credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(pinoHttp({ logger }));

  const prefix = env.API_PREFIX;
  app.use(healthRouter);
  app.use(`${prefix}/markets`, marketsRouter);
  app.use(`${prefix}/orders`, ordersRouter);
  app.use(`${prefix}/users`, usersRouter);
  app.use(`${prefix}/tx`, txRouter);
  app.use(`${prefix}/config`, configRouter);

  app.use(errorHandler);
  return app;
}
