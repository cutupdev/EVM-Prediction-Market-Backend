import type { NextFunction, Request, Response } from "express";
import { isHttpError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isHttpError(err)) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal Server Error" });
}
