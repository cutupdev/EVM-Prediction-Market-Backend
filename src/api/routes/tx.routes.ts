import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate-body.js";
import { env } from "../../config/env.js";
import { encodeBuy, encodeSell, encodeClaim } from "../../services/blockchain/prediction-market.chain.js";

export const txRouter = Router();

const buySchema = z.object({
  marketIdHex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  outcomeIndex: z.string().regex(/^\d+$/),
  minShares: z.string().regex(/^\d+$/),
  collateralAmount: z.string().regex(/^\d+$/),
});

const sellSchema = z.object({
  marketIdHex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  outcomeIndex: z.string().regex(/^\d+$/),
  shareAmount: z.string().regex(/^\d+$/),
  minCollateralOut: z.string().regex(/^\d+$/),
});

const claimSchema = z.object({
  marketIdHex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

/**
 * Returns unsigned calldata for the connected wallet (MetaMask, WalletConnect, etc.) to sign and send.
 */
txRouter.post("/buy", validateBody(buySchema), (req, res) => {
  const tx = encodeBuy(
    req.body.marketIdHex,
    BigInt(req.body.outcomeIndex),
    BigInt(req.body.minShares),
    BigInt(req.body.collateralAmount),
  );
  res.json({
    chainId: env.CHAIN_ID,
    to: tx.to,
    data: tx.data,
    value: "0",
  });
});

txRouter.post("/sell", validateBody(sellSchema), (req, res) => {
  const tx = encodeSell(
    req.body.marketIdHex,
    BigInt(req.body.outcomeIndex),
    BigInt(req.body.shareAmount),
    BigInt(req.body.minCollateralOut),
  );
  res.json({
    chainId: env.CHAIN_ID,
    to: tx.to,
    data: tx.data,
    value: "0",
  });
});

txRouter.post("/claim", validateBody(claimSchema), (req, res) => {
  const tx = encodeClaim(req.body.marketIdHex);
  res.json({
    chainId: env.CHAIN_ID,
    to: tx.to,
    data: tx.data,
    value: "0",
  });
});
