import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("/api/v1"),
  DATABASE_URL: z.string().min(1),
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int(),
  OPERATOR_PRIVATE_KEY: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  PREDICTION_MARKET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  COLLATERAL_TOKEN_ADDRESS: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  EIP712_NAME: z.string().default("PredictionMarketOrders"),
  EIP712_VERSION: z.string().default("1"),
  EIP712_CHAIN_ID: z.coerce.number().int(),
  EIP712_VERIFYING_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export function corsOriginList(): string[] {
  return env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}
