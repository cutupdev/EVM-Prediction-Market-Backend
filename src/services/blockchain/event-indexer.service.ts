import type { Contract, EventLog } from "ethers";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { readOnlyMarketContract } from "./prediction-market.chain.js";

/**
 * Subscribes to on-chain logs and mirrors them into `ChainEvent` + `Market` rows.
 * Run alongside the API; for high volume, prefer a dedicated indexer or subgraph.
 */
export function startMarketEventIndexer(): () => void {
  const c: Contract = readOnlyMarketContract();
  const chainId = env.CHAIN_ID;

  const onMarketCreated = async (
    marketId: string,
    question: string,
    outcomeCount: bigint,
    endTime: bigint,
    ev: EventLog,
  ) => {
    try {
      await prisma.chainEvent.upsert({
        where: {
          chainId_txHash_logIndex: {
            chainId,
            txHash: ev.transactionHash,
            logIndex: ev.index,
          },
        },
        create: {
          chainId,
          blockNumber: BigInt(ev.blockNumber),
          txHash: ev.transactionHash,
          logIndex: ev.index,
          eventName: "MarketCreated",
          payloadJson: JSON.stringify({ marketId, question, outcomeCount: outcomeCount.toString(), endTime: endTime.toString() }),
        },
        update: {},
      });

      await prisma.market.upsert({
        where: {
          chainId_contractAddress_onChainMarketId: {
            chainId,
            contractAddress: predictionMarketAddressLower(),
            onChainMarketId: marketId.toLowerCase(),
          },
        },
        create: {
          chainId,
          contractAddress: predictionMarketAddressLower(),
          onChainMarketId: marketId.toLowerCase(),
          question,
          outcomeCount: Number(outcomeCount),
          resolved: false,
          metadataJson: JSON.stringify({ endTime: endTime.toString() }),
        },
        update: {
          question,
          outcomeCount: Number(outcomeCount),
          metadataJson: JSON.stringify({ endTime: endTime.toString() }),
        },
      });
    } catch (e) {
      logger.error({ err: e }, "MarketCreated handler failed");
    }
  };

  const onMarketResolved = async (marketId: string, winningOutcome: bigint, ev: EventLog) => {
    try {
      await prisma.chainEvent.upsert({
        where: {
          chainId_txHash_logIndex: {
            chainId,
            txHash: ev.transactionHash,
            logIndex: ev.index,
          },
        },
        create: {
          chainId,
          blockNumber: BigInt(ev.blockNumber),
          txHash: ev.transactionHash,
          logIndex: ev.index,
          eventName: "MarketResolved",
          payloadJson: JSON.stringify({ marketId, winningOutcome: winningOutcome.toString() }),
        },
        update: {},
      });

      await prisma.market.updateMany({
        where: {
          chainId,
          contractAddress: predictionMarketAddressLower(),
          onChainMarketId: marketId.toLowerCase(),
        },
        data: {
          resolved: true,
          winningOutcome: Number(winningOutcome),
        },
      });
    } catch (e) {
      logger.error({ err: e }, "MarketResolved handler failed");
    }
  };

  c.on("MarketCreated", onMarketCreated);
  c.on("MarketResolved", onMarketResolved);

  return () => {
    c.removeAllListeners();
  };
}

function predictionMarketAddressLower(): string {
  return env.PREDICTION_MARKET_ADDRESS.toLowerCase();
}
