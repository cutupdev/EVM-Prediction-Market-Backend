# EVM Prediction Market Backend

Node.js **TypeScript** service for a prediction market on EVM chains: **JSON-RPC reads/writes**, **REST API** for a web UI, **PostgreSQL** via **Prisma**, an **off-chain central limit order book (CLOB)** with optional **EIP-712** signed orders, and **Socket.IO** for live order book and trade updates.

This repository is a **backend template**. You must align the Solidity ABI (`src/contracts/prediction-market.abi.ts`) and environment variables with your deployed contracts.

## Architecture

- **Chain layer** (`src/services/blockchain/`): `ethers` v6 `JsonRpcProvider`, read-only + optional operator wallet, calldata encoding for wallet-driven txs (`/api/v1/tx/*`), and a lightweight **log listener** that upserts `Market` rows and stores raw logs in `ChainEvent`.
- **Order book** (`src/services/orderbook/`): in-memory **price–time priority** matching per `(marketId, outcomeIndex)`; **PostgreSQL** persists orders and trades. Suitable for a single API instance or a leader writer; for horizontal scale, add Redis or move matching behind a dedicated worker.
- **UI integration**: CORS-enabled REST + `GET /api/v1/config/eip712` for typed-data signing; Socket.IO rooms `market:<prismaMarketId>` with events `orderbook:updated` and `trade`.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `RPC_URL`, `CHAIN_ID`, `PREDICTION_MARKET_ADDRESS`, and EIP-712 fields to match your deployment and frontend.

2. Install dependencies and generate the Prisma client:

   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   ```

3. Development:

   ```bash
   npm run dev
   ```

4. Production build:

   ```bash
   npm run build
   npm start
   ```

## Environment

See `.env.example` for all variables. Important:

| Variable | Role |
|----------|------|
| `DATABASE_URL` | PostgreSQL connection string |
| `RPC_URL` | HTTPS JSON-RPC endpoint |
| `CHAIN_ID` | Must match the chain id returned by the RPC |
| `PREDICTION_MARKET_ADDRESS` | Core market contract |
| `OPERATOR_PRIVATE_KEY` | Optional; only if the server submits transactions |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `EIP712_*` | Must match the values used by your web app when signing orders |

## HTTP API (summary)

Base path: `API_PREFIX` (default `/api/v1`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/api/v1/config/eip712` | EIP-712 domain and types for order signing |
| GET | `/api/v1/markets` | List markets (`?resolved=true|false`, pagination) |
| POST | `/api/v1/markets` | Register/upsert a market row (or rely on indexer) |
| GET | `/api/v1/markets/:id` | Market by Prisma id |
| GET | `/api/v1/markets/:id/chain` | DB row + on-chain `getMarket` snapshot |
| GET | `/api/v1/markets/:id/orderbook?outcomeIndex=0` | Bids/asks snapshot |
| POST | `/api/v1/markets/:id/orders` | Place order (optional `requireSignature: true`) |
| GET | `/api/v1/markets/:id/trades` | Recent trades |
| DELETE | `/api/v1/orders/:orderId?requester=0x…` | Cancel resting order |
| GET | `/api/v1/users/:address/orders` | Orders for a wallet |
| POST | `/api/v1/tx/buy` | Unsigned buy calldata for the user wallet |
| POST | `/api/v1/tx/sell` | Unsigned sell calldata |
| POST | `/api/v1/tx/claim` | Unsigned claim calldata |

### Order placement body (example)

```json
{
  "makerAddress": "0x…",
  "outcomeIndex": 0,
  "side": "BUY",
  "priceBps": 5500,
  "sizeRaw": "1000000",
  "requireSignature": false
}
```

`priceBps` is **basis points** of probability (1–10000). `sizeRaw` is an integer string in your collateral’s smallest units (convention must match the on-chain settlement path you implement).

With `requireSignature: true`, include `signature` and `chainNonce` matching `GET /api/v1/config/eip712` and `src/services/signing/eip712-order.ts`.

### Socket.IO (browser / UI)

```text
connect → emit("market:subscribe", "<prismaMarketId>")
listen: "orderbook:updated" | "trade"
```

## Smart contract alignment

1. Update `src/contracts/prediction-market.abi.ts` to match your contract.
2. Ensure events `MarketCreated` / `MarketResolved` match if you use `event-indexer.service.ts`.
3. Expose `getMarket(bytes32)` (or adjust `prediction-market.chain.ts`) so `/markets/:id/chain` stays accurate.

## Contact Information

- Telegram: https://t.me/DevCutup
- Twitter: https://x.com/devcutup
