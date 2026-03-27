import { JsonRpcProvider, Wallet } from "ethers";
import { env } from "../../config/env.js";

let readProvider: JsonRpcProvider | null = null;

export function getReadProvider(): JsonRpcProvider {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(env.RPC_URL, env.CHAIN_ID);
  }
  return readProvider;
}

export function getOperatorWallet(): Wallet | null {
  if (!env.OPERATOR_PRIVATE_KEY) return null;
  return new Wallet(env.OPERATOR_PRIVATE_KEY, getReadProvider());
}
