import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");

function toPositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
}

/** Builds the runtime configuration from environment variables (never from the client). */
export function loadConfig(env = process.env) {
  return {
    port: toPositiveInt(env.PORT, 5000, 65535),
    dataFile: env.DATA_FILE ? path.resolve(env.DATA_FILE) : path.join(serverRoot, "data", "tickets.json"),
    seedFile: path.join(serverRoot, "data", "seed.json"),
    clientDist: path.resolve(serverRoot, "..", "client", "dist"),
    corsOrigins: (env.CLIENT_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    ai: {
      apiKey: (env.ANTHROPIC_API_KEY ?? "").trim(),
      model: (env.ANTHROPIC_MODEL ?? "").trim() || "claude-haiku-5-5",
      timeoutMs: toPositiveInt(env.AI_TIMEOUT_MS, 15000, 120000),
    },
  };
}
