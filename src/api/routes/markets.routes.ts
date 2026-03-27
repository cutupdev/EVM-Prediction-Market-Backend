import { Router } from "express";
import { z } from "zod";
import { OrderSide } from "@prisma/client";
import { validateBody } from "../middleware/validate-body.js";
import * as marketsService from "../../services/markets/markets.service.js";
import * as orderbookService from "../../services/orderbook/orderbook.service.js";
import { prisma } from "../../lib/prisma.js";

export const marketsRouter = Router();

const registerSchema = z.object({
  question: z.string().min(1),
  description: z.string().optional(),
  onChainMarketId: z.string(),
  outcomeCount: z.number().int().min(2).max(32),
});

marketsRouter.get("/", async (req, res, next) => {
  try {
    const resolved = req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined;
    const take = req.query.take ? Number(req.query.take) : undefined;
    const skip = req.query.skip ? Number(req.query.skip) : undefined;
    const data = await marketsService.listMarkets({ resolved, take, skip });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

marketsRouter.post("/", validateBody(registerSchema), async (req, res, next) => {
  try {
    const m = await marketsService.registerMarket(req.body);
    res.status(201).json(m);
  } catch (e) {
    next(e);
  }
});

marketsRouter.get("/:marketId", async (req, res, next) => {
  try {
    const m = await marketsService.getMarketById(req.params.marketId);
    res.json(m);
  } catch (e) {
    next(e);
  }
});

marketsRouter.get("/:marketId/chain", async (req, res, next) => {
  try {
    const m = await marketsService.getMarketById(req.params.marketId);
    const snap = await marketsService.getOnChainMarketSnapshot(m.onChainMarketId);
    res.json({ db: m, chain: snap });
  } catch (e) {
    next(e);
  }
});

marketsRouter.get("/:marketId/orderbook", async (req, res, next) => {
  try {
    const outcomeIndex = req.query.outcomeIndex !== undefined ? Number(req.query.outcomeIndex) : 0;
    if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0) {
      res.status(400).json({ error: "outcomeIndex must be a non-negative integer" });
      return;
    }
    await marketsService.getMarketById(req.params.marketId);
    const snap = orderbookService.getOrderBookSnapshot(req.params.marketId, outcomeIndex);
    res.json({
      marketId: req.params.marketId,
      outcomeIndex,
      bids: snap.bids.map(serializeResting),
      asks: snap.asks.map(serializeResting),
    });
  } catch (e) {
    next(e);
  }
});

const placeOrderSchema = z.object({
  makerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  outcomeIndex: z.number().int().min(0),
  side: z.nativeEnum(OrderSide),
  priceBps: z.number().int(),
  sizeRaw: z.string().regex(/^\d+$/),
  signature: z.string().optional(),
  chainNonce: z.string().optional(),
  requireSignature: z.boolean().optional(),
});

marketsRouter.post("/:marketId/orders", validateBody(placeOrderSchema), async (req, res, next) => {
  try {
    const result = await orderbookService.placeOrder({
      marketId: req.params.marketId,
      makerAddress: req.body.makerAddress,
      outcomeIndex: req.body.outcomeIndex,
      side: req.body.side,
      priceBps: req.body.priceBps,
      sizeRaw: req.body.sizeRaw,
      signature: req.body.signature,
      chainNonce: req.body.chainNonce,
      requireSignature: req.body.requireSignature ?? false,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

marketsRouter.get("/:marketId/trades", async (req, res, next) => {
  try {
    await marketsService.getMarketById(req.params.marketId);
    const take = req.query.take ? Math.min(Number(req.query.take), 200) : 50;
    const trades = await prisma.trade.findMany({
      where: { marketId: req.params.marketId },
      orderBy: { createdAt: "desc" },
      take,
    });
    res.json(trades);
  } catch (e) {
    next(e);
  }
});

function serializeResting(o: {
  id: string;
  makerAddress: string;
  outcomeIndex: number;
  side: string;
  priceBps: number;
  sizeRemaining: bigint;
  createdAt: number;
}) {
  return {
    id: o.id,
    makerAddress: o.makerAddress,
    outcomeIndex: o.outcomeIndex,
    side: o.side,
    priceBps: o.priceBps,
    sizeRemaining: o.sizeRemaining.toString(),
    createdAt: o.createdAt,
  };
}
