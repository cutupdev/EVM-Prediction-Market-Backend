import { Contract, Interface, type TransactionRequest } from "ethers";
import { env } from "../../config/env.js";
import { predictionMarketAbi } from "../../contracts/prediction-market.abi.js";
import { erc20Abi } from "../../contracts/erc20.abi.js";
import { getOperatorWallet, getReadProvider } from "./evm-provider.js";

const iface = new Interface(predictionMarketAbi);

export function predictionMarketAddress(): string {
  return env.PREDICTION_MARKET_ADDRESS;
}

export function readOnlyMarketContract(): Contract {
  return new Contract(predictionMarketAddress(), predictionMarketAbi, getReadProvider());
}

export function operatorMarketContract(): Contract | null {
  const w = getOperatorWallet();
  if (!w) return null;
  return new Contract(predictionMarketAddress(), predictionMarketAbi, w);
}

export type OnChainMarketView = {
  outcomeCount: bigint;
  resolved: boolean;
  winningOutcome: bigint;
  endTime: bigint;
};

export async function fetchMarketOnChain(marketIdHex: string): Promise<OnChainMarketView> {
  const c = readOnlyMarketContract();
  const r = await c.getMarket(marketIdHex);
  return {
    outcomeCount: r[0] as bigint,
    resolved: r[1] as boolean,
    winningOutcome: r[2] as bigint,
    endTime: r[3] as bigint,
  };
}

export function encodeBuy(
  marketIdHex: string,
  outcomeIndex: bigint,
  minShares: bigint,
  collateralAmount: bigint,
): TransactionRequest {
  const data = iface.encodeFunctionData("buy", [marketIdHex, outcomeIndex, minShares, collateralAmount]);
  return { to: predictionMarketAddress(), data };
}

export function encodeSell(
  marketIdHex: string,
  outcomeIndex: bigint,
  shareAmount: bigint,
  minCollateralOut: bigint,
): TransactionRequest {
  const data = iface.encodeFunctionData("sell", [marketIdHex, outcomeIndex, shareAmount, minCollateralOut]);
  return { to: predictionMarketAddress(), data };
}

export function encodeClaim(marketIdHex: string): TransactionRequest {
  const data = iface.encodeFunctionData("claim", [marketIdHex]);
  return { to: predictionMarketAddress(), data };
}

export async function fetchCollateralDecimals(): Promise<number> {
  const addr = env.COLLATERAL_TOKEN_ADDRESS;
  if (!addr) return 18;
  const c = new Contract(addr, erc20Abi, getReadProvider());
  return Number(await c.decimals());
}
