import { OrderSide } from "@prisma/client";
import type { MatchResult, MatchTrade, RestingOrder } from "./orderbook.types.js";

function bookKey(marketId: string, outcomeIndex: number): string {
  return `${marketId}:${outcomeIndex}`;
}

/**
 * In-memory price-time priority CLOB per (market, outcome).
 * BUY side rests as bids (higher price first); SELL side as asks (lower price first).
 */
export class OrderBookEngine {
  private readonly bids = new Map<string, RestingOrder[]>();
  private readonly asks = new Map<string, RestingOrder[]>();

  clear(): void {
    this.bids.clear();
    this.asks.clear();
  }

  hydrate(order: RestingOrder): void {
    if (order.sizeRemaining <= 0n) return;
    const key = bookKey(order.marketId, order.outcomeIndex);
    if (order.side === OrderSide.BUY) {
      const arr = this.bids.get(key) ?? [];
      arr.push(order);
      arr.sort((a, b) => b.priceBps - a.priceBps || a.createdAt - b.createdAt);
      this.bids.set(key, arr);
    } else {
      const arr = this.asks.get(key) ?? [];
      arr.push(order);
      arr.sort((a, b) => a.priceBps - b.priceBps || a.createdAt - b.createdAt);
      this.asks.set(key, arr);
    }
  }

  removeOrder(marketId: string, outcomeIndex: number, orderId: string): void {
    const bk = bookKey(marketId, outcomeIndex);
    const strip = (m: Map<string, RestingOrder[]>) => {
      const arr = m.get(bk);
      if (!arr) return;
      m.set(
        bk,
        arr.filter((o) => o.id !== orderId),
      );
    };
    strip(this.bids);
    strip(this.asks);
  }

  snapshot(marketId: string, outcomeIndex: number): { bids: RestingOrder[]; asks: RestingOrder[] } {
    const bk = bookKey(marketId, outcomeIndex);
    return {
      bids: [...(this.bids.get(bk) ?? [])],
      asks: [...(this.asks.get(bk) ?? [])],
    };
  }

  /**
   * Match aggressive `taker` against the opposite book; resting remainder is inserted.
   */
  match(taker: RestingOrder): MatchResult {
    const trades: MatchTrade[] = [];
    let remaining = taker.sizeRemaining;
    const key = bookKey(taker.marketId, taker.outcomeIndex);

    if (taker.side === OrderSide.BUY) {
      const askList = this.asks.get(key) ?? [];
      while (remaining > 0n && askList.length > 0) {
        const best = askList[0];
        if (best.priceBps > taker.priceBps) break;
        const tradeSize = remaining < best.sizeRemaining ? remaining : best.sizeRemaining;
        trades.push({
          marketId: taker.marketId,
          outcomeIndex: taker.outcomeIndex,
          priceBps: best.priceBps,
          sizeRaw: tradeSize,
          makerOrderId: best.id,
          takerOrderId: taker.id,
        });
        remaining -= tradeSize;
        best.sizeRemaining -= tradeSize;
        if (best.sizeRemaining === 0n) askList.shift();
      }
      this.asks.set(key, askList);
      if (remaining > 0n) {
        this.insertBid({
          ...taker,
          sizeRemaining: remaining,
        });
      }
    } else {
      const bidList = this.bids.get(key) ?? [];
      while (remaining > 0n && bidList.length > 0) {
        const best = bidList[0];
        if (best.priceBps < taker.priceBps) break;
        const tradeSize = remaining < best.sizeRemaining ? remaining : best.sizeRemaining;
        trades.push({
          marketId: taker.marketId,
          outcomeIndex: taker.outcomeIndex,
          priceBps: best.priceBps,
          sizeRaw: tradeSize,
          makerOrderId: best.id,
          takerOrderId: taker.id,
        });
        remaining -= tradeSize;
        best.sizeRemaining -= tradeSize;
        if (best.sizeRemaining === 0n) bidList.shift();
      }
      this.bids.set(key, bidList);
      if (remaining > 0n) {
        this.insertAsk({
          ...taker,
          sizeRemaining: remaining,
        });
      }
    }

    return { trades, takerRemaining: remaining };
  }

  private insertBid(o: RestingOrder): void {
    const key = bookKey(o.marketId, o.outcomeIndex);
    const arr = this.bids.get(key) ?? [];
    arr.push(o);
    arr.sort((a, b) => b.priceBps - a.priceBps || a.createdAt - b.createdAt);
    this.bids.set(key, arr);
  }

  private insertAsk(o: RestingOrder): void {
    const key = bookKey(o.marketId, o.outcomeIndex);
    const arr = this.asks.get(key) ?? [];
    arr.push(o);
    arr.sort((a, b) => a.priceBps - b.priceBps || a.createdAt - b.createdAt);
    this.asks.set(key, arr);
  }
}
