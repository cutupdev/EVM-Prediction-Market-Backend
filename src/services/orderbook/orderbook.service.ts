import { OrderSide, OrderStatus, type Order } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { marketBus } from "../../realtime/market-bus.js";
import { OrderBookEngine } from "./orderbook.engine.js";
import type { RestingOrder } from "./orderbook.types.js";
import { verifyOrderSignature, type OrderMessage } from "../signing/eip712-order.js";

const engine = new OrderBookEngine();

export async function hydrateOrderBookFromDb(): Promise<void> {
  engine.clear();
  const open = await prisma.order.findMany({
    where: { status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] } },
    orderBy: { createdAt: "asc" },
  });
  for (const o of open) {
    const rem = BigInt(o.sizeRaw) - BigInt(o.filledRaw);
    if (rem <= 0n) continue;
    engine.hydrate(toResting(o, rem));
  }
}

function toResting(o: Order, sizeRemaining: bigint): RestingOrder {
  return {
    id: o.id,
    marketId: o.marketId,
    makerAddress: o.makerAddress,
    outcomeIndex: o.outcomeIndex,
    side: o.side,
    priceBps: o.priceBps,
    sizeRemaining,
    createdAt: o.createdAt.getTime(),
  };
}

export function getOrderBookSnapshot(marketId: string, outcomeIndex: number) {
  return engine.snapshot(marketId, outcomeIndex);
}

export type PlaceOrderParams = {
  marketId: string;
  makerAddress: string;
  outcomeIndex: number;
  side: OrderSide;
  priceBps: number;
  sizeRaw: string;
  signature?: string;
  chainNonce?: string;
  requireSignature: boolean;
};

export async function placeOrder(params: PlaceOrderParams): Promise<{ order: Order; tradesCreated: number }> {
  if (params.priceBps < 1 || params.priceBps > 10_000) {
    throw new HttpError(400, "priceBps must be between 1 and 10000");
  }
  let size: bigint;
  try {
    size = BigInt(params.sizeRaw);
  } catch {
    throw new HttpError(400, "sizeRaw must be an integer string");
  }
  if (size <= 0n) throw new HttpError(400, "size must be positive");

  const market = await prisma.market.findUnique({ where: { id: params.marketId } });
  if (!market) throw new HttpError(404, "Market not found");
  if (market.resolved) throw new HttpError(400, "Market already resolved");
  if (params.outcomeIndex < 0 || params.outcomeIndex >= market.outcomeCount) {
    throw new HttpError(400, "Invalid outcomeIndex");
  }

  if (params.requireSignature) {
    if (!params.signature || !params.chainNonce) {
      throw new HttpError(400, "signature and chainNonce required when requireSignature is true");
    }
    const nonce = BigInt(params.chainNonce);
    const msg: OrderMessage = {
      marketId: params.marketId,
      onChainMarketId: market.onChainMarketId,
      outcomeIndex: BigInt(params.outcomeIndex),
      side: params.side === OrderSide.BUY ? 0 : 1,
      priceBps: BigInt(params.priceBps),
      sizeRaw: size,
      nonce,
    };
    if (!verifyOrderSignature(params.makerAddress, msg, params.signature)) {
      throw new HttpError(401, "Invalid order signature");
    }
  }

  const user = await prisma.user.upsert({
    where: { address: params.makerAddress.toLowerCase() },
    create: { address: params.makerAddress.toLowerCase() },
    update: {},
  });

  const created = await prisma.order.create({
    data: {
      marketId: params.marketId,
      userId: user.id,
      makerAddress: params.makerAddress.toLowerCase(),
      outcomeIndex: params.outcomeIndex,
      side: params.side,
      priceBps: params.priceBps,
      sizeRaw: params.sizeRaw,
      filledRaw: "0",
      status: OrderStatus.OPEN,
      signature: params.signature,
      chainNonce: params.chainNonce,
    },
  });

  const taker: RestingOrder = {
    id: created.id,
    marketId: created.marketId,
    makerAddress: created.makerAddress,
    outcomeIndex: created.outcomeIndex,
    side: created.side,
    priceBps: created.priceBps,
    sizeRemaining: size,
    createdAt: created.createdAt.getTime(),
  };

  const { trades, takerRemaining } = engine.match(taker);

  if (trades.length === 0) {
    marketBus.emitOrderBookUpdated({ marketId: params.marketId, outcomeIndex: params.outcomeIndex });
    return { order: created, tradesCreated: 0 };
  }

  let takerFilled = 0n;
  for (const tr of trades) takerFilled += tr.sizeRaw;

  const takerStatus =
    takerRemaining === 0n ? OrderStatus.FILLED : takerFilled > 0n ? OrderStatus.PARTIALLY_FILLED : OrderStatus.OPEN;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: created.id },
      data: {
        filledRaw: takerFilled.toString(),
        status: takerStatus,
      },
    });

    for (const tr of trades) {
      await tx.trade.create({
        data: {
          marketId: tr.marketId,
          outcomeIndex: tr.outcomeIndex,
          priceBps: tr.priceBps,
          sizeRaw: tr.sizeRaw.toString(),
          makerOrderId: tr.makerOrderId,
          takerOrderId: tr.takerOrderId,
        },
      });

      const maker = await tx.order.findUniqueOrThrow({ where: { id: tr.makerOrderId } });
      const makerFilled = BigInt(maker.filledRaw) + tr.sizeRaw;
      const makerSize = BigInt(maker.sizeRaw);
      const makerStatus =
        makerFilled >= makerSize ? OrderStatus.FILLED : makerFilled > 0n ? OrderStatus.PARTIALLY_FILLED : OrderStatus.OPEN;
      await tx.order.update({
        where: { id: tr.makerOrderId },
        data: {
          filledRaw: makerFilled.toString(),
          status: makerStatus,
        },
      });
    }
  });

  for (const tr of trades) {
    marketBus.emitTrade({
      marketId: tr.marketId,
      outcomeIndex: tr.outcomeIndex,
      priceBps: tr.priceBps,
      sizeRaw: tr.sizeRaw.toString(),
      makerOrderId: tr.makerOrderId,
      takerOrderId: tr.takerOrderId,
    });
  }

  marketBus.emitOrderBookUpdated({ marketId: params.marketId, outcomeIndex: params.outcomeIndex });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
  return { order: updated, tradesCreated: trades.length };
}

export async function cancelOrder(orderId: string, requester: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.makerAddress.toLowerCase() !== requester.toLowerCase()) {
    throw new HttpError(403, "Not order owner");
  }
  if (order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED) {
    throw new HttpError(400, "Order cannot be cancelled");
  }

  engine.removeOrder(order.marketId, order.outcomeIndex, order.id);

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  });

  marketBus.emitOrderBookUpdated({ marketId: order.marketId, outcomeIndex: order.outcomeIndex });
  return updated;
}
