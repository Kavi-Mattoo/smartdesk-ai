import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createTicketStore } from "./store.js";

// Load the repo-root .env (copy .env.example to .env). Real environment variables win.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", "..", ".env") });

const config = loadConfig();
const store = createTicketStore({ filePath: config.dataFile, seedPath: config.seedFile });

try {
  await store.init();
} catch (error) {
  console.error(`Failed to start: ${error.message}`);
  process.exit(1);
}

const app = createApp({ store, config });
const server = app.listen(config.port, () => {
  console.log(`SmartDesk AI API running at http://localhost:${config.port}`);
  console.log(
    config.ai.apiKey
      ? `AI replies: enabled (model: ${config.ai.model})`
      : "AI replies: disabled (no ANTHROPIC_API_KEY) - using rule-based suggestions",
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`Port ${config.port} is already in use. Set PORT in .env or stop the other process.`);
  else console.error(error);
  process.exit(1);
});
