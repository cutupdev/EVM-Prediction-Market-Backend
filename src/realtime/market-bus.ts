import { EventEmitter } from "node:events";

export type OrderBookDelta = {
  marketId: string;
  outcomeIndex: number;
};

export type TradeEmitted = {
  marketId: string;
  outcomeIndex: number;
  priceBps: number;
  sizeRaw: string;
  makerOrderId: string;
  takerOrderId: string;
};

class MarketBus extends EventEmitter {
  emitOrderBookUpdated(payload: OrderBookDelta): boolean {
    return this.emit("orderbook:updated", payload);
  }

  emitTrade(payload: TradeEmitted): boolean {
    return this.emit("trade", payload);
  }
}

export const marketBus = new MarketBus();
