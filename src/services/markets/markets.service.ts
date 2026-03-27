import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { fetchMarketOnChain, predictionMarketAddress } from "../blockchain/prediction-market.chain.js";

export async function listMarkets(opts: { resolved?: boolean; take?: number; skip?: number }) {
  const where = opts.resolved === undefined ? {} : { resolved: opts.resolved };
  const [items, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    }),
    prisma.market.count({ where }),
  ]);
  return { items, total };
}

export async function getMarketById(id: string) {
  const m = await prisma.market.findUnique({ where: { id } });
  if (!m) throw new HttpError(404, "Market not found");
  return m;
}

export type RegisterMarketInput = {
  question: string;
  description?: string;
  onChainMarketId: string;
  outcomeCount: number;
};

/**
 * Registers a market row for UI/orderbook. Prefer letting the event indexer create rows from `MarketCreated`.
 */
export async function registerMarket(input: RegisterMarketInput) {
  const hex = normalizeBytes32(input.onChainMarketId);
  return prisma.market.upsert({
    where: {
      chainId_contractAddress_onChainMarketId: {
        chainId: env.CHAIN_ID,
        contractAddress: predictionMarketAddress().toLowerCase(),
        onChainMarketId: hex,
      },
    },
    create: {
      chainId: env.CHAIN_ID,
      contractAddress: predictionMarketAddress().toLowerCase(),
      onChainMarketId: hex,
      question: input.question,
      description: input.description,
      outcomeCount: input.outcomeCount,
    },
    update: {
      question: input.question,
      description: input.description,
      outcomeCount: input.outcomeCount,
    },
  });
}

export async function getOnChainMarketSnapshot(onChainMarketId: string) {
  const hex = normalizeBytes32(onChainMarketId);
  const v = await fetchMarketOnChain(hex);
  return {
    outcomeCount: v.outcomeCount.toString(),
    resolved: v.resolved,
    winningOutcome: v.winningOutcome.toString(),
    endTime: v.endTime.toString(),
  };
}

function normalizeBytes32(id: string): string {
  const s = id.trim().toLowerCase();
  if (!/^0x([a-f0-9]{64})$/.test(s)) {
    throw new HttpError(400, "onChainMarketId must be 0x-prefixed 32-byte hex");
  }
  return s;
}
