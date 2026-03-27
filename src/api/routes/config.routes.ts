import { Router } from "express";
import { env } from "../../config/env.js";
import { orderEip712Domain, orderTypedDataTypes } from "../../services/signing/eip712-order.js";
import { predictionMarketAddress } from "../../services/blockchain/prediction-market.chain.js";

export const configRouter = Router();

/**
 * Exposes EIP-712 domain + types so the web UI can sign orders identically to the backend verifier.
 */
configRouter.get("/eip712", (_req, res) => {
  const domain = orderEip712Domain();
  res.json({
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId?.toString(),
      verifyingContract: domain.verifyingContract,
    },
    types: orderTypedDataTypes,
    primaryType: "Order",
    contracts: {
      predictionMarket: predictionMarketAddress(),
      chainId: env.CHAIN_ID,
    },
  });
});
