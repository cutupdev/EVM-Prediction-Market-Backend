import { verifyTypedData, type TypedDataDomain } from "ethers";
import { env } from "../../config/env.js";

export const orderTypedDataTypes = {
  Order: [
    { name: "marketId", type: "string" },
    { name: "onChainMarketId", type: "string" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "priceBps", type: "uint256" },
    { name: "sizeRaw", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export type OrderMessage = {
  marketId: string;
  onChainMarketId: string;
  outcomeIndex: bigint;
  side: number;
  priceBps: bigint;
  sizeRaw: bigint;
  nonce: bigint;
};

export function orderEip712Domain(): TypedDataDomain {
  return {
    name: env.EIP712_NAME,
    version: env.EIP712_VERSION,
    chainId: BigInt(env.EIP712_CHAIN_ID),
    verifyingContract: env.EIP712_VERIFYING_CONTRACT,
  };
}

export function verifyOrderSignature(makerAddress: string, message: OrderMessage, signature: string): boolean {
  try {
    const recovered = verifyTypedData(orderEip712Domain(), orderTypedDataTypes, message, signature);
    return recovered.toLowerCase() === makerAddress.toLowerCase();
  } catch {
    return false;
  }
}
