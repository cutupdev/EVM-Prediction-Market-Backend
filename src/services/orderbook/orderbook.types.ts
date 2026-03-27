import type { OrderSide } from "@prisma/client";

export type RestingOrder = {
  id: string;
  marketId: string;
  makerAddress: string;
  outcomeIndex: number;
  side: OrderSide;
  priceBps: number;
  sizeRemaining: bigint;
  createdAt: number;
};

export type MatchTrade = {
  marketId: string;
  outcomeIndex: number;
  priceBps: number;
  sizeRaw: bigint;
  makerOrderId: string;
  takerOrderId: string;
};

export type MatchResult = {
  trades: MatchTrade[];
  /// Remaining size on the aggressive (incoming) order after matching
  takerRemaining: bigint;
};
